import { NextRequest } from "next/server";
import { db } from "@/db";
import { items, modules } from "@/db/schema/modules";
import { studentProgress } from "@/db/schema/studentProgress";
import { studentTestAttempts, studentAnswers } from "@/db/schema/studentTestAttempts";
import { eq, and, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { evaluateShortAnswer, evaluateMCQAnswer } from "@/lib/ai-evaluation";

interface AnswerSubmission {
  moduleId: string;
  answers: {
    [questionId: string]: string;
  };
}

// Define score thresholds for level assignment
const SCORE_THRESHOLDS = {
  high: 0.8,    // 80% correct for high level
  medium: 0.5,  // 50% correct for medium level
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const moduleId = (await params).id;
  
  try {
    // Verify user session
    const session = await getServerSession();
    if (!session || session.user.role !== "student") {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get submitted answers
    const body: AnswerSubmission = await req.json();
    const { answers } = body;

    // Fetch pretest questions and correct answers for the module
    const pretestQuestions = await db
      .select({
        id: items.id,
        question: items.question,
        options: items.options,
        questionType: items.questionType,
        answer: items.answer,
        explanation: items.explanation,
      })
      .from(items)
      .where(and(
        eq(items.moduleId, moduleId),
        eq(items.type, "pretest")
      ));

    if (pretestQuestions.length === 0) {
      return new Response(JSON.stringify({ error: "No pretest questions available" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate score based on answers
    let totalScore = 0;
    let totalAnswered = 0;

    // Array to store question results for saving to DB
    const questionResults = [];

    for (const question of pretestQuestions) {
      const submittedAnswer = answers[question.id];
      
      if (submittedAnswer !== undefined && submittedAnswer !== "") {
        totalAnswered++;
        
        if (question.questionType === "mcq" && question.answer) {
          // For MCQ questions, use exact match evaluation with explanation
          const mcqResult = evaluateMCQAnswer(question.answer, submittedAnswer, question.explanation);
          if (mcqResult.isCorrect) {
            totalScore += 1;
          }
          questionResults.push({
            questionId: question.id,
            studentAnswer: submittedAnswer,
            isCorrect: mcqResult.isCorrect,
            score: mcqResult.isCorrect ? 1 : 0,
            feedback: mcqResult.feedback
          });
        } else if (question.questionType === "short" && question.answer) {
          // For short answer questions, use AI for scoring, but database explanation as feedback
          const aiResult = await evaluateShortAnswer(
            question.question,
            question.answer,
            submittedAnswer,
            question.explanation
          );
          totalScore += aiResult.score; // Use the score from AI evaluation (0 to 1)
          questionResults.push({
            questionId: question.id,
            studentAnswer: submittedAnswer,
            isCorrect: aiResult.isCorrect,
            score: aiResult.score,
            feedback: aiResult.feedback
          });
        }
      } else {
        // If no answer was submitted, mark as incorrect
        questionResults.push({
          questionId: question.id,
          studentAnswer: "",
          isCorrect: false,
          score: 0,
          feedback: "No answer provided."
        });
      }
    }

    // Calculate score percentage
    const scorePercentage = totalAnswered > 0 ? totalScore / totalAnswered : 0;

    // Determine level based on score
    let levelAssigned: "easy" | "medium" | "high" = "medium"; // Default to medium
    
    if (scorePercentage >= SCORE_THRESHOLDS.high) {
      levelAssigned = "high";
    } else if (scorePercentage >= SCORE_THRESHOLDS.medium) {
      levelAssigned = "medium";
    } else {
      levelAssigned = "easy";
    }

    // Check if a progress record already exists for this student and module
    const existingProgress = await db
      .select()
      .from(studentProgress)
      .where(and(
        eq(studentProgress.studentId, session.user.id),
        eq(studentProgress.moduleId, moduleId)
      ))
      .orderBy(desc(studentProgress.createdAt))
      .limit(1);

    if (existingProgress.length > 0) {
      // Update the existing record
      await db
        .update(studentProgress)
        .set({
          levelAssigned,
          pretestScore: JSON.stringify({ score: scorePercentage, totalAnswered, totalScore }),
          startDate: new Date(),
          status: "in_progress"
        })
        .where(eq(studentProgress.id, existingProgress[0].id));
    } else {
      // Create a new progress record
      await db.insert(studentProgress).values({
        studentId: session.user.id,
        moduleId,
        levelAssigned,
        pretestScore: JSON.stringify({ score: scorePercentage, totalAnswered, totalScore }),
        status: "in_progress"
      });
    }

    // Save the pretest attempt to the database
    const [testAttempt] = await db.insert(studentTestAttempts).values({
      studentId: session.user.id,
      moduleId,
      testType: "pretest",
      level: levelAssigned,
      score: scorePercentage.toString(),
      totalQuestions: pretestQuestions.length.toString(),
      correctAnswers: Math.round(totalScore).toString(),
      status: "completed"
    }).returning({ id: studentTestAttempts.id });

    // Save individual answers to the database
    for (const result of questionResults) {
      await db.insert(studentAnswers).values({
        attemptId: testAttempt.id,
        questionId: result.questionId,
        studentAnswer: result.studentAnswer,
        isCorrect: result.isCorrect ? "true" : "false",
        score: result.score.toString(),
        feedback: result.feedback
      });
    }

    return new Response(JSON.stringify({ 
      levelAssigned,
      score: scorePercentage,
      totalAnswered,
      totalScore
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting pretest:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
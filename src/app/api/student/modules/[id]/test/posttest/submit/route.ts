import { NextRequest } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema/modules";
import { studentTestAttempts, studentAnswers } from "@/db/schema/studentTestAttempts";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { evaluateShortAnswer, evaluateMCQAnswer } from "@/lib/ai-evaluation";

interface AnswerSubmission {
  moduleId: string;
  level: "easy" | "medium" | "high";
  answers: {
    [questionId: string]: string;
  };
}

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
    const { answers, level } = body;
    const testType = "posttest"; // This API is specifically for post-test

    // Fetch posttest questions for the module and level
    const posttestQuestions = await db
      .select({
        id: items.id,
        question: items.question,
        questionType: items.questionType,
        answer: items.answer,
        explanation: items.explanation,
      })
      .from(items)
      .where(and(
        eq(items.moduleId, moduleId),
        eq(items.level, level),
        eq(items.type, testType)
      ));

    if (posttestQuestions.length === 0) {
      return new Response(JSON.stringify({ error: "No posttest questions available" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate score based on answers
    let totalScore = 0;
    let totalAnswered = 0;
    const questionResults = [];

    for (const question of posttestQuestions) {
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
            isCorrect: mcqResult.isCorrect,
            feedback: mcqResult.feedback,
            studentAnswer: submittedAnswer,
            score: mcqResult.isCorrect ? 1 : 0
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
            isCorrect: aiResult.isCorrect,
            feedback: aiResult.feedback,
            studentAnswer: submittedAnswer,
            score: aiResult.score
          });
        }
      } else {
        // If no answer was submitted, mark as incorrect
        questionResults.push({
          questionId: question.id,
          isCorrect: false,
          feedback: "No answer provided.",
          studentAnswer: "",
          score: 0
        });
      }
    }

    // Calculate overall percentage
    const scorePercentage = totalAnswered > 0 ? totalScore / totalAnswered : 0;
    
    // Determine pass/fail (50% threshold for passing)
    const passed = scorePercentage >= 0.5;

    // Save the test attempt to the database
    const [testAttempt] = await db.insert(studentTestAttempts).values({
      studentId: session.user.id,
      moduleId,
      testType,
      level,
      score: scorePercentage.toString(),
      totalQuestions: posttestQuestions.length.toString(),
      correctAnswers: Math.round(totalScore).toString(), // Approximate correct answers based on score
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
      passed,
      score: scorePercentage,
      totalQuestions: posttestQuestions.length,
      correctAnswers: Math.round(totalScore), // Approximate correct answers based on score
      totalAnswered,
      questionResults: questionResults.map(r => ({
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        feedback: r.feedback
      }))
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting posttest:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
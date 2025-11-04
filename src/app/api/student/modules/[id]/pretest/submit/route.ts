import { NextRequest } from "next/server";
import { db } from "@/db";
import { items, modules } from "@/db/schema/modules";
import { studentProgress } from "@/db/schema/studentProgress";
import { eq, and, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";

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

    // Calculate score based on correct answers
    let correctAnswers = 0;
    let totalAnswered = 0;

    for (const question of pretestQuestions) {
      const submittedAnswer = answers[question.id];
      
      if (submittedAnswer !== undefined && submittedAnswer !== "") {
        totalAnswered++;
        
        // For MCQ questions, check if the answer matches exactly
        if (question.questionType === "mcq" && question.answer) {
          if (submittedAnswer.toLowerCase() === question.answer.toLowerCase()) {
            correctAnswers++;
          }
        } 
        // For short answer questions, we could implement more sophisticated checking
        // For now, we'll use a basic approach - if they provided an answer, count as correct
        else if (question.questionType === "short" && question.answer) {
          // In a more sophisticated system, we might use AI to evaluate short answers
          // For now, we'll consider non-empty answers as attempts
          // We'll default to giving partial credit or medium level if the answer is provided
          if (submittedAnswer.trim().length > 0) {
            correctAnswers++; // Simplified: giving credit for attempting
          }
        }
      }
    }

    // Calculate score percentage
    const scorePercentage = totalAnswered > 0 ? correctAnswers / totalAnswered : 0;

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
          pretestScore: JSON.stringify({ score: scorePercentage, totalAnswered, correctAnswers }),
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
        pretestScore: JSON.stringify({ score: scorePercentage, totalAnswered, correctAnswers }),
        status: "in_progress"
      });
    }

    return new Response(JSON.stringify({ 
      levelAssigned,
      score: scorePercentage,
      totalAnswered,
      correctAnswers
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting pretest:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
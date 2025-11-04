import { NextRequest } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema/modules";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { evaluateShortAnswer, evaluateMCQAnswer } from "@/lib/ai-evaluation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id: moduleId, questionId } = await params;
  
  try {
    // Verify user session
    const session = await getServerSession();
    if (!session || session.user.role !== "student") {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get submitted answer
    const body = await req.json();
    const { answer: submittedAnswer, testType } = body;

    // Fetch the question details
    const question = await db
      .select({
        id: items.id,
        question: items.question,
        questionType: items.questionType,
        answer: items.answer,
        explanation: items.explanation,
        options: items.options,
      })
      .from(items)
      .where(eq(items.id, questionId));

    if (!question.length) {
      return new Response("Question not found", { status: 404 });
    }

    const questionData = question[0];
    let result;

    if (questionData.questionType === "mcq") {
      // For MCQ, use exact match evaluation with explanation
      result = evaluateMCQAnswer(questionData.answer, submittedAnswer, questionData.explanation);
    } else if (questionData.questionType === "short") {
      // For short answer, use AI for scoring, but database explanation as feedback
      result = await evaluateShortAnswer(
        questionData.question,
        questionData.answer,
        submittedAnswer,
        questionData.explanation
      );
    } else {
      return new Response("Invalid question type", { status: 400 });
    }

    return new Response(JSON.stringify({ 
      success: true,
      isCorrect: result.isCorrect,
      feedback: result.feedback
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting posttest answer:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
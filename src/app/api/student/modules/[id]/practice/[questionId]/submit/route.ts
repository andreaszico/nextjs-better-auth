import { NextRequest } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema/modules";
import { studentTestAttempts, studentAnswers } from "@/db/schema/studentTestAttempts";
import { eq, and, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { evaluateShortAnswer, evaluateMCQAnswer } from "@/lib/ai-evaluation";

export async function POST(req: NextRequest) {
  try {
    // Verify user session
    const session = await getServerSession();
    if (!session || session.user.role !== "student") {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse JSON data
    const body = await req.json();
    const { questionId, answer: submittedAnswer, questionType, moduleId } = body;

    // Determine the level for this practice question
    const question = await db
      .select({
        id: items.id,
        question: items.question,
        questionType: items.questionType,
        answer: items.answer,
        explanation: items.explanation,
        level: items.level,
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

    // Find or create a practice session for this module and level
    const existingAttempt = await db
      .select()
      .from(studentTestAttempts)
      .where(and(
        eq(studentTestAttempts.studentId, session.user.id),
        eq(studentTestAttempts.moduleId, moduleId),
        eq(studentTestAttempts.testType, "practice"),
        eq(studentTestAttempts.level, questionData.level),
        eq(studentTestAttempts.status, "in_progress")
      ))
      .orderBy(desc(studentTestAttempts.attemptDate))
      .limit(1);

    let attemptId;
    if (existingAttempt.length > 0) {
      attemptId = existingAttempt[0].id;
    } else {
      // Create a new practice attempt
      const [newAttempt] = await db.insert(studentTestAttempts).values({
        studentId: session.user.id,
        moduleId,
        testType: "practice",
        level: questionData.level,
        score: "0", // Will be updated later when we have a total
        totalQuestions: "1", // Placeholder - will be updated as needed
        correctAnswers: "0", // Placeholder - will be updated as needed
        status: "in_progress"
      }).returning({ id: studentTestAttempts.id });
      
      attemptId = newAttempt.id;
    }

    // Save the individual answer
    await db.insert(studentAnswers).values({
      attemptId,
      questionId,
      studentAnswer: submittedAnswer,
      isCorrect: result.isCorrect ? "true" : "false",
      score: result.score ? result.score.toString() : (result.isCorrect ? "1" : "0"),
      feedback: result.feedback
    });

    // Calculate the average score for this practice session
    const sessionAnswers = await db
      .select({
        score: studentAnswers.score,
        isCorrect: studentAnswers.isCorrect
      })
      .from(studentAnswers)
      .where(eq(studentAnswers.attemptId, attemptId));
    
    let totalScore = 0;
    for (const answer of sessionAnswers) {
      totalScore += parseFloat(answer.score) || (answer.isCorrect === "true" ? 1 : 0);
    }
    
    const averageScore = sessionAnswers.length > 0 ? totalScore / sessionAnswers.length : 0;

    // Update the practice attempt with the new average score
    await db
      .update(studentTestAttempts)
      .set({
        score: averageScore.toString(),
        totalQuestions: sessionAnswers.length.toString(),
        correctAnswers: sessionAnswers.filter(a => a.isCorrect === "true").length.toString()
      })
      .where(eq(studentTestAttempts.id, attemptId));

    return new Response(JSON.stringify({ 
      success: true,
      isCorrect: result.isCorrect,
      feedback: result.feedback
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting practice answer:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
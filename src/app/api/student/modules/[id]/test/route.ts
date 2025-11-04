import { NextRequest } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const moduleId = (await params).id;  // Get moduleId from the route parameter, not from search params
  const level = searchParams.get("level") as "easy" | "medium" | "high";
  const testType = searchParams.get("type") as "pretest" | "posttest" | "practice";
  
  try {
    // Verify user session
    const session = await getServerSession();
    if (!session || session.user.role !== "student") {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!moduleId || !level || !testType) {
      return new Response("Missing required parameters", { status: 400 });
    }

    // Fetch test questions for the specific level and type
    const testQuestions = await db
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
        eq(items.level, level),
        eq(items.type, testType)
      ));

    return new Response(JSON.stringify({ questions: testQuestions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error fetching ${testType} questions:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
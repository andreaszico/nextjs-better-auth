import { NextRequest } from "next/server";
import { db } from "@/db";
import { items, modules } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";

export async function GET(
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

    // Fetch pretest questions for the module
    const pretestQuestions = await db
      .select({
        id: items.id,
        moduleId: items.moduleId,
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

    return new Response(JSON.stringify({ questions: pretestQuestions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching pretest questions:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
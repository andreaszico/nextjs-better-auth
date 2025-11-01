import { NextRequest } from "next/server";
import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq, and, InferInsertModel, InferSelectModel } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { z } from "zod";

type ModuleInsertType = InferInsertModel<typeof modules>;
type ModuleSelectType = InferSelectModel<typeof modules>;
type ModuleContentType = InferInsertModel<typeof moduleContents>;
type ItemType = InferInsertModel<typeof items>;

type SessionType = Awaited<ReturnType<typeof getServerSession>>;

type QuestionData = {
  questionType: "mcq" | "short";
  type: "pretest" | "practice" | "posttest";
  question: string;
  options?: string[] | null;
  answer: string;
  explanation: string;
};

type OllamaResponseType = {
  content: string;
  questions: QuestionData[];
};

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  content: z.string().min(10, "Content is required"),
  level: z.enum(["easy", "medium", "high"] as const, { error: "Level is required" }),
});

export async function POST(request: NextRequest) {
  try {
    const session: SessionType = await getServerSession();
    if (!session || session.user.role !== "instructor") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, content, level } = uploadSchema.parse(body);

    // Transaction ensures data consistency
    const result: ModuleSelectType = await db.transaction(async (tx) => {
      // Check if module already exists for this instructor
      let existingModule = await tx
        .select()
        .from(modules)
        .where(and(eq(modules.title, title), eq(modules.instructorId, session.user.id)))
        .limit(1);

      let moduleRecord: ModuleSelectType;

      if (existingModule.length === 0) {
        // Create new module if not exists
        const [newModule] = await tx
          .insert(modules)
          .values({
            title,
            description,
            instructorId: session.user.id,
          } as ModuleInsertType)
          .returning();
        moduleRecord = newModule;
      } else {
        moduleRecord = existingModule[0];
      }

      // Generate content & questions only for the selected level
      const ollamaResponse: OllamaResponseType = await generateAIContent(content, title, level);

      // Insert or update content for this level
      const existingContent = await tx
        .select()
        .from(moduleContents)
        .where(and(eq(moduleContents.moduleId, moduleRecord.id), eq(moduleContents.level, level)))
        .limit(1);

      if (existingContent.length > 0) {
        await tx
          .update(moduleContents)
          .set({ content: ollamaResponse.content })
          .where(and(eq(moduleContents.moduleId, moduleRecord.id), eq(moduleContents.level, level)));
      } else {
        await tx.insert(moduleContents).values({
          moduleId: moduleRecord.id,
          level,
          content: ollamaResponse.content,
        } as ModuleContentType);
      }

      // Delete existing items for this level (to regenerate cleanly)
      await tx.delete(items).where(and(eq(items.moduleId, moduleRecord.id), eq(items.level, level)));

      // Insert questions for this level
      const itemPromises = ollamaResponse.questions.map((q: QuestionData) =>
        tx.insert(items).values({
          moduleId: moduleRecord.id,
          level,
          questionType: q.questionType,
          type: q.type,
          question: q.question,
          options: q.options || null,
          answer: q.answer,
          explanation: q.explanation,
        } as ItemType)
      );

      await Promise.all(itemPromises);
      return moduleRecord;
    });

    return Response.json({
      success: true,
      module: result,
      message: `Module "${result.title}" content for level "${body.level}" generated successfully`,
    });
  } catch (error) {
    console.error("Error uploading module:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid input data", details: error }, { status: 400 });
    }
    return Response.json({ error: "Failed to upload module" }, { status: 500 });
  }
}

// Function to call Ollama API for a specific level
async function generateAIContent(content: string, title: string, level: string): Promise<OllamaResponseType> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

    const prompt = `
Generate educational content for module "${title}" at ${level.toUpperCase()} level based on this content:
"${content}"

Return ONLY a JSON object in this format:
{
  "content": "Educational explanation or summary for ${level} level",
  "questions": [
    {
      "questionType": "mcq" | "short",
      "type": "pretest" | "practice" | "posttest",
      "question": "Question text",
      "options": ["opt1", "opt2", "opt3", "opt4"],
      "answer": "Correct answer",
      "explanation": "Reason why the answer is correct"
    }
  ]
}

Generate 5 MCQ and 5 short-answer questions for this ${level} level only.
`;

    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "tinyllama",
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);

    const data = await response.json();
    const aiResponse = data.response;

    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not extract JSON from AI response");

    return JSON.parse(jsonMatch[0]) as OllamaResponseType;
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw error;
  }
}

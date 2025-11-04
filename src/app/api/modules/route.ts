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
  structuredContent?: {
    moduleIdentity?: string;
    introduction?: string;
    learningObjectives?: string[];
    materialExplanation?: string;
    summary?: string;
  };
  questions: QuestionData[];
};

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  content: z.string().min(10, "Content is required"),
  level: z.enum(["easy", "medium", "high"] as const), // Required field to specify which level to generate
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

      // Prepare the content data using structured content if available, otherwise fall back to content string
      const contentData = ollamaResponse.structuredContent || {
        moduleIdentity: ollamaResponse.content,
        introduction: "",
        learningObjectives: [],
        materialExplanation: ollamaResponse.content,
        summary: ""
      };

      if (existingContent.length > 0) {
        await tx
          .update(moduleContents)
          .set({
            moduleIdentity: contentData.moduleIdentity,
            introduction: contentData.introduction,
            learningObjectives: contentData.learningObjectives,
            materialExplanation: contentData.materialExplanation,
            summary: contentData.summary
          })
          .where(and(eq(moduleContents.moduleId, moduleRecord.id), eq(moduleContents.level, level)));
      } else {
        await tx.insert(moduleContents).values({
          moduleId: moduleRecord.id,
          level,
          moduleIdentity: contentData.moduleIdentity,
          introduction: contentData.introduction,
          learningObjectives: contentData.learningObjectives,
          materialExplanation: contentData.materialExplanation,
          summary: contentData.summary,
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
You are an API that returns ONLY strict JSON (RFC 8259).

Hard rules you MUST follow:
- Output a single JSON object only. No explanations, no markdown/code fences, no backticks, no comments.
- Use double quotes for ALL keys and ALL string values.
- Do NOT include trailing commas.
- Do NOT add or rename fields outside the schema below.
- For "questionType":"short", set "options" to null (not an array).
- Escape any double quotes inside strings with \\" and replace literal newlines inside strings with \\n.

Task:
Generate comprehensive educational content for module "${title}" at ${level.toUpperCase()} level based on this content:
"""${content}"""

Generate content with appropriate depth and complexity for ${level} level.

Return EXACTLY this JSON shape:

{
  "content": {
    "Module Identity": "Define the key identity of the module",
    "Introduction": "Provide an engaging introduction to the topic",
    "Learning Objectives": [
      "Learning objective 1",
      "Learning objective 2",
      "Learning objective 3"
    ],
    "Material Explanation / Brief Theory": "Detailed explanation of concepts appropriate for ${level} level",
    "Summary (Temporary Conclusion)": "Concise summary wrapping up the key points"
  },
  "questions": [
    {
      "questionType": "mcq" | "short",
      "type": "pretest" | "practice" | "posttest",
      "question": "Question text appropriate for ${level} level",
      "options": ["option1", "option2", "option3", "option4"] | null,
      "answer": "Correct answer",
      "explanation": "Reason why the answer is correct"
    }
  ]
}
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

    // The AI response might contain the JSON object within the response text
    // It might also include markdown code blocks (```json ... ```) that need to be handled
    let cleanedResponse = aiResponse;
    
    // Remove markdown code blocks if present
    if (aiResponse.includes('```json') || aiResponse.includes('```')) {
      // Extract content between ```json and ```
      const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanedResponse = codeBlockMatch[1].trim();
      }
    }
    
    // Extract JSON using regex from the cleaned response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not extract JSON from AI response");

    let jsonString = jsonMatch[0];
    
    // First, try to parse as-is
    try {
      const parsedResult = JSON.parse(jsonString) as any;
      
      // Ensure questions is an array
      if (!Array.isArray(parsedResult.questions)) {
        console.error("Questions field is not an array:", typeof parsedResult.questions, parsedResult.questions);
        throw new Error("Questions field in AI response is not an array");
      }
      
      // Check if the content field is structured as expected
      if (typeof parsedResult.content === 'object' && parsedResult.content !== null) {
        // Content is structured as separate fields
        const contentObj = parsedResult.content;
        
        // Create a combined content string for backward compatibility
        const sections = [];
        if (contentObj["Module Identity"]) {
          sections.push(`## Module Identity\n${contentObj["Module Identity"]}`);
        }
        if (contentObj.Introduction) {
          sections.push(`## Introduction\n${contentObj.Introduction}`);
        }
        if (contentObj["Learning Objectives"] && Array.isArray(contentObj["Learning Objectives"])) {
          sections.push(`## Learning Objectives\n${contentObj["Learning Objectives"].join('\n- ')}`);
        }
        if (contentObj["Material Explanation / Brief Theory"]) {
          sections.push(`## Material Explanation / Brief Theory\n${contentObj["Material Explanation / Brief Theory"]}`);
        }
        if (contentObj["Summary (Temporary Conclusion)"]) {
          sections.push(`## Summary (Temporary Conclusion)\n${contentObj["Summary (Temporary Conclusion)"]}`);
        }
        const combinedContent = sections.join('\n\n');
        
        // Return properly typed result with both combined content and structured data
        return {
          content: combinedContent,
          structuredContent: {
            moduleIdentity: contentObj["Module Identity"],
            introduction: contentObj.Introduction,
            learningObjectives: contentObj["Learning Objectives"],
            materialExplanation: contentObj["Material Explanation / Brief Theory"],
            summary: contentObj["Summary (Temporary Conclusion)"]
          },
          questions: parsedResult.questions
        } as OllamaResponseType;
      } else {
        console.error("Content field is not an object with structured data:", typeof parsedResult.content, parsedResult.content);
        throw new Error("Content field in AI response is not an object with structured data");
      }
    } catch (initialError) {
      // If that fails, try sanitizing the JSON
      try {
        // Remove control characters that cause issues
        jsonString = jsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        
        // Remove any trailing commas before closing braces/brackets
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        
        // Replace newlines and special characters within quotes
        let inString = false;
        let escaped = false;
        let result = '';
        for (let i = 0; i < jsonString.length; i++) {
          const char = jsonString[i];
          
          if (char === '"' && !escaped) {
            inString = !inString;
            result += char;
          } else if (char === '\\' && inString) {
            result += char;
            escaped = true;
          } else if (inString && (char === '\n' || char === '\r')) {
            // Replace newlines inside strings with escaped versions
            result += '\\n';
            escaped = false;
          } else if (inString && char === '"') {
            // Escape unescaped quotes inside strings
            result += '\\"';
          } else {
            result += char;
            escaped = false;
          }
        }
        jsonString = result;
        
        const parsedResult = JSON.parse(jsonString) as any;
        
        // Ensure questions is an array
        if (!Array.isArray(parsedResult.questions)) {
          console.error("Questions field is not an array after sanitization:", typeof parsedResult.questions, parsedResult.questions);
          throw new Error("Questions field in AI response is not an array");
        }
        
        // Check if the content field is structured as expected
        if (typeof parsedResult.content === 'object' && parsedResult.content !== null) {
          // Content is structured as separate fields
          const contentObj = parsedResult.content;
          
          // Create a combined content string for backward compatibility
          const sections = [];
          if (contentObj["Module Identity"]) {
            sections.push(`## Module Identity\n${contentObj["Module Identity"]}`);
          }
          if (contentObj.Introduction) {
            sections.push(`## Introduction\n${contentObj.Introduction}`);
          }
          if (contentObj["Learning Objectives"] && Array.isArray(contentObj["Learning Objectives"])) {
            sections.push(`## Learning Objectives\n${contentObj["Learning Objectives"].join('\n- ')}`);
          }
          if (contentObj["Material Explanation / Brief Theory"]) {
            sections.push(`## Material Explanation / Brief Theory\n${contentObj["Material Explanation / Brief Theory"]}`);
          }
          if (contentObj["Summary (Temporary Conclusion)"]) {
            sections.push(`## Summary (Temporary Conclusion)\n${contentObj["Summary (Temporary Conclusion)"]}`);
          }
          const combinedContent = sections.join('\n\n');
          
          // Return properly typed result with both combined content and structured data
          return {
            content: combinedContent,
            structuredContent: {
              moduleIdentity: contentObj["Module Identity"],
              introduction: contentObj.Introduction,
              learningObjectives: contentObj["Learning Objectives"],
              materialExplanation: contentObj["Material Explanation / Brief Theory"],
              summary: contentObj["Summary (Temporary Conclusion)"]
            },
            questions: parsedResult.questions
          } as OllamaResponseType;
        } else {
          console.error("Content field is not an object with structured data after sanitization:", typeof parsedResult.content, parsedResult.content);
          throw new Error("Content field in AI response is not an object with structured data");
        }
      } catch (sanitizationError) {
        console.error("JSON parsing failed even after sanitization:", sanitizationError);
        console.error("Original error:", initialError);
        console.error("Problematic JSON (first 1000 chars):", jsonMatch[0].substring(0, 1000));
        throw new Error(`Could not parse JSON response: ${sanitizationError}`);
      }
    }
  } catch (error) {
    console.error("Error calling Ollama API:", error);
    throw error;
  }
}

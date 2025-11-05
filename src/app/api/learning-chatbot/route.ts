import { NextRequest } from "next/server";
import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";

interface ChatbotRequestBody {
  question: string;
  moduleId: string;
  level: string;
  context: string;
  conversationHistory: Array<{
    content: string;
    role: 'user' | 'assistant';
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatbotRequestBody = await req.json();
    const { question, moduleId, level, context, conversationHistory } = body;

    // Fetch essential module content with a single optimized query
    const moduleData = await db
      .select({
        moduleIdentity: moduleContents.moduleIdentity,
        learningObjectives: moduleContents.learningObjectives,
        materialExplanation: moduleContents.materialExplanation,
        summary: moduleContents.summary,
      })
      .from(moduleContents)
      .where(and(
        eq(moduleContents.moduleId, moduleId),
        eq(moduleContents.level, level)
      ));

    // Extract essential context information
    const moduleContext = moduleData.length > 0 ? moduleData[0] : null;

    // Create a concise prompt for the Ollama API
    const prompt = `You are an educational assistant for "${context}" at ${level} level.

Module Summary: ${moduleContext ? `${moduleContext.moduleIdentity || ''} ${moduleContext.summary || ''}` : ''}

Learning Objectives: ${moduleContext?.learningObjectives?.slice(0, 3).join(', ') || 'N/A'}

Key Concepts: ${moduleContext?.materialExplanation?.substring(0, 500) || ''}

Recent Conversation: ${conversationHistory.slice(-2).map(msg => `[${msg.role}]: ${msg.content}`).join(' | ') || 'N/A'}

Student Question: ${question}

Provide a concise, helpful response based on the module content. Keep it relevant to the learning objectives and student's level. If unsure, guide them to focus on the provided materials.`;

    // Call the Ollama API
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,  // Slightly higher for more engaging responses
          top_p: 0.9,
        }
      }),
    });

    if (!response.ok) {
      console.error("Ollama API error:", response.status, await response.text());
      return new Response(
        JSON.stringify({ 
          error: "Failed to get response from AI", 
          response: "I'm having trouble connecting to my knowledge base right now. Could you try asking your question again, or focus on the learning materials provided above?" 
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const data = await response.json();
    
    // Extract the response text
    const aiResponse = data.response || "I'm having trouble processing your question right now. Please try again or review the learning materials above.";
    
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in learning chatbot API:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        response: "I'm sorry, but I encountered an error processing your question. Please try again later." 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}
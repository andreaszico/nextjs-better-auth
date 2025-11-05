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

    // Fetch module content and questions to provide context to the AI
    const content = await db
      .select({
        moduleIdentity: moduleContents.moduleIdentity,
        introduction: moduleContents.introduction,
        learningObjectives: moduleContents.learningObjectives,
        materialExplanation: moduleContents.materialExplanation,
        summary: moduleContents.summary,
      })
      .from(moduleContents)
      .where(and(
        eq(moduleContents.moduleId, moduleId),
        eq(moduleContents.level, level)
      ));

    const questions = await db
      .select({
        question: items.question,
        answer: items.answer,
        explanation: items.explanation,
        questionType: items.questionType,
      })
      .from(items)
      .where(and(
        eq(items.moduleId, moduleId),
        eq(items.level, level),
        eq(items.type, "practice") // Include practice questions as context
      ))
      .limit(5); // Limit to avoid token issues

    // Create context for the AI
    const moduleContext = content.length > 0 ? {
      identity: content[0].moduleIdentity,
      introduction: content[0].introduction,
      objectives: content[0].learningObjectives,
      explanation: content[0].materialExplanation,
      summary: content[0].summary
    } : null;

    const previousQuestions = questions.map(q => 
      `Q: ${q.question}\nA: ${q.explanation || q.answer}`
    ).join('\n\n');

    // Create a prompt for the Ollama API
    const prompt = `You are an educational assistant helping a student learn about "${context}". 
    The student is at the ${level} level. Use the following module content to answer their question.

    Module Context:
    ${moduleContext ? `Identity: ${moduleContext.identity || 'N/A'}
    Introduction: ${moduleContext.introduction || 'N/A'}
    Learning Objectives: ${moduleContext.objectives?.join(', ') || 'N/A'}
    Material Explanation: ${moduleContext.explanation || 'N/A'}
    Summary: ${moduleContext.summary || 'N/A'}` : 'No specific module content available'}

    Example Questions and Answers:
    ${previousQuestions || 'No example questions available'}

    Conversation History:
    ${conversationHistory.slice(-4).map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`).join('\n')}  // Only last 4 messages for brevity

    Student Question: ${question}

    Provide a helpful, educational response that addresses the student's question based on the available module content. Keep the response relevant to the learning objectives and level of the student. If you don't have specific information about the topic, acknowledge this and guide the student to focus on the provided content.`;

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
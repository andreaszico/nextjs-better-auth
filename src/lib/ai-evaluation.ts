/**
 * Evaluates a short answer using the Ollama API with carefully engineered prompts
 * @param question The question text
 * @param correctAnswer The correct answer for reference
 * @param studentAnswer The student's answer
 * @returns An object with correctness and feedback
 */
export async function evaluateShortAnswer(
  question: string,
  correctAnswer: string | null,
  studentAnswer: string
): Promise<{ isCorrect: boolean; score: number; feedback: string }> {
  try {
    // Create a detailed prompt for the AI model with specific evaluation criteria
    const prompt = `You are an educational assessment expert. Evaluate the student's response to the given question. Apply consistent, fair academic standards.

INSTRUCTION:
- Analyze the student's answer for accuracy, completeness, and relevance to the question
- Compare against the correct answer for reference
- Be constructive and educational in your feedback
- Provide specific suggestions for improvement when appropriate

QUESTION: ${question}
STUDENT ANSWER: ${studentAnswer}
CORRECT ANSWER: ${correctAnswer || "Not provided for reference"}

Evaluate using this JSON format:
{
  "isCorrect": true/false,
  "score": number from 0.0 to 1.0 (where 1.0 = excellent, 0.0 = incorrect),
  "feedback": "Detailed, constructive feedback for the student with specific points about their answer"
}

SCORING GUIDELINES:
- 0.9-1.0: Answer is fully correct and comprehensive
- 0.7-0.8: Answer is mostly correct with minor omissions
- 0.5-0.6: Answer shows basic understanding but has errors
- 0.3-0.4: Answer shows limited understanding
- 0.0-0.2: Answer is substantially incorrect or off-topic

FEEDBACK TIPS:
- Acknowledge what the student did well
- Mention specific areas for improvement
- Provide constructive guidance
- Be encouraging but honest`;

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
          temperature: 0.3,  // Lower temperature for more consistent evaluation
          top_p: 0.9,
        }
      }),
    });

    if (!response.ok) {
      console.error("Ollama API error:", response.status, await response.text());
      // Fallback if AI evaluation fails
      return {
        isCorrect: false,
        score: 0,
        feedback: "AI evaluation temporarily unavailable. Please review the material and try again.",
      };
    }

    const data = await response.json();
    
    // Extract the response text and parse the JSON
    const responseText = data.response;
    
    // Find the JSON part in the response
    const jsonStart = responseText.indexOf("{");
    const jsonEnd = responseText.lastIndexOf("}") + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      console.error("Could not find JSON in AI response:", responseText);
      return {
        isCorrect: false,
        score: 0,
        feedback: "Unable to parse AI evaluation. Please review the material and try again.",
      };
    }
    
    const jsonString = responseText.substring(jsonStart, jsonEnd);
    const evaluation = JSON.parse(jsonString);
    
    return {
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      feedback: evaluation.feedback,
    };
  } catch (error) {
    console.error("Error in AI evaluation:", error);
    // Return a fallback result if AI evaluation fails
    return {
      isCorrect: false,
      score: 0,
      feedback: "AI evaluation temporarily unavailable. Please review the material and try again.",
    };
  }
}

/**
 * Evaluates an MCQ answer by checking for exact match or close match
 * @param correctAnswer The correct answer
 * @param studentAnswer The student's answer
 * @returns Whether the answer is correct and feedback
 */
export function evaluateMCQAnswer(
  correctAnswer: string | null,
  studentAnswer: string
): { isCorrect: boolean; feedback: string } {
  // Normalize answers for comparison (trim whitespace and convert to lowercase)
  const normalizedCorrect = correctAnswer?.toLowerCase().trim() || '';
  const normalizedStudent = studentAnswer.toLowerCase().trim();
  
  // Check for exact match
  const isCorrect = normalizedStudent === normalizedCorrect || 
                   normalizedStudent === correctAnswer?.trim() || // Check without lowercasing
                   normalizedStudent.includes(normalizedCorrect) || // Check if student answer contains correct answer
                   normalizedCorrect.includes(normalizedStudent); // Check reverse match

  return {
    isCorrect,
    feedback: isCorrect 
      ? "Correct! Well done." 
      : `Incorrect. The correct answer is: ${correctAnswer || 'N/A'}. Please review the material.`
  };
}
/**
 * Evaluates a short answer using the Ollama API with a detailed 3-dimension rubric
 * The feedback is provided separately from the database explanation field
 * @param question The question text
 * @param correctAnswer The correct answer for reference (used by AI for scoring)
 * @param studentAnswer The student's answer (used by AI for scoring)
 * @param explanation The explanation from the database (used as feedback)
 * @returns An object with correctness, score (from AI) and feedback (from database)
 */
export async function evaluateShortAnswer(
  question: string,
  correctAnswer: string | null,
  studentAnswer: string,
  explanation: string | null
): Promise<{ isCorrect: boolean; score: number; feedback: string }> {
  try {
    // Create a detailed prompt for the AI model to generate a score
    const prompt = `You are an educational assessment expert. Evaluate the student's response to the given question using the provided detailed rubric. Apply consistent, fair academic standards.

INSTRUCTION:
Read the QUESTION, STUDENT ANSWER, and (if present) the CORRECT ANSWER.
Assign an integer score (0–4) for each rubric dimension: "analysis", "understanding of concepts", and "configuration_implementation".
Be strict but fair; reward clear reasoning, correct concepts, and accurate/efficient procedures.
If CORRECT ANSWER is not provided, judge against generally accepted domain knowledge and internal consistency with the QUESTION.

RUBRIC:
1) Analysis
- 0: Unable to analyze at all.
- 1: Fails to correctly recognize the problem.
- 2: Recognizes symptoms only; lacks deeper analysis.
- 3: Identifies the problem and proposes a solution, though not fully precise.
- 4: Correctly identifies the problem, explains likely causes, and proposes relevant solutions.

2) Understanding of Concepts
- 0: No understanding.
- 1: Recalls terms only, without meaning.
- 2: Mentions basic concepts but explanations are thin or incomplete.
- 3: Explains concepts correctly; limited integration across topics.
- 4: Explains concepts clearly and connects across layers/topics.

3) Configuration & Implementation
- 0: No understanding of implementation.
- 1: Unable to configure/implement correctly.
- 2: Partially correct; many errors remain.
- 3: Correct with minimal guidance.
- 4: Correct, independent, and efficient configuration/implementation.

QUESTION: ${question}
STUDENT ANSWER: ${studentAnswer}
CORRECT ANSWER: ${correctAnswer || "Not provided for reference"}

Return ONLY this JSON (no extra text):
{
  "scores": {
    "analysis": 0-4,
    "understanding of concepts": 0-4,
    "configuration_implementation": 0-4
  }
}`;

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
        feedback: explanation || "AI evaluation temporarily unavailable. Please review the material and try again.",
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
        feedback: explanation || "Unable to parse AI evaluation. Please review the material and try again.",
      };
    }
    
    const jsonString = responseText.substring(jsonStart, jsonEnd);
    const evaluation = JSON.parse(jsonString);
    
    // Calculate average score and determine correctness in JavaScript
    const analysis = evaluation.scores.analysis;
    const understandingConcepts = evaluation.scores["understanding of concepts"];
    const configurationImplementation = evaluation.scores["configuration_implementation"];
    
    // Calculate average score: (sum of scores) / 12 (since max possible score is 4+4+4=12)
    const average_score = (analysis + understandingConcepts + configurationImplementation) / 12;
    
    // Determine if correct based on threshold
    const isCorrect = average_score >= 0.7;
    
    // Return the calculated score but use the database explanation as feedback
    return {
      isCorrect,
      score: average_score,
      feedback: explanation || "Please review the material.", // Use database explanation as feedback
    };
  } catch (error) {
    console.error("Error in AI evaluation:", error);
    // Return a fallback result if AI evaluation fails, still using database explanation
    return {
      isCorrect: false,
      score: 0,
      feedback: explanation || "AI evaluation temporarily unavailable. Please review the material and try again.",
    };
  }
}

/**
 * Evaluates an MCQ answer by checking for exact match or close match
 * @param correctAnswer The correct answer
 * @param studentAnswer The student's answer
 * @param explanation The explanation from the database
 * @returns Whether the answer is correct and feedback
 */
export function evaluateMCQAnswer(
  correctAnswer: string | null,
  studentAnswer: string,
  explanation: string | null
): { isCorrect: boolean; feedback: string } {
  // Normalize answers for comparison (trim whitespace and convert to lowercase)
  const normalizedCorrect = correctAnswer?.toLowerCase().trim() || '';
  const normalizedStudent = studentAnswer.toLowerCase().trim();
  
  // Check for exact match
  const isCorrect = normalizedStudent === normalizedCorrect || 
                   normalizedStudent === correctAnswer?.trim() || // Check without lowercasing
                   normalizedStudent.includes(normalizedCorrect) || // Check if student answer contains correct answer
                   normalizedCorrect.includes(normalizedStudent); // Check reverse match

  // Use explanation from database as feedback, fallback to basic feedback if not available
  const feedback = explanation || (isCorrect 
    ? "Correct! Well done." 
    : `Incorrect. The correct answer is: ${correctAnswer || 'N/A'}. Please review the material.`);

  return {
    isCorrect,
    feedback
  };
}
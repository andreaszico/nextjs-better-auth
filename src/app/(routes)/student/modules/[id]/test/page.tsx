"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface PostTestQuestion {
  id: string;
  question: string;
  options: string[] | null;
  questionType: "mcq" | "short";
  explanation: string | null;
}

export default function PostTestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const moduleId = params.id as string;
  const testType = searchParams.get("type") || "posttest";
  const level = searchParams.get("level") || "";
  
  const [questions, setQuestions] = useState<PostTestQuestion[]>([]);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [feedback, setFeedback] = useState<{[key: string]: {isCorrect: boolean, feedback: string}}>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [overallResult, setOverallResult] = useState<{passed: boolean, score: number, totalQuestions: number, correctAnswers: number} | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestionFeedback, setCurrentQuestionFeedback] = useState<{isCorrect: boolean, feedback: string} | null>(null);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`/api/student/modules/${moduleId}/test?level=${level}&type=${testType}`);
        if (response.ok) {
          const data = await response.json();
          setQuestions(data.questions);
        } else {
          toast.error(`Failed to load ${testType} questions`);
        }
      } catch (error) {
        console.error(`Error fetching ${testType} questions:`, error);
        toast.error(`Failed to load ${testType} questions`);
      } finally {
        setLoading(false);
      }
    };

    if (moduleId && level && testType) {
      fetchQuestions();
    }
  }, [moduleId, level, testType, toast]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    // Clear feedback when user changes their answer
    if (currentQuestionFeedback) {
      setCurrentQuestionFeedback(null);
    }
  };

  const handleSubmitCurrentQuestion = async () => {
    if (questions.length === 0) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    const userAnswer = answers[currentQuestion.id];
    
    if (!userAnswer || userAnswer.trim() === "") {
      toast.error("Please provide an answer before submitting");
      return;
    }
    
    setIsSubmittingQuestion(true);
    
    try {
      const response = await fetch(`/api/student/modules/${moduleId}/test/${currentQuestion.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: userAnswer,
          testType: testType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentQuestionFeedback({
          isCorrect: result.isCorrect,
          feedback: result.feedback
        });
        // Update the main feedback object too
        setFeedback(prev => ({
          ...prev,
          [currentQuestion.id]: {
            isCorrect: result.isCorrect,
            feedback: result.feedback
          }
        }));
      } else {
        toast.error("Failed to submit answer");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleSubmitTest = async () => {
    if (questions.length === 0) return;
    
    setSubmitting(true);
    
    try {
      // Submit all answers
      const response = await fetch(`/api/student/modules/${moduleId}/test/${testType}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleId,
          answers,
          level,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestCompleted(true);
        setOverallResult({
          passed: result.passed,
          score: result.score,
          totalQuestions: result.totalQuestions,
          correctAnswers: result.correctAnswers
        });
      } else {
        toast.error("Failed to submit test");
      }
    } catch (error) {
      console.error("Error submitting test:", error);
      toast.error("Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading {testType} questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No {testType} questions available</h3>
          <p className="text-gray-600">The {testType} for the {level} level has not been created yet.</p>
          <Link href={`/student/modules/${moduleId}?level=${level}`}>
            <Button variant="outline" className="mt-4">Back to Module</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (testCompleted && overallResult) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Test Results</h1>
          <p className="text-gray-600 mt-2">Your performance on the {testType}</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">
              <span className={overallResult.passed ? "text-green-600" : "text-red-600"}>
                {overallResult.passed ? "Passed!" : "Needs Improvement"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold mb-2">
              {Math.round(overallResult.score * 100)}%
            </div>
            <p className="text-gray-600 mb-4">
              {overallResult.correctAnswers} out of {overallResult.totalQuestions} questions correct
            </p>
            <div className="mt-6">
              <Link href={`/student/modules/${moduleId}?level=${level}`}>
                <Button variant="outline" className="mr-2">Back to Module</Button>
              </Link>
              <Link href="/student">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const userAnswer = answers[currentQuestion.id] || "";

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link href={`/student/modules/${moduleId}?level=${level}`}>
          <Button variant="outline" className="mb-4">← Back to Module</Button>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Post-test</h1>
            <p className="text-gray-600 mt-2">Assess your learning with this post-test</p>
          </div>
          <div className="flex space-x-2">
            <Badge variant="secondary" className="text-lg py-1 px-3">
              Level: {level.charAt(0).toUpperCase() + level.slice(1)}
            </Badge>
            <Badge variant="default" className="text-lg py-1 px-3 capitalize">
              {testType}
            </Badge>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestionIndex + 1} of {totalQuestions}</CardTitle>
            <div className="text-sm text-gray-500">
              {currentQuestion.questionType.toUpperCase()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-medium mb-4">{currentQuestion.question}</h3>
          
          {currentQuestion.questionType === "mcq" && currentQuestion.options && (
            <RadioGroup 
              value={userAnswer} 
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={option} id={`option-${index}-${currentQuestion.id}`} />
                  <Label htmlFor={`option-${index}-${currentQuestion.id}`}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
          
          {currentQuestion.questionType === "short" && (
            <Textarea
              value={userAnswer}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              className="mt-2"
              rows={4}
            />
          )}
          
          <div className="mt-4">
            <Button 
              onClick={handleSubmitCurrentQuestion} 
              disabled={isSubmittingQuestion || !userAnswer.trim()}
            >
              {isSubmittingQuestion ? "Evaluating..." : "Submit Answer"}
            </Button>
          </div>
          
          {currentQuestionFeedback && (
            <div className={`mt-4 p-4 rounded-md ${currentQuestionFeedback.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <p className={`font-medium ${currentQuestionFeedback.isCorrect ? 'text-green-800' : 'text-yellow-800'}`}>
                {currentQuestionFeedback.isCorrect ? 'Correct!' : 'Feedback:'}
              </p>
              <p className={`${currentQuestionFeedback.isCorrect ? 'text-green-700' : 'text-yellow-700'}`}>
                {currentQuestionFeedback.feedback}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button 
          onClick={() => {
            if (currentQuestionIndex > 0) {
              setCurrentQuestionIndex(currentQuestionIndex - 1);
              setCurrentQuestionFeedback(null);
            }
          }} 
          disabled={currentQuestionIndex === 0}
          variant="outline"
        >
          Previous
        </Button>
        
        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button 
            onClick={() => {
              if (currentQuestionIndex < totalQuestions - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
                setCurrentQuestionFeedback(null);
              }
            }}
          >
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmitTest} 
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Test"}
          </Button>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="flex space-x-1">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentQuestionIndex(index);
                setCurrentQuestionFeedback(null);
              }}
              className={`w-3 h-3 rounded-full ${
                index === currentQuestionIndex ? "bg-blue-500" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/db";
import { modules, items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getServerSession } from "@/lib/auth/get-session";
import { useToast } from "@/hooks/use-toast";

interface Item {
  id: string;
  question: string;
  options: string[] | null;
  questionType: "mcq" | "short";
  answer: string | null;
}

interface PretestQuestion {
  id: string;
  moduleId: string;
  question: string;
  options: string[] | null;
  questionType: "mcq" | "short";
  answer: string | null;
}

export default function PretestPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const moduleId = params.id as string;
  
  const [questions, setQuestions] = useState<PretestQuestion[]>([]);
  const [answers, setAnswers] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // In a real application, we would fetch from the server
        // For now, we'll simulate the data fetching
        const response = await fetch(`/api/student/modules/${moduleId}/pretest`);
        if (response.ok) {
          const data = await response.json();
          setQuestions(data.questions);
        } else {
          toast({
            title: "Error",
            description: "Failed to load pretest questions",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
        toast({
          title: "Error",
          description: "Failed to load pretest questions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) {
      fetchQuestions();
    }
  }, [moduleId, toast]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (questions.length === 0) return;
    
    setSubmitting(true);
    
    try {
      // Submit answers and get level assignment
      const response = await fetch(`/api/student/modules/${moduleId}/pretest/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleId,
          answers,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Redirect to content page based on assigned level
        router.push(`/student/modules/${moduleId}/content?level=${result.levelAssigned}`);
      } else {
        toast({
          title: "Error",
          description: "Failed to submit pretest",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting pretest:", error);
      toast({
        title: "Error",
        description: "Failed to submit pretest",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading pretest questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pretest questions available</h3>
          <p className="text-gray-600">This module does not have pretest questions set up.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Pretest Assessment</h1>
        <p className="text-gray-600 mt-2">Answer the following questions to determine your appropriate learning level</p>
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
              value={answers[currentQuestion.id] || ""} 
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
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              className="mt-2"
              rows={4}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button 
          onClick={handlePrevious} 
          disabled={currentQuestionIndex === 0}
          variant="outline"
        >
          Previous
        </Button>
        
        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Pretest"}
          </Button>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="flex space-x-1">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
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
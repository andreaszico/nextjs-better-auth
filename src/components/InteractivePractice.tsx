'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Question {
  id: string;
  question: string;
  questionType: string;
  options: string[] | null;
  answer: string | null;
  explanation: string | null;
}

interface InteractivePracticeProps {
  questions: Question[];
  moduleId: string;
  level: string;
}

export default function InteractivePractice({ questions, moduleId, level }: InteractivePracticeProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { isCorrect: boolean; feedback: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [allSubmitted, setAllSubmitted] = useState(false);

  // Initialize answers and submitted states
  useEffect(() => {
    const initialAnswers: Record<string, string> = {};
    const initialSubmitted: Record<string, boolean> = {};
    const initialLoading: Record<string, boolean> = {};
    
    questions.forEach(question => {
      initialAnswers[question.id] = '';
      initialSubmitted[question.id] = false;
      initialLoading[question.id] = false;
    });
    
    setAnswers(initialAnswers);
    setSubmitted(initialSubmitted);
    setLoading(initialLoading);
  }, [questions]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Reset submission status when answer changes
    setSubmitted(prev => ({
      ...prev,
      [questionId]: false
    }));
    
    setResults(prev => ({
      ...prev,
      [questionId]: {
        isCorrect: false,
        feedback: ''
      }
    }));
  };

  const handleSubmit = async (questionId: string) => {
    if (!answers[questionId] || answers[questionId].trim() === '') {
      alert('Please provide an answer before submitting.');
      return;
    }

    setLoading(prev => ({ ...prev, [questionId]: true }));

    try {
      const response = await fetch(`/api/student/modules/${moduleId}/practice/${questionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          answer: answers[questionId],
          questionType: questions.find(q => q.id === questionId)?.questionType,
          moduleId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      
      // Update results
      setResults(prev => ({
        ...prev,
        [questionId]: {
          isCorrect: data.isCorrect,
          feedback: data.feedback
        }
      }));
      
      // Mark as submitted
      setSubmitted(prev => ({
        ...prev,
        [questionId]: true
      }));
      
      // Check if all questions are submitted
      const allSub = questions.every(q => 
        q.id === questionId || submitted[q.id] || answers[q.id].trim() === ''
      ) && !allSubmitted;
      
      if (allSub) {
        const allAnswered = questions.every(q => 
          submitted[q.id] || (answers[q.id] && answers[q.id].trim() !== '')
        );
        if (allAnswered) {
          setAllSubmitted(true);
        }
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Error submitting answer. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleNextQuestion = (currentQuestionId: string) => {
    const currentIndex = questions.findIndex(q => q.id === currentQuestionId);
    if (currentIndex < questions.length - 1) {
      const nextQuestion = document.getElementById(`question-${questions[currentIndex + 1].id}`);
      if (nextQuestion) {
        nextQuestion.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="space-y-8">
      {questions.map((question, index) => (
        <Card key={question.id} id={`question-${question.id}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-base">{question.question}</span>
              <Badge variant={question.questionType === 'mcq' ? 'default' : 'secondary'}>
                {question.questionType.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              {question.questionType === 'mcq' ? (
                <RadioGroup 
                  value={answers[question.id] || ''} 
                  onValueChange={(value) => handleAnswerChange(question.id, value)}
                  className="space-y-2"
                >
                  {question.options?.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`option-${question.id}-${optIndex}`} />
                      <Label htmlFor={`option-${question.id}-${optIndex}`}>{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Type your answer here..."
                  rows={4}
                  className="mt-2"
                  disabled={submitted[question.id]}
                />
              )}
            </div>

            {!submitted[question.id] ? (
              <Button 
                onClick={() => handleSubmit(question.id)}
                disabled={loading[question.id] || !answers[question.id]?.trim()}
              >
                {loading[question.id] ? 'Submitting...' : 'Submit Answer'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-md ${results[question.id]?.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${results[question.id]?.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className={`font-medium ${results[question.id]?.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                      {results[question.id]?.isCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                  </div>
                  <p className={`font-medium ${results[question.id]?.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    Feedback: {results[question.id]?.feedback}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleAnswerChange(question.id, '')}
                    variant="outline"
                  >
                    Change Answer
                  </Button>
                  <Button 
                    onClick={() => handleNextQuestion(question.id)}
                    variant="secondary"
                  >
                    Next Question
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {allSubmitted && (
        <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Practice Complete!</h3>
          <p className="text-green-700">
            You've completed all practice questions for this module and level.
          </p>
        </div>
      )}
    </div>
  );
}
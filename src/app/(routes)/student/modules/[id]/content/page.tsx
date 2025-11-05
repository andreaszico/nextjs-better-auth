import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import InteractivePractice from "@/components/InteractivePractice";
import LearningChatbot from "@/components/LearningChatbot";

interface Props {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    level: string;
  }>;
}

export default async function ModuleContent(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await getServerSession();
  
  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  const moduleId = params.id;
  const level = searchParams.level as "easy" | "medium" | "high";

  // Validate level parameter
  if (!level || !["easy", "medium", "high"].includes(level)) {
    redirect(`/student/modules/${moduleId}/pretest`);
  }

  // Fetch the module
  const moduleResult = await db
    .select({
      id: modules.id,
      title: modules.title,
      description: modules.description,
    })
    .from(modules)
    .where(eq(modules.id, moduleId));

  if (!moduleResult.length) {
    redirect("/student/modules");
  }

  // Fetch content for the specific level
  const contentResult = await db
    .select()
    .from(moduleContents)
    .where(and(
      eq(moduleContents.moduleId, moduleId),
      eq(moduleContents.level, level)
    ));

  // Fetch practice questions for the specific level
  const practiceQuestions = await db
    .select({
      id: items.id,
      question: items.question,
      options: items.options,
      answer: items.answer,
      explanation: items.explanation,
      questionType: items.questionType,
    })
    .from(items)
    .where(and(
      eq(items.moduleId, moduleId),
      eq(items.level, level),
      eq(items.type, "practice")
    ));

  if (!contentResult.length) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content available for this level</h3>
          <p className="text-gray-600">The content for the {level} level has not been created yet.</p>
          <Link href={`/student/modules/${moduleId}/pretest`}>
            <Button variant="outline" className="mt-4">Retake Pretest</Button>
          </Link>
        </div>
      </div>
    );
  }

  const content = contentResult[0];

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-6">
        <Link href="/student">
          <Button variant="outline" className="mb-4">← Back to Dashboard</Button>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{moduleResult[0].title}</h1>
            <p className="text-gray-600 mt-2">{moduleResult[0].description}</p>
          </div>
          <Badge variant="secondary" className="text-lg py-1 px-3">
            Level: {level.charAt(0).toUpperCase() + level.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Learning Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {content.moduleIdentity && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Module Identity</h3>
                    <p className="text-gray-700">{content.moduleIdentity}</p>
                  </div>
                )}
                
                {content.introduction && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Introduction</h3>
                    <p className="text-gray-700">{content.introduction}</p>
                  </div>
                )}
                
                {content.learningObjectives && content.learningObjectives.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Learning Objectives</h3>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {content.learningObjectives.map((objective, i) => (
                        <li key={i}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {content.materialExplanation && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Material Explanation</h3>
                    <p className="text-gray-700 whitespace-pre-line">{content.materialExplanation}</p>
                  </div>
                )}
                
                {content.summary && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Summary</h3>
                    <p className="text-gray-700">{content.summary}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {practiceQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Practice Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <InteractivePractice 
                  questions={practiceQuestions} 
                  moduleId={moduleId} 
                  level={level} 
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <LearningChatbot 
            moduleId={moduleId} 
            level={level} 
            moduleTitle={moduleResult[0].title} 
          />
          
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex gap-2">
                <Link href={`/student/modules/${moduleId}/pretest`}>
                  <Button variant="outline">Retake Pretest</Button>
                </Link>
                <Link href={`/student/modules/${moduleId}/test?type=posttest&level=${level}`}>
                  <Button variant="secondary">Take Post-test</Button>
                </Link>
              </div>
              <Link href="/student">
                <Button>Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
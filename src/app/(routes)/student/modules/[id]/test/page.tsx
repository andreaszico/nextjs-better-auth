import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules, items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    type: string;
    level: string;
  }>;
}

export default async function ModuleTest(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await getServerSession();
  
  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  const moduleId = params.id;
  const testType = searchParams.type as "pretest" | "posttest";
  const level = searchParams.level as "easy" | "medium" | "high";

  // Validate test type and level parameters
  if (!testType || !["pretest", "posttest"].includes(testType) ||
      !level || !["easy", "medium", "high"].includes(level)) {
    redirect(`/student/modules/${moduleId}`);
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

  // Fetch test questions for the specific level and type
  const testQuestions = await db
    .select({
      id: items.id,
      question: items.question,
      options: items.options,
      questionType: items.questionType,
    })
    .from(items)
    .where(and(
      eq(items.moduleId, moduleId),
      eq(items.level, level),
      eq(items.type, testType)
    ));

  if (testQuestions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No {testType} questions available</h3>
          <p className="text-gray-600">The {testType} for the {level} level has not been created yet.</p>
          <Link href={`/student/modules/${moduleId}`}>
            <Button variant="outline" className="mt-4">Back to Module</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link href={`/student/modules/${moduleId}?level=${level}`}>
          <Button variant="outline" className="mb-4">← Back to Module</Button>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{moduleResult[0].title}</h1>
            <p className="text-gray-600 mt-2">{moduleResult[0].description}</p>
          </div>
          <div>
            <Badge variant="secondary" className="text-lg py-1 px-3 mr-2">
              Level: {level.charAt(0).toUpperCase() + level.slice(1)}
            </Badge>
            <Badge variant="default" className="text-lg py-1 px-3 capitalize">
              {testType}
            </Badge>
          </div>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{testType.charAt(0).toUpperCase() + testType.slice(1)} Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {testQuestions.map((question, index) => (
              <div key={question.id} className="border-b pb-6 last:border-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="font-medium bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium text-lg">{question.question}</h3>
                    
                    {question.options && question.options.length > 0 && (
                      <div className="mt-3 ml-2 space-y-2">
                        {question.options.map((option, i) => (
                          <div key={i} className="flex items-center">
                            <span className="mr-2 text-gray-500 font-medium">{String.fromCharCode(65 + i)}.</span>
                            <span>{option}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Link href={`/student/modules/${moduleId}?level=${level}`}>
          <Button variant="outline">Back to Module</Button>
        </Link>
        <Button>Submit {testType.charAt(0).toUpperCase() + testType.slice(1)}</Button>
      </div>
    </div>
  );
}
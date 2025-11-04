import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth/get-session";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function ModuleDetails(props: Props) {
  const params = await props.params;
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  // Ensure params.id is properly accessed
  const moduleId = params.id;
  
  // Validate the module ID exists
  if (!moduleId) {
    redirect("/instructor/modules");
  }

  // Fetch the specific module
  const module = await db
    .select()
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);

  console.log("Module query result:", module); // Debug log
  console.log("Session user ID:", session?.user?.id); // Debug log
  console.log("Module instructor ID:", module[0]?.instructorId); // Debug log

  if (!module.length) {
    // Module with this ID doesn't exist
    console.error(`Module not found with ID: ${moduleId}`);
    redirect("/instructor/modules");
  }
  
  if (module[0].instructorId !== session.user.id) {
    // Module belongs to a different instructor
    console.error(`Module ${moduleId} belongs to different instructor. Access denied.`);
    console.error(`Expected: ${session.user.id}, Got: ${module[0].instructorId}`);
    redirect("/instructor/modules");
  }

  // Fetch module contents and items
  const contents = await db
    .select()
    .from(moduleContents)
    .where(eq(moduleContents.moduleId, moduleId)); // Use moduleId instead of params.id

  const moduleItems = await db
    .select()
    .from(items)
    .where(eq(items.moduleId, moduleId)); // Use moduleId instead of params.id

  // Group questions by type and level
  const groupedItems: Record<string, any[]> = {};
  moduleItems.forEach(item => {
    const key = `${item.level}-${item.questionType}`;
    if (!groupedItems[key]) {
      groupedItems[key] = [];
    }
    groupedItems[key].push(item);
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/instructor/modules">
          <Button variant="outline" className="mb-4">← Back to Modules</Button>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{module[0].title}</h1>
            <p className="text-gray-600 mt-2">{module[0].description}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Created</div>
            <div>{module[0].createdAt?.toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Module Contents Section */}
        <Card>
          <CardHeader>
            <CardTitle>Module Contents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {contents.map(content => (
              <div key={content.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold capitalize">{content.level}</h3>
                  <Badge variant="secondary">{content.level}</Badge>
                </div>
                <div className="space-y-4 text-gray-700">
                  {content.moduleIdentity && (
                    <div>
                      <h4 className="font-semibold text-lg">Module Identity</h4>
                      <p>{content.moduleIdentity}</p>
                    </div>
                  )}
                  {content.introduction && (
                    <div>
                      <h4 className="font-semibold text-lg">Introduction</h4>
                      <p>{content.introduction}</p>
                    </div>
                  )}
                  {content.learningObjectives && content.learningObjectives.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-lg">Learning Objectives</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {content.learningObjectives.map((objective, i) => (
                          <li key={i}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {content.materialExplanation && (
                    <div>
                      <h4 className="font-semibold text-lg">Material Explanation / Brief Theory</h4>
                      <p>{content.materialExplanation}</p>
                    </div>
                  )}
                  {content.summary && (
                    <div>
                      <h4 className="font-semibold text-lg">Summary (Temporary Conclusion)</h4>
                      <p>{content.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {Object.entries(groupedItems).map(([key, questions]) => {
              const [level, questionType] = key.split('-');
              return (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold capitalize">
                      {level} {questionType.toUpperCase()} Questions
                    </h3>
                    <div className="flex gap-2">
                      <Badge variant="outline">{level}</Badge>
                      <Badge variant="outline">{questionType.toUpperCase()}</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <span className="font-medium">Q{index + 1}:</span>
                          <div>
                            <p className="font-medium">{question.question}</p>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {question.options.map((option, i) => (
                                  <div key={i} className="flex items-center">
                                    <span className="mr-2 text-gray-500">{String.fromCharCode(65 + i)}.</span>
                                    <span>{option}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 text-sm text-gray-600">
                              <p><span className="font-medium">Answer:</span> {question.answer}</p>
                              <p><span className="font-medium">Explanation:</span> {question.explanation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
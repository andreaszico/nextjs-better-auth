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
  params: {
    id: string;
  };
}

export default async function ModuleDetails({ params }: Props) {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  // Fetch the specific module
  const module = await db
    .select()
    .from(modules)
    .where(eq(modules.id, params.id))
    .limit(1);

  if (!module.length || module[0].instructorId !== session.user.id) {
    redirect("/instructor/modules");
  }

  // Fetch module contents and items
  const contents = await db
    .select()
    .from(moduleContents)
    .where(eq(moduleContents.moduleId, params.id));

  const moduleItems = await db
    .select()
    .from(items)
    .where(eq(items.moduleId, params.id));

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
                <div className="prose max-w-none text-gray-700">
                  {content.content.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
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
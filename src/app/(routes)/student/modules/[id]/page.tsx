import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function SelectModule(props: Props) {
  const params = await props.params;
  const session = await getServerSession();
  
  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  const moduleId = params.id;

  // Fetch the specific module
  const module = await db
    .select({
      id: modules.id,
      title: modules.title,
      description: modules.description,
      createdAt: modules.createdAt,
    })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);

  if (!module.length) {
    redirect("/student/modules");
  }

  // Check if there are pretest questions for this module
  const pretestQuestions = await db
    .select({ id: items.id })
    .from(items)
    .where(and(
      eq(items.moduleId, moduleId),
      eq(items.type, "pretest")
    ));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/student/modules">
          <Button variant="outline" className="mb-4">← Back to Modules</Button>
        </Link>
        
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{module[0].title}</h1>
          <p className="text-gray-600 mt-2">{module[0].description}</p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>About this Module</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">What you'll learn</h3>
              <p className="text-gray-600 mt-1">This module contains content and exercises at different difficulty levels to help you master the concepts.</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900">How it works</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600 mt-1">
                <li>Take the pretest to assess your current level</li>
                <li>We'll assign you an appropriate level (Easy, Medium, or High)</li>
                <li>Receive personalized content based on your level</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href={`/student/modules/${moduleId}/pretest`} className="flex-1">
          <Button 
            size="lg" 
            className="w-full"
            disabled={pretestQuestions.length === 0}
          >
            {pretestQuestions.length === 0 ? "No Pretest Available" : "Start Pretest"}
          </Button>
        </Link>
        
        <Link href="/student/modules" className="flex-1">
          <Button variant="outline" size="lg" className="w-full">Browse Other Modules</Button>
        </Link>
      </div>

      {pretestQuestions.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">
            Note: This module doesn't have a pretest set up yet. Please contact your instructor.
          </p>
        </div>
      )}
    </div>
  );
}
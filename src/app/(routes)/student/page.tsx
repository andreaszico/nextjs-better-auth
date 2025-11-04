import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { studentProgress } from "@/db/schema/studentProgress";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function StudentDashboard() {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  // Fetch all available modules from instructors
  const availableModules = await db
    .select({
      id: modules.id,
      title: modules.title,
      description: modules.description,
      createdAt: modules.createdAt,
    })
    .from(modules);

  // Fetch student's recent progress
  const recentProgress = await db
    .select({
      id: studentProgress.id,
      moduleId: studentProgress.moduleId,
      levelAssigned: studentProgress.levelAssigned,
      startDate: studentProgress.startDate,
      status: studentProgress.status,
      moduleTitle: modules.title,
    })
    .from(studentProgress)
    .innerJoin(modules, eq(studentProgress.moduleId, modules.id))
    .where(eq(studentProgress.studentId, session.user.id))
    .orderBy(desc(studentProgress.startDate))
    .limit(3);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-2">Select a module to begin your learning journey</p>
      </div>

      {/* Show progress if student has started modules */}
      {recentProgress.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Continue Learning</h2>
            <Link href="/student/progress">
              <Button variant="outline">View All Progress</Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentProgress.map((progress) => (
              <Card key={progress.id} className="overflow-hidden h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{progress.moduleTitle}</CardTitle>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Level: <span className="capitalize">{progress.levelAssigned}</span></span>
                    <span className="text-gray-500">{progress.status}</span>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Link href={`/student/modules/${progress.moduleId}/content?level=${progress.levelAssigned}`}>
                    <Button className="w-full">
                      {progress.status === "in_progress" ? "Continue Learning" : "Review Content"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Available Modules</h2>
          <Link href="/student/modules">
            <Button variant="outline">View All Modules</Button>
          </Link>
        </div>

        {availableModules.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No modules available yet</h3>
            <p className="text-gray-600">Please check back later for new modules</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableModules.slice(0, 6).map((module) => (
              <Card key={module.id} className="overflow-hidden h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>
                    {module.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Created: {module.createdAt?.toLocaleDateString()}
                    </span>
                    <Link href={`/student/modules/${module.id}`}>
                      <Button variant="outline" size="sm">Select Module</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">How it works</h3>
        <ol className="list-decimal pl-5 space-y-2 text-gray-600">
          <li>Select a module that interests you</li>
          <li>Take the pretest to determine your appropriate level</li>
          <li>Get personalized content based on your level</li>
          <li>Learn and practice at your own pace</li>
        </ol>
      </div>
    </div>
  );
}
import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function StudentModules() {
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Available Modules</h1>
          <Link href="/student">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
        <p className="text-gray-600 mt-2">Select a module to begin your learning journey</p>
      </div>

      {availableModules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules available yet</h3>
          <p className="text-gray-600">Please check back later for new modules</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableModules.map((module) => (
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
  );
}
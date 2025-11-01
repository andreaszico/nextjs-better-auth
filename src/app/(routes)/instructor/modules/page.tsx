import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth/get-session";

export default async function InstructorModules() {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  // Fetch modules for this instructor
  const userModules = await db
    .select()
    .from(modules)
    .where(eq(modules.instructorId, session.user.id));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Modules</h1>
        <Link href="/instructor">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      {userModules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No modules yet</h3>
          <p className="text-gray-600 mb-4">Upload your first module to get started</p>
          <Link href="/instructor">
            <Button>Upload Module</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userModules.map((module) => (
            <Card key={module.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <CardDescription>
                  {module.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Created: {module.createdAt?.toLocaleDateString()}
                  </span>
                  <Link href={`/instructor/modules/${module.id}`}>
                    <Button variant="outline" size="sm">View Details</Button>
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
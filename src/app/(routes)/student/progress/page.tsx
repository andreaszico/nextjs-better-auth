import { redirect } from "next/navigation";
import { db } from "@/db";
import { modules } from "@/db/schema/modules";
import { studentProgress } from "@/db/schema/studentProgress";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function StudentProgressPage() {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  // Fetch student's progress records
  const progressRecords = await db
    .select({
      id: studentProgress.id,
      moduleId: studentProgress.moduleId,
      levelAssigned: studentProgress.levelAssigned,
      startDate: studentProgress.startDate,
      status: studentProgress.status,
      moduleTitle: modules.title,
      moduleDescription: modules.description,
    })
    .from(studentProgress)
    .innerJoin(modules, eq(studentProgress.moduleId, modules.id))
    .where(eq(studentProgress.studentId, session.user.id))
    .orderBy(desc(studentProgress.startDate));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Learning Progress</h1>
        <p className="text-gray-600 mt-2">Track your modules and learning journey</p>
      </div>

      {progressRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {progressRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden h-full flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{record.moduleTitle}</CardTitle>
                    <CardDescription>
                      {record.moduleDescription}
                    </CardDescription>
                  </div>
                  <Badge variant={record.status === "completed" ? "default" : "secondary"}>
                    {record.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Level:</span>
                    <span className="font-medium capitalize">{record.levelAssigned}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Started:</span>
                    <span>{record.startDate?.toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Link href={`/student/modules/${record.moduleId}/content?level=${record.levelAssigned}`}>
                    <Button className="w-full">
                      {record.status === "in_progress" ? "Continue Learning" : "Review Content"}
                    </Button>
                  </Link>
                  
                  <Link href={`/student/modules/${record.moduleId}/test?type=posttest&level=${record.levelAssigned}`}>
                    <Button variant="outline" className="w-full">
                      Take Post-test
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No learning progress yet</h3>
          <p className="text-gray-600 mb-4">Start learning by selecting a module</p>
          <Link href="/student/modules">
            <Button>Browse Modules</Button>
          </Link>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/student/modules">
          <Button variant="outline">Explore More Modules</Button>
        </Link>
      </div>
    </div>
  );
}
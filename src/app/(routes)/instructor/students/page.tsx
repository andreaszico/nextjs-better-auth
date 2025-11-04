import { redirect } from "next/navigation";
import { db } from "@/db";
import { user } from "@/db/schema/auth/user";
import { studentProgress } from "@/db/schema/studentProgress";
import { modules } from "@/db/schema/modules";
import { eq, and, not, desc } from "drizzle-orm";
import { getServerSession } from "@/lib/auth/get-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InstructorStudents() {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  // Fetch all students (users who are not instructors)
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(not(eq(user.role, "instructor")));

  // Fetch student progress data
  const studentProgressData = await db
    .select({
      studentId: studentProgress.studentId,
      studentName: user.name,
      moduleId: studentProgress.moduleId,
      moduleTitle: modules.title,
      levelAssigned: studentProgress.levelAssigned,
      status: studentProgress.status,
      startDate: studentProgress.startDate,
    })
    .from(studentProgress)
    .innerJoin(user, eq(studentProgress.studentId, user.id))
    .innerJoin(modules, eq(studentProgress.moduleId, modules.id))
    .orderBy(desc(studentProgress.startDate))
    .limit(10); // Get recent progress from all students

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your Students</h1>
        <p className="text-gray-600">Manage and track your students' progress</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Student List</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{student.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Student Activity</h2>
          <Card>
            <CardHeader>
              <CardTitle>Learning Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {studentProgressData.length > 0 ? (
                <div className="space-y-4">
                  {studentProgressData.map((progress, index) => (
                    <div key={index} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{progress.studentName}</p>
                          <p className="text-sm text-gray-600">{progress.moduleTitle}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
                            {progress.levelAssigned}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">{progress.status}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Started: {progress.startDate?.toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No student progress data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
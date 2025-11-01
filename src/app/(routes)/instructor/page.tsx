import { redirect } from "next/navigation";
import ModuleUploadForm from "@/components/ModuleUploadForm";
import { getServerSession } from "@/lib/auth/get-session";

export default async function InstructorDashboard() {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
          <p className="text-gray-600">Manage your modules and student progress</p>
        </div>

          <ModuleUploadForm />

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Modules</h2>
          <p className="text-gray-600">Your modules will appear here once uploaded.</p>
        </div>
      </div>
    </div>
  );
}
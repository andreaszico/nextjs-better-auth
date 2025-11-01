import { redirect } from "next/navigation";
import { makeInstructor } from "@/lib/auth/server-utils";
import { getServerSession } from "@/lib/auth/get-session";

export default async function AccountPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/api/auth/sign-in");
  }

  // Check if user is an admin to show promote option
  const isAdmin = session.user.email === process.env.ADMIN_EMAIL; // You can set this in your .env

  const promoteToInstructor = async () => {
    'use server';
    
    const currentSession = await getServerSession();
    if (!currentSession) {
      return { error: "Not authenticated" };
    }
    
    if (currentSession.user.email !== process.env.ADMIN_EMAIL) {
      return { error: "Unauthorized" };
    }
    
    const result = await makeInstructor(currentSession.user.id);
    if (result.success) {
      // Revalidate session or redirect
      redirect('/account');
    }
    
    return result;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Account</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Profile Information</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-gray-600"><span className="font-medium">Name:</span> {session.user.name}</p>
          </div>
          <div>
            <p className="text-gray-600"><span className="font-medium">Email:</span> {session.user.email}</p>
          </div>
          <div>
            <p className="text-gray-600"><span className="font-medium">Role:</span> {session.user.role}</p>
          </div>
          <div>
            <p className="text-gray-600"><span className="font-medium">Gender:</span> {session.user.gender ? 'Prefer not to say' : 'Specified'}</p>
          </div>
        </div>

        {isAdmin && session.user.role !== 'instructor' && (
          <form action={promoteToInstructor} className="mt-6">
            <button 
              type="submit" 
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Become Instructor
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
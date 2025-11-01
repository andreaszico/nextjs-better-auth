import { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/auth/get-session";

export default async function InstructorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  
  if (!session || session.user.role !== "instructor") {
    redirect("/api/auth/sign-in");
  }

  return (
    <div className="min-h-screen flex">
      <nav className="w-64 bg-gray-800 text-white min-h-screen p-4">
        <h2 className="text-xl font-bold mb-6">Instructor Panel</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/instructor">
              <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
            </Link>
          </li>
          <li>
            <Link href="/instructor/modules">
              <Button variant="ghost" className="w-full justify-start">Modules</Button>
            </Link>
          </li>
          <li>
            <Link href="/instructor/students">
              <Button variant="ghost" className="w-full justify-start">Students</Button>
            </Link>
          </li>
        </ul>
      </nav>
      
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
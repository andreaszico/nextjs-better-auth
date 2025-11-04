import { getServerSession } from "@/lib/auth/get-session";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session || session.user.role !== "student") {
    redirect("/api/auth/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">LearnSmart</h1>
            </div>
            <nav className="flex space-x-4">
              <Link href="/student">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link href="/student/modules">
                <Button variant="ghost">Modules</Button>
              </Link>
              <Link href="/student/progress">
                <Button variant="ghost">My Progress</Button>
              </Link>
              <Link href="/account">
                <Button variant="ghost">Account</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="bg-white mt-12 border-t">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} LearnSmart. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
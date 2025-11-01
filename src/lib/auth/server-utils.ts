import { db } from "@/db";
import { user } from "@/db/schema/auth/user";
import { eq } from "drizzle-orm";

export async function makeInstructor(userId: string) {
  try {
    await db
      .update(user)
      .set({ role: "instructor" })
      .where(eq(user.id, userId));
    
    return { success: true };
  } catch (error) {
    console.error("Error making user instructor:", error);
    return { success: false, error: "Failed to update user role" };
  }
}
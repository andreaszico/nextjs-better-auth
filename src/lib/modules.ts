import { db } from "@/db";
import { modules, moduleContents, items } from "@/db/schema/modules";
import { eq } from "drizzle-orm";

export async function getInstructorModules(instructorId: string) {
  return await db
    .select()
    .from(modules)
    .where(eq(modules.instructorId, instructorId));
}

export async function getModuleWithContentsAndItems(moduleId: string) {
  const module = await db
    .select()
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);
  
  if (module.length === 0) return null;

  const contents = await db
    .select()
    .from(moduleContents)
    .where(eq(moduleContents.moduleId, moduleId));

  const moduleItems = await db
    .select()
    .from(items)
    .where(eq(items.moduleId, moduleId));

  return {
    module: module[0],
    contents,
    items: moduleItems,
  };
}

export async function deleteModule(moduleId: string, instructorId: string) {
  // Transaction to delete module and all related content
  return await db.transaction(async (tx) => {
    // First delete items (questions)
    await tx.delete(items).where(eq(items.moduleId, moduleId));
    
    // Then delete module contents
    await tx.delete(moduleContents).where(eq(moduleContents.moduleId, moduleId));
    
    // Finally delete the module itself
    await tx.delete(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.instructorId, instructorId)));
  });
}
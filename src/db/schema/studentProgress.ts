import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth/user";
import { modules } from "./modules";
import { relations } from "drizzle-orm";

export const studentProgress = pgTable("student_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: text("student_id")
    .references(() => user.id)
    .notNull(),
  moduleId: uuid("module_id")
    .references(() => modules.id)
    .notNull(),
  levelAssigned: text("level_assigned").notNull(), // Store level as text
  pretestScore: text("pretest_score"), // Store as JSON string if needed
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  status: text("status").default("in_progress"), // in_progress, completed
  createdAt: timestamp("created_at").defaultNow(),
});

export const studentProgressRelations = relations(studentProgress, ({ one }) => ({
  student: one(user, {
    fields: [studentProgress.studentId],
    references: [user.id],
  }),
  module: one(modules, {
    fields: [studentProgress.moduleId],
    references: [modules.id],
  }),
}));
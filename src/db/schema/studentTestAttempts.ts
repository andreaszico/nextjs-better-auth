import { pgTable, uuid, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth/user";
import { modules } from "./modules";
import { items } from "./modules";
import { relations } from "drizzle-orm";

export const testAttemptTypeEnum = pgEnum("test_attempt_type", ["pretest", "posttest", "practice"]);

export const studentTestAttempts = pgTable("student_test_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: text("student_id")
    .references(() => user.id)
    .notNull(),
  moduleId: uuid("module_id")
    .references(() => modules.id)
    .notNull(),
  testType: testAttemptTypeEnum("test_type").notNull(), // pretest, posttest, practice
  level: text("level").notNull(), // easy, medium, high
  score: numeric("score", { precision: 3, scale: 2 }), // Store score as decimal (e.g., 0.85)
  totalQuestions: numeric("total_questions"), // Total number of questions
  correctAnswers: numeric("correct_answers"), // Number of correct answers
  status: text("status").default("completed"), // completed, in_progress
  attemptDate: timestamp("attempt_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studentAnswers = pgTable("student_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .references(() => studentTestAttempts.id)
    .notNull(),
  questionId: uuid("question_id")
    .references(() => items.id)
    .notNull(),
  studentAnswer: text("student_answer").notNull(),
  isCorrect: text("is_correct").default("false"), // boolean stored as text for flexibility
  score: numeric("score", { precision: 3, scale: 2 }), // Score for this specific question (0.00 to 1.00)
  feedback: text("feedback"), // Feedback provided to the student
  answeredAt: timestamp("answered_at").defaultNow(),
});

export const studentTestAttemptsRelations = relations(studentTestAttempts, ({ one, many }) => ({
  student: one(user, {
    fields: [studentTestAttempts.studentId],
    references: [user.id],
  }),
  module: one(modules, {
    fields: [studentTestAttempts.moduleId],
    references: [studentTestAttempts.moduleId],
  }),
  answers: many(studentAnswers),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  attempt: one(studentTestAttempts, {
    fields: [studentAnswers.attemptId],
    references: [studentAnswers.attemptId],
  }),
  question: one(items, {
    fields: [studentAnswers.questionId],
    references: [studentAnswers.questionId],
  }),
}));
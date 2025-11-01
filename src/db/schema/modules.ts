import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth/user";
import { relations } from "drizzle-orm";

export const moduleLevelEnum = pgEnum("level", ["easy", "medium", "high"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "short"]);
export const itemTypeEnum = pgEnum("type", ["pretest", "practice", "posttest"]);

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  instructorId: text("instructor_id").references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const moduleContents = pgTable("module_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .references(() => modules.id)
    .notNull(),
  level: moduleLevelEnum("level").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .references(() => modules.id)
    .notNull(),
  level: moduleLevelEnum("level").notNull(),
  type: itemTypeEnum("type").notNull(),
  questionType: questionTypeEnum("question_type").notNull(),
  question: text("question").notNull(),
  options: text("options").array(),
  answer: text("answer"),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const modulesRelations = relations(modules, ({ one, many }) => ({
  instructor: one(user, {
    fields: [modules.instructorId],
    references: [user.id],
  }),
  moduleContents: many(moduleContents),
  items: many(items),
}));

export const moduleContentsRelations = relations(moduleContents, ({ one }) => ({
  module: one(modules, {
    fields: [moduleContents.moduleId],
    references: [modules.id],
  }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  module: one(modules, {
    fields: [items.moduleId],
    references: [modules.id],
  }),
}));
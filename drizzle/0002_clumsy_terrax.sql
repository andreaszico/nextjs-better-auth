ALTER TABLE "module_contents" ADD COLUMN "module_identity" text;--> statement-breakpoint
ALTER TABLE "module_contents" ADD COLUMN "introduction" text;--> statement-breakpoint
ALTER TABLE "module_contents" ADD COLUMN "learning_objectives" text[];--> statement-breakpoint
ALTER TABLE "module_contents" ADD COLUMN "material_explanation" text;--> statement-breakpoint
ALTER TABLE "module_contents" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "module_contents" DROP COLUMN "content";
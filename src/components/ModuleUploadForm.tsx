"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";

const moduleUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  content: z.string().min(10, "Content is required"),
  level: z.enum(["easy", "medium", "high"] as const).nullable(),
});

export type ModuleUploadValues = z.infer<typeof moduleUploadSchema>;

export default function ModuleUploadForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ModuleUploadValues>({
    resolver: zodResolver(moduleUploadSchema),
    defaultValues: {
      title: "",
      description: "",
      content: "",
      level: null,
    },
  });

  function onSubmit(data: ModuleUploadValues) {
    // Validate that level is selected since zod doesn't handle null validation the same way
    if (!data.level) {
      toast.error("Error", {
        description: "Please select a difficulty level",
      });
      return;
    }
    
    startTransition(async () => {
      try {
        const response = await fetch("/api/modules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to upload module");
        }

        toast("Success!", {
          description: result.message,
        });

        // After successful submission, reset only the level selection
        form.setValue("level", null);
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error("Error", {
          description: error.message || "An unexpected error occurred",
        });
      }
    });
  }

  const handleLevelSelect = (level: "easy" | "medium" | "high") => {
    form.setValue("level", level);
  };

  const getInputClassName = (fieldName: keyof ModuleUploadValues) =>
    cn(
      form.formState.errors[fieldName] &&
        "border-destructive/80 text-destructive focus-visible:border-destructive/80 focus-visible:ring-destructive/20",
    );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Upload New Module</h2>
          <p className="text-gray-600">Create educational content and questions for your students</p>
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Module Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter module title"
                    className={cn("peer ps-9", getInputClassName("title"))}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter module description"
                    className={cn("peer ps-9", getInputClassName("description"))}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Module Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Paste or type the educational content for this module"
                    className={cn("peer ps-9", getInputClassName("content"))}
                    rows={8}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-sm text-gray-500 mt-1">
                  This content will be used by the AI to generate educational materials and questions
                </p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={() => (
              <FormItem>
                <FormLabel className="block mb-2">Difficulty Level</FormLabel>
                <div className="flex space-x-4">
                  {(["easy", "medium", "high"] as const).map((level) => (
                    <button
                      key={level}
                      className={`px-4 py-2 rounded-md border ${
                        form.getValues("level") === level
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                      onClick={() => handleLevelSelect(level)}
                      disabled={isPending}
                      type="button"
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-6">
          <Button type="submit" disabled={isPending || !form.formState.isValid || !form.getValues("level")} className="w-full">
            {isPending ? "Processing with AI..." : "Upload Module for Selected Level"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
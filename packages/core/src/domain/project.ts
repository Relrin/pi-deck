import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  path: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime(),
  sessionIds: z.array(z.string()),
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectSummarySchema = ProjectSchema.pick({
  id: true,
  path: true,
  displayName: true,
  lastOpenedAt: true,
});

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

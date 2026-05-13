import { z } from "zod";

export const SessionSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  model: z.string().optional(),
  lastActivityAt: z.string().datetime(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

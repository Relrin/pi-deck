import { z } from "zod";

const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const RequestFrameSchema = z.object({
  kind: z.literal("request"),
  id: z.string().min(1),
  cmd: z.string().min(1),
  payload: z.unknown(),
});

export const ResponseOkFrameSchema = z.object({
  kind: z.literal("response"),
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

export const ResponseErrFrameSchema = z.object({
  kind: z.literal("response"),
  id: z.string().min(1),
  ok: z.literal(false),
  error: ErrorSchema,
});

export const EventFrameSchema = z.object({
  kind: z.literal("event"),
  topic: z.string().min(1),
  payload: z.unknown(),
});

// z.discriminatedUnion would be tidier but it rejects schemas where two variants share a
// discriminator literal (here: both ResponseOk and ResponseErr use kind="response"). Use a
// plain union and let zod try each variant.
export const FrameSchema = z.union([
  RequestFrameSchema,
  ResponseOkFrameSchema,
  ResponseErrFrameSchema,
  EventFrameSchema,
]);

export type RequestFrame = z.infer<typeof RequestFrameSchema>;
export type ResponseOkFrame = z.infer<typeof ResponseOkFrameSchema>;
export type ResponseErrFrame = z.infer<typeof ResponseErrFrameSchema>;
export type ResponseFrame = ResponseOkFrame | ResponseErrFrame;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type Frame = z.infer<typeof FrameSchema>;

export type FrameError = z.infer<typeof ErrorSchema>;

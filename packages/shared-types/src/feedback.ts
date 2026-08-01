import { z } from "zod";
import { FeedbackRating } from "./enums";

export const SubmitFeedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum([FeedbackRating.LIKE, FeedbackRating.DISLIKE]),
  comment: z.string().max(1000).optional(),
});
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;

export const FeedbackSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: z.enum([FeedbackRating.LIKE, FeedbackRating.DISLIKE]),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

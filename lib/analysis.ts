import { z } from "zod";

export const answerSchema = z.object({
  similar: z.enum(["No", "Yes", "Yes, but I want an upgrade"]),
  wantedFor: z.enum(["Just today", "About a week", "More than a month"]),
  usage: z.enum(["Daily", "Weekly", "Monthly", "Rarely"]),
});

export const recommendationSchema = z.object({
  productName: z.string(),
  price: z.string(),
  category: z.string(),
  verdict: z.enum(["BUY", "WAIT", "SKIP"]),
  dealQuality: z.number().int().min(0).max(100),
  impulseRisk: z.number().int().min(0).max(100),
  practicalValue: z.number().int().min(0).max(100),
  regretRisk: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).length(3),
  futureYouSays: z.string(),
});

export type Answers = z.infer<typeof answerSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;

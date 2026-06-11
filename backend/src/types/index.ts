import { z } from 'zod';

export const ApifyReviewSchema = z.object({
  reviewId: z.string().optional(),
  name: z.string().optional(),           // reviewer name
  stars: z.number().int().min(1).max(5),
  text: z.string().nullish(),
  publishedAtDate: z.string().optional(),
  language: z.string().optional(),
  // Restaurant metadata — same value on every review item for a given place
  title: z.string().optional(),
  placeId: z.string().optional(),
  totalScore: z.number().optional(),
  reviewsCount: z.number().int().optional(),
  price: z.string().optional(),
  imageUrl: z.string().optional(),
  categoryName: z.string().optional(),
});

export type ApifyReview = z.infer<typeof ApifyReviewSchema>;

export interface ApifyRestaurantMeta {
  placeId?: string;
  rating?: number;
  totalReviews?: number;
  imageUrl?: string;
  cuisine?: string;
  priceLevel?: string;
}

export const InsightCategorySchema = z.enum([
  'food_quality',
  'service',
  'ambiance',
  'pricing',
  'hygiene',
  'staff',
  'wait_time',
  'overall',
]);

export type InsightCategory = z.infer<typeof InsightCategorySchema>;

export const PrioritySchema = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

export const SentimentSchema = z.enum(['positive', 'negative', 'mixed', 'neutral']);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const GeneratedInsightSchema = z.object({
  category: InsightCategorySchema,
  insight: z.string(),
  priority: PrioritySchema,
  overallSentiment: SentimentSchema,
  evidenceCount: z.number().int(),
  keyThemes: z.array(z.string()),
  suggestedAction: z.string(),
  impactScore: z.number().min(0).max(1),
});

export type GeneratedInsight = z.infer<typeof GeneratedInsightSchema>;

export const InsightsResponseSchema = z.object({
  insights: z.array(GeneratedInsightSchema),
  reviewPeriod: z.object({
    from: z.string(),
    to: z.string(),
  }),
  totalReviewsAnalyzed: z.number(),
});

export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export const ZomatoReviewSchema = z.object({
  // id — old actor: string, new actor: number
  reviewId: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  // reviewer name
  userName: z.string().optional(),       // new actor
  reviewerName: z.string().optional(),   // old actor
  name: z.string().optional(),
  // rating — new actor: ratingV2 string ("5"), old actor: rating number
  ratingV2: z.string().optional(),
  rating: z.union([z.number(), z.record(z.unknown())]).optional(),
  stars: z.number().optional(),
  // text
  reviewText: z.string().optional(),
  review: z.string().optional(),
  text: z.string().optional(),
  // date
  timestamp: z.string().optional(),
  reviewDate: z.string().optional(),
  publishedAt: z.string().optional(),
}).passthrough();

export type ZomatoReview = z.infer<typeof ZomatoReviewSchema>;

export interface ScrapeJobData {
  restaurantId: string;
  sourceUrl: string;
  source: 'google' | 'zomato';
  maxReviews?: number;
  jobDbId?: string;
  startDate?: string; // YYYY-MM-DD IST — omit to fetch all reviews
}

export interface InsightsJobData {
  restaurantId: string;
  jobDbId?: string;
}

export const DishMentionItemSchema = z.object({
  dish: z.string(),
  mentions: z.number().int().min(1),
  positiveMentions: z.number().int().min(0),
  negativeMentions: z.number().int().min(0),
});

export const DishMentionsResponseSchema = z.object({
  dishes: z.array(DishMentionItemSchema),
});

export type DishMentionItem = z.infer<typeof DishMentionItemSchema>;
export type DishMentionsResponse = z.infer<typeof DishMentionsResponseSchema>;

export const StaffMentionItemSchema = z.object({
  name: z.string(),
  mentions: z.number().int().min(1),
  positiveMentions: z.number().int().min(0).default(0),
  negativeMentions: z.number().int().min(0).default(0),
});

export const StaffMentionsResponseSchema = z.object({
  staff: z.array(StaffMentionItemSchema),
});

export type StaffMentionItem = z.infer<typeof StaffMentionItemSchema>;
export type StaffMentionsResponse = z.infer<typeof StaffMentionsResponseSchema>;

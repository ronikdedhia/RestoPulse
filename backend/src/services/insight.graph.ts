import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { ChatGroq } from '@langchain/groq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';
import { reviewService } from './review.service';
import {
  InsightsResponse,
  InsightsResponseSchema,
  DishMentionsResponse,
  DishMentionsResponseSchema,
  StaffMentionsResponse,
  StaffMentionsResponseSchema,
} from '../types';

// ── State ─────────────────────────────────────────────────────────────────────

type ReviewInput = { rating: number; text: string | null; reviewDate: Date | null };

const InsightState = Annotation.Root({
  restaurantId: Annotation<string>(),
  restaurantName: Annotation<string>({ default: () => '', reducer: (_, b) => b }),
  reviews: Annotation<ReviewInput[]>({ default: () => [], reducer: (_, b) => b }),
  insights: Annotation<InsightsResponse | null>({ default: () => null, reducer: (_, b) => b }),
  dishes: Annotation<DishMentionsResponse | null>({ default: () => null, reducer: (_, b) => b }),
  staff: Annotation<StaffMentionsResponse | null>({ default: () => null, reducer: (_, b) => b }),
  errors: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  insightCount: Annotation<number>({ default: () => 0, reducer: (_, b) => b }),
});

type InsightStateType = typeof InsightState.State;

// ── LLM ───────────────────────────────────────────────────────────────────────

const llm = new ChatGroq({ apiKey: config.groq.apiKey, model: config.groq.model });
const jsonParser = new JsonOutputParser();

const insightsChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a restaurant PM analyst. Analyze reviews and return structured JSON insights. Be specific, evidence-based, actionable. Categories: food_quality, service, ambiance, pricing, hygiene, staff, wait_time, overall. Respond with valid JSON only.',
  ],
  [
    'human',
    `Analyze {reviewCount} reviews for "{restaurantName}". Return JSON only:
{{"insights":[{{"category":"food_quality|service|ambiance|pricing|hygiene|staff|wait_time|overall","insight":"...","priority":"high|medium|low","overallSentiment":"positive|negative|mixed|neutral","evidenceCount":0,"keyThemes":["..."],"suggestedAction":"...","impactScore":0.0}}],"reviewPeriod":{{"from":"{dateFrom}","to":"{dateTo}"}},"totalReviewsAnalyzed":{reviewCount}}}

REVIEWS:
{reviewTexts}

Generate 5-6 insights sorted by impactScore desc.`,
  ],
])
  .pipe(llm)
  .pipe(jsonParser);

const dishChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a restaurant menu analyst. Extract dish mentions from reviews and return valid JSON only.',
  ],
  [
    'human',
    `Extract SPECIFIC dish and menu item names mentioned in these reviews for "{restaurantName}".

Rules:
- Only extract named dishes: "shawarma", "butter chicken", "biryani", "cheese burst pizza", "cold coffee", etc.
- NEVER include generic words: "food", "items", "dishes", "meal", "order", "service", "place", "stuff", "thing", "everything", "nothing"
- Use the most specific name mentioned (e.g. "chicken shawarma" not just "shawarma" if that's what reviewers say)
- Count positive vs negative mentions per dish
- Only include dishes mentioned 2+ times, max 15, sorted by mentions desc

Return JSON only:
{{"dishes":[{{"dish":"butter chicken","mentions":5,"positiveMentions":4,"negativeMentions":1}}]}}

REVIEWS:
{reviewTexts}`,
  ],
])
  .pipe(llm)
  .pipe(jsonParser);

const staffChain = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You are a restaurant HR analyst. Extract staff name mentions from reviews and return valid JSON only.',
  ],
  [
    'human',
    `Extract staff/employee first names mentioned in these reviews for "{restaurantName}". Only include names mentioned 2+ times. Return JSON only:
{{"staff":[{{"name":"Ravi","mentions":5,"positiveMentions":4,"negativeMentions":1}}]}}

Max 10 staff. Sort by mentions desc. Only real first names, not "manager" or "staff".

REVIEWS:
{reviewTexts}`,
  ],
])
  .pipe(llm)
  .pipe(jsonParser);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

async function loadData(state: InsightStateType): Promise<Partial<InsightStateType>> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: state.restaurantId },
    select: { name: true },
  });
  if (!restaurant) throw new Error(`Restaurant ${state.restaurantId} not found`);

  const reviews = await reviewService.getForInsights(state.restaurantId);
  logger.info(`[graph] Loaded ${reviews.length} reviews for ${restaurant.name}`);
  return { restaurantName: restaurant.name, reviews };
}

async function generateInsightsNode(state: InsightStateType): Promise<Partial<InsightStateType>> {
  if (state.reviews.length < 1) {
    logger.warn(`[graph] No reviews for ${state.restaurantId}, skipping insights`);
    return { insights: null };
  }

  try {
    const filtered = state.reviews.filter((r) => r.text && r.text.trim().length > 10);
    const sliced = filtered.slice(0, 40);
    const reviewTexts = sliced.map((r) => `[${r.rating}★] ${r.text!.slice(0, 200)}`).join('\n');
    const dates = state.reviews
      .filter((r) => r.reviewDate)
      .map((r) => r.reviewDate!.toISOString().split('T')[0])
      .sort();

    const raw = await insightsChain.invoke({
      reviewCount: sliced.length,
      restaurantName: state.restaurantName,
      dateFrom: dates[0] ?? 'unknown',
      dateTo: dates[dates.length - 1] ?? 'unknown',
      reviewTexts,
    });

    const parsed = InsightsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`[graph] Insights Zod validation failed: ${parsed.error.message}`);
      return { insights: null, errors: { generateInsights: parsed.error.message } };
    }

    logger.info(`[graph] Generated ${parsed.data.insights.length} insights for ${state.restaurantName}`);
    return { insights: parsed.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[graph] generateInsights failed: ${msg}`);
    return { insights: null, errors: { generateInsights: msg } };
  }
}

async function extractDishesNode(state: InsightStateType): Promise<Partial<InsightStateType>> {
  if (state.reviews.length < 1) return { dishes: null };

  try {
    const reviewTexts = state.reviews
      .filter((r) => r.text && r.text.trim().length > 10)
      .slice(0, 50)
      .map((r) => `[${r.rating}★] ${r.text!.slice(0, 300)}`)
      .join('\n');

    const rawResult = await dishChain.invoke({ restaurantName: state.restaurantName, reviewTexts });

    // LLM sometimes returns mentions:0 — strip before Zod validation
    if (rawResult && Array.isArray(rawResult.dishes)) {
      rawResult.dishes = rawResult.dishes.filter((d: { mentions?: number }) => (d.mentions ?? 0) >= 1);
    }

    const parsed = DishMentionsResponseSchema.safeParse(rawResult);
    if (!parsed.success) {
      logger.warn(`[graph] Dishes Zod validation failed: ${parsed.error.message}`);
      return { dishes: null, errors: { extractDishes: parsed.error.message } };
    }

    logger.info(`[graph] Extracted ${parsed.data.dishes.length} dish mentions for ${state.restaurantName}`);
    return { dishes: parsed.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[graph] extractDishes failed: ${msg}`);
    return { dishes: null, errors: { extractDishes: msg } };
  }
}

async function extractStaffNode(state: InsightStateType): Promise<Partial<InsightStateType>> {
  if (state.reviews.length < 1) return { staff: null };

  try {
    const reviewTexts = state.reviews
      .filter((r) => r.text && r.text.trim().length > 10)
      .slice(0, 50)
      .map((r) => `[${r.rating}★] ${r.text!.slice(0, 150)}`)
      .join('\n');

    const rawResult = await staffChain.invoke({ restaurantName: state.restaurantName, reviewTexts });

    // LLM sometimes returns a bare array instead of {staff:[...]}
    const normalized = Array.isArray(rawResult) ? { staff: rawResult } : rawResult;

    const parsed = StaffMentionsResponseSchema.safeParse(normalized);
    if (!parsed.success) {
      logger.warn(`[graph] Staff Zod validation failed: ${parsed.error.message}`);
      return { staff: null, errors: { extractStaff: parsed.error.message } };
    }

    logger.info(`[graph] Extracted ${parsed.data.staff.length} staff mentions for ${state.restaurantName}`);
    return { staff: parsed.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[graph] extractStaff failed: ${msg}`);
    return { staff: null, errors: { extractStaff: msg } };
  }
}

async function persistAll(state: InsightStateType): Promise<Partial<InsightStateType>> {
  let insightCount = 0;

  if (state.insights) {
    const weekStart = getMondayOf(new Date());

    const current = await prisma.actionableInsight.findMany({ where: { restaurantId: state.restaurantId } });
    if (current.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.insightSnapshot.deleteMany({ where: { restaurantId: state.restaurantId, weekStart } });
        await tx.insightSnapshot.createMany({
          data: current.map((ins) => ({
            restaurantId: state.restaurantId,
            weekStart,
            category: ins.category,
            impactScore: ins.impactScore ?? 0,
            priority: ins.priority,
          })),
        });
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.actionableInsight.deleteMany({ where: { restaurantId: state.restaurantId } });
      await tx.actionableInsight.createMany({
        data: state.insights!.insights.map((ins) => ({
          restaurantId: state.restaurantId,
          category: ins.category,
          insight: ins.insight,
          priority: ins.priority,
          overallSentiment: ins.overallSentiment,
          evidenceCount: ins.evidenceCount,
          keyThemes: JSON.stringify(ins.keyThemes),
          suggestedAction: ins.suggestedAction,
          impactScore: ins.impactScore,
          reviewPeriod: JSON.stringify(state.insights!.reviewPeriod),
        })),
      });
    });

    insightCount = state.insights.insights.length;
    logger.info(`[graph] Persisted ${insightCount} insights for ${state.restaurantName}`);
  }

  if (state.dishes && state.dishes.dishes.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.dishMention.deleteMany({ where: { restaurantId: state.restaurantId } });
      await tx.dishMention.createMany({
        data: state.dishes!.dishes.map((d) => ({
          restaurantId: state.restaurantId,
          dish: d.dish,
          mentions: d.mentions,
          positiveMentions: d.positiveMentions,
          negativeMentions: d.negativeMentions,
        })),
      });
    });
    logger.info(`[graph] Persisted ${state.dishes.dishes.length} dish mentions for ${state.restaurantName}`);
  }

  if (state.staff && state.staff.staff.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.staffMention.deleteMany({ where: { restaurantId: state.restaurantId } });
      await tx.staffMention.createMany({
        data: state.staff!.staff.map((s) => ({
          restaurantId: state.restaurantId,
          staffName: s.name,
          mentions: s.mentions,
          positiveMentions: s.positiveMentions,
          negativeMentions: s.negativeMentions,
        })),
      });
    });
    logger.info(`[graph] Persisted ${state.staff.staff.length} staff mentions for ${state.restaurantName}`);
  }

  return { insightCount };
}

// ── Graph ─────────────────────────────────────────────────────────────────────

const checkpointer = new MemorySaver();

const insightGraph = new StateGraph(InsightState)
  .addNode('loadData', loadData)
  .addNode('generateInsights', generateInsightsNode)
  .addNode('extractDishes', extractDishesNode)
  .addNode('extractStaff', extractStaffNode)
  .addNode('persistAll', persistAll)
  .addEdge(START, 'loadData')
  .addEdge('loadData', 'generateInsights')
  .addEdge('loadData', 'extractDishes')
  .addEdge('loadData', 'extractStaff')
  .addEdge(['generateInsights', 'extractDishes', 'extractStaff'], 'persistAll')
  .addEdge('persistAll', END)
  .compile({ checkpointer });

export interface InsightGraphResult {
  insightCount: number;
  restaurantName: string;
  errors: Record<string, string>;
}

export async function runInsightGraph(restaurantId: string): Promise<InsightGraphResult> {
  const result = await insightGraph.invoke(
    { restaurantId },
    { configurable: { thread_id: restaurantId } }
  );

  if (Object.keys(result.errors).length > 0) {
    logger.warn(`[graph] ${restaurantId} completed with errors: ${JSON.stringify(result.errors)}`);
  }

  return {
    insightCount: result.insightCount as number,
    restaurantName: result.restaurantName as string,
    errors: result.errors as Record<string, string>,
  };
}

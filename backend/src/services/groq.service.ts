import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { InsightsResponse, InsightsResponseSchema, DishMentionsResponse, DishMentionsResponseSchema, StaffMentionsResponse, StaffMentionsResponseSchema } from '../types';

const client = new Groq({ apiKey: config.groq.apiKey });

const SYSTEM_PROMPT = `You are a restaurant PM analyst. Analyze reviews and return structured JSON insights. Be specific, evidence-based, actionable. Categories: food_quality, service, ambiance, pricing, hygiene, staff, wait_time, overall. Respond with valid JSON only.`;

class GroqService {
  async generateInsights(
    restaurantName: string,
    reviews: Array<{ rating: number; text: string | null; reviewDate: Date | null }>
  ): Promise<InsightsResponse> {
    const filtered = reviews.filter((r) => r.text && r.text.trim().length > 10);
    // Hard cap at 40 reviews, truncate each to 200 chars to stay under Groq TPM limit
    const reviewTexts = filtered
      .slice(0, 40)
      .map((r) => `[${r.rating}★] ${r.text!.slice(0, 200)}`)
      .join('\n');

    const dates = reviews
      .filter((r) => r.reviewDate)
      .map((r) => r.reviewDate!.toISOString().split('T')[0])
      .sort();

    const prompt = `Analyze ${Math.min(filtered.length, 40)} reviews for "${restaurantName}". Return JSON only:
{"insights":[{"category":"food_quality|service|ambiance|pricing|hygiene|staff|wait_time|overall","insight":"...","priority":"high|medium|low","overallSentiment":"positive|negative|mixed|neutral","evidenceCount":0,"keyThemes":["..."],"suggestedAction":"...","impactScore":0.0}],"reviewPeriod":{"from":"${dates[0] ?? 'unknown'}","to":"${dates[dates.length - 1] ?? 'unknown'}"},"totalReviewsAnalyzed":${Math.min(filtered.length, 40)}}

REVIEWS:
${reviewTexts}

Generate 5-6 insights sorted by impactScore desc.`;

    logger.info(`Generating insights for ${restaurantName} (${reviews.length} reviews)`);

    const response = await client.chat.completions.create({
      model: config.groq.model,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from GROQ');

    const jsonText = this.extractJson(content);
    let raw: unknown;
    try { raw = JSON.parse(jsonText); } catch {
      throw new Error(`Groq returned invalid JSON for insights: ${jsonText.slice(0, 120)}`);
    }
    const parsed = InsightsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      logger.error(`GROQ response validation failed: ${parsed.error.message}`);
      throw new Error('Invalid insights response structure');
    }

    return parsed.data;
  }

  async extractDishMentions(
    restaurantName: string,
    reviews: Array<{ rating: number; text: string | null }>
  ): Promise<DishMentionsResponse> {
    const texts = reviews
      .filter((r) => r.text && r.text.trim().length > 10)
      .slice(0, 50)
      .map((r) => `[${r.rating}★] ${r.text!.slice(0, 300)}`)
      .join('\n');

    const prompt = `Extract SPECIFIC dish and menu item names mentioned in these reviews for "${restaurantName}".

Rules:
- Only extract named dishes: "shawarma", "butter chicken", "biryani", "cheese burst pizza", "cold coffee", etc.
- NEVER include generic words: "food", "items", "dishes", "meal", "order", "service", "place", "stuff", "thing", "everything", "nothing"
- Use the most specific name mentioned (e.g. "chicken shawarma" not just "shawarma" if that's what reviewers say)
- Count positive vs negative mentions per dish
- Only include dishes mentioned 2+ times, max 15, sorted by mentions desc

Return JSON only:
{"dishes":[{"dish":"butter chicken","mentions":5,"positiveMentions":4,"negativeMentions":1}]}

REVIEWS:
${texts}`;

    const response = await client.chat.completions.create({
      model: config.groq.model,
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'You are a restaurant menu analyst. Extract dish mentions from reviews and return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from GROQ for dish extraction');

    const jsonText = this.extractJson(content);
    let raw: unknown;
    try { raw = JSON.parse(jsonText); } catch {
      throw new Error(`Groq returned invalid JSON for dishes: ${jsonText.slice(0, 120)}`);
    }
    const parsed = DishMentionsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      logger.error(`Dish extraction validation failed: ${parsed.error.message}`);
      throw new Error('Invalid dish mentions response structure');
    }

    return parsed.data;
  }

  async extractStaffMentions(
    restaurantName: string,
    reviews: Array<{ rating: number; text: string | null }>
  ): Promise<StaffMentionsResponse> {
    const texts = reviews
      .filter((r) => r.text && r.text.trim().length > 10)
      .slice(0, 50)
      .map((r) => `[${r.rating}★] ${r.text!.slice(0, 150)}`)
      .join('\n');

    const prompt = `Extract staff/employee first names mentioned in these reviews for "${restaurantName}". Only include names mentioned 2+ times. Return JSON only:
{"staff":[{"name":"Ravi","mentions":5,"positiveMentions":4,"negativeMentions":1}]}

Max 10 staff. Sort by mentions desc. Only real first names, not "manager" or "staff".

REVIEWS:
${texts}`;

    const response = await client.chat.completions.create({
      model: config.groq.model,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are a restaurant HR analyst. Extract staff name mentions from reviews and return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from GROQ for staff extraction');

    const jsonText = this.extractJson(content);
    let raw: unknown;
    try { raw = JSON.parse(jsonText); } catch {
      throw new Error(`Groq returned invalid JSON for staff: ${jsonText.slice(0, 120)}`);
    }
    const parsed = StaffMentionsResponseSchema.safeParse(raw);

    if (!parsed.success) {
      logger.error(`Staff extraction validation failed: ${parsed.error.message}`);
      throw new Error('Invalid staff mentions response structure');
    }

    return parsed.data;
  }

  async generateReviewReply(
    reviewText: string,
    restaurantName: string,
    rating: number,
    tone: 'formal' | 'apologetic' | 'assertive'
  ): Promise<string> {
    const toneGuide = {
      formal: 'Professional and polite. Acknowledge the feedback, state what will be investigated, invite them back.',
      apologetic: 'Warm and sincere apology. Take responsibility. Show empathy. Offer to make it right.',
      assertive: 'Confident but respectful. Address specific points, clarify if needed, highlight strengths.',
    }[tone];

    const prompt = `Write a short owner reply to this ${rating}-star review for "${restaurantName}".

Tone: ${toneGuide}

Rules:
- Max 3 sentences
- Do NOT use generic phrases like "We value your feedback" or "We strive for excellence"
- Be specific to what the review actually says
- End with an invitation to return or contact directly
- Do not use emojis
- Write as the restaurant owner/manager, not a corporate PR team

Review: "${reviewText}"

Reply:`;

    const response = await client.chat.completions.create({
      model: config.groq.model,
      max_tokens: 200,
      messages: [
        { role: 'system', content: 'You are a restaurant owner writing a direct, human reply to a customer review. Write naturally, not like a corporate template.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('No reply generated');
    return content;
  }

  private extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`No JSON object found in GROQ response: ${text.slice(0, 120)}`);
    return match[0];
  }
}

export const groqService = new GroqService();

import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { InsightsResponse, InsightsResponseSchema } from '../types';

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
    const parsed = InsightsResponseSchema.safeParse(JSON.parse(jsonText));

    if (!parsed.success) {
      logger.error(`GROQ response validation failed: ${parsed.error.message}`);
      throw new Error('Invalid insights response structure');
    }

    return parsed.data;
  }

  private extractJson(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in GROQ response');
    return match[0];
  }
}

export const groqService = new GroqService();

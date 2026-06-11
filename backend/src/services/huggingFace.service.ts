import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

const BATCH_SIZE = 20;

type Sentiment = 'positive' | 'neutral' | 'negative';

const client = new Groq({ apiKey: config.groq.apiKey });

class HuggingFaceService {
  async analyzeSentimentBatch(texts: string[]): Promise<(Sentiment | null)[]> {
    const results: (Sentiment | null)[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 300));

      try {
        const numbered = batch.map((t, idx) => `${idx + 1}. "${t}"`).join('\n');

        const response = await client.chat.completions.create({
          model: config.groq.model,
          max_tokens: 200,
          messages: [
            {
              role: 'system',
              content: 'Classify sentiment of each review. Return a JSON array only — same length as input, each value exactly "positive", "negative", or "neutral". No explanation.',
            },
            {
              role: 'user',
              content: `Classify these ${batch.length} reviews:\n${numbered}\n\nReturn JSON array only: ["positive","negative",...]`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content ?? '[]';
        const match = content.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array in response');

        const parsed: unknown[] = JSON.parse(match[0]);
        for (let j = 0; j < batch.length; j++) {
          const val = parsed[j];
          results.push(val === 'positive' || val === 'negative' || val === 'neutral' ? val : null);
        }
      } catch (err: unknown) {
        logger.warn(`[sentiment] Batch ${i / BATCH_SIZE + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
        for (let j = 0; j < batch.length; j++) results.push(null);
      }
    }

    logger.info(`[sentiment] Scored ${results.filter(Boolean).length}/${texts.length} reviews`);
    return results;
  }

  async analyzeSentiment(text: string): Promise<Sentiment | null> {
    const [result] = await this.analyzeSentimentBatch([text]);
    return result ?? null;
  }
}

export const huggingFaceService = new HuggingFaceService();

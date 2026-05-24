import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const HF_API = 'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest';
const BATCH_SIZE = 32;

type Sentiment = 'positive' | 'neutral' | 'negative';

interface HFLabel {
  label: string;
  score: number;
}

class HuggingFaceService {
  private get headers() {
    return { Authorization: `Bearer ${config.huggingFace.apiKey}` };
  }

  async analyzeSentimentBatch(texts: string[]): Promise<(Sentiment | null)[]> {
    if (!config.huggingFace.apiKey) {
      logger.warn('[hf] No API key — skipping sentiment');
      return texts.map(() => null);
    }

    const results: (Sentiment | null)[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 512));

      try {
        const { data } = await axios.post<HFLabel[][]>(
          HF_API,
          { inputs: batch },
          { headers: this.headers, timeout: 15000 }
        );

        for (const labels of data) {
          const top = labels.reduce((a, b) => (a.score > b.score ? a : b));
          const label = top.label.toLowerCase();
          results.push(label === 'positive' || label === 'negative' || label === 'neutral' ? label : null);
        }
      } catch (err: any) {
        logger.warn(`[hf] Batch ${i / BATCH_SIZE + 1} failed: ${err?.message}`);
        for (let j = 0; j < batch.length; j++) results.push(null);
      }
    }

    return results;
  }

  async analyzeSentiment(text: string): Promise<Sentiment | null> {
    const [result] = await this.analyzeSentimentBatch([text]);
    return result ?? null;
  }
}

export const huggingFaceService = new HuggingFaceService();

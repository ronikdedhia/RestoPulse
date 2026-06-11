import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
const client = new Groq({ apiKey: config.groq.apiKey });

class GroqService {
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

}

export const groqService = new GroqService();

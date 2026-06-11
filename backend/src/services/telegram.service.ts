import { config } from '../config';
import { logger } from '../utils/logger';

interface HeartbeatStats {
  restaurants: number;
  googleQueued: number;
  zomatoQueued: number;
  dateIST: string;
}

export interface InsightsSummary {
  restaurantName: string;
  insightCount: number;
  healthScore: number | null;
  topInsights: Array<{ category: string; insight: string; priority: string }>;
  dishCount: number;
  staffCount: number;
  errors: Record<string, string>;
}

class TelegramService {
  private get token(): string { return config.telegram.token; }

  // Prefer channel over chat
  private get targetChatId(): string {
    return config.telegram.channelId || config.telegram.chatId;
  }

  private get enabled(): boolean {
    return !!(this.token && this.targetChatId);
  }

  async sendAlert(message: string): Promise<void> {
    if (!this.enabled) return;
    await this.send(message);
  }

  async sendDailyHeartbeat(stats: HeartbeatStats): Promise<void> {
    if (!this.enabled) return;
    const msg =
      `📊 <b>RestoPulse Daily Report</b>\n` +
      `📅 ${stats.dateIST}\n\n` +
      `✅ App alive on Render\n` +
      `🏪 Active restaurants: <b>${stats.restaurants}</b>\n` +
      `🔄 Jobs queued: <b>${stats.googleQueued} Google + ${stats.zomatoQueued} Zomato</b>\n\n` +
      `⏰ Next run: 12:00 PM IST`;
    await this.send(msg);
  }

  async sendInsightsSummary(summary: InsightsSummary): Promise<void> {
    if (!this.enabled) return;

    const priorityEmoji: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
    const topLines = summary.topInsights
      .slice(0, 3)
      .map((i) => `${priorityEmoji[i.priority] ?? '⚪'} <b>${i.category.replace('_', ' ')}</b>: ${i.insight}`)
      .join('\n');

    const errorNote = Object.keys(summary.errors).length > 0
      ? `\n⚠️ Partial errors: ${Object.keys(summary.errors).join(', ')}`
      : '';

    const msg =
      `🍽️ <b>${summary.restaurantName}</b> — Insights updated\n\n` +
      `📈 Health score: <b>${summary.healthScore !== null ? `${summary.healthScore.toFixed(2)}/100` : 'N/A'}</b>\n` +
      `💡 ${summary.insightCount} insights · 🍛 ${summary.dishCount} dishes · 👤 ${summary.staffCount} staff\n\n` +
      `<b>Top findings:</b>\n${topLines}` +
      errorNote;

    await this.send(msg);
  }

  private async send(text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.targetChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        logger.warn(`[telegram] API error ${res.status}: ${body}`);
      } else {
        logger.info('[telegram] Message sent');
      }
    } catch (err) {
      logger.warn(`[telegram] Failed to send: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export const telegramService = new TelegramService();

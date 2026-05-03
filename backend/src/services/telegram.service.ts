import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

const CATEGORY_EMOJI: Record<string, string> = {
  food_quality: '🍽️',
  service: '🤝',
  ambiance: '✨',
  pricing: '💰',
  hygiene: '🧹',
  staff: '👤',
  wait_time: '⏱️',
  overall: '📊',
};

const PRIORITY_EMOJI: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

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

  async sendInsightsSummary(restaurantId: string): Promise<void> {
    if (!this.enabled) return;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    if (!restaurant) return;

    const [insights, alerts] = await Promise.all([
      prisma.actionableInsight.findMany({
        where: { restaurantId },
        orderBy: { impactScore: 'desc' },
        take: 5,
      }),
      prisma.velocityAlert.findMany({
        where: { restaurantId, isActive: true },
        orderBy: { triggeredAt: 'desc' },
        take: 3,
      }),
    ]);

    if (insights.length === 0) return;

    const lines: string[] = [
      `<b>📊 New Insights — ${restaurant.name}</b>`,
      `<i>${new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</i>`,
      '',
    ];

    if (alerts.length > 0) {
      lines.push('<b>🚨 Active Alerts</b>');
      for (const a of alerts) {
        lines.push(`• ${a.message}`);
      }
      lines.push('');
    }

    lines.push('<b>Top Insights</b>');
    for (const ins of insights) {
      const catEmoji = CATEGORY_EMOJI[ins.category] ?? '📌';
      const priEmoji = PRIORITY_EMOJI[ins.priority] ?? '';
      const score = ins.impactScore != null ? ` <i>(${(ins.impactScore * 100).toFixed(0)}%)</i>` : '';
      lines.push(`${catEmoji} ${priEmoji} <b>${ins.category.replace(/_/g, ' ')}</b>${score}`);
      lines.push(`  ${ins.insight}`);
    }

    await this.send(lines.join('\n'));
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

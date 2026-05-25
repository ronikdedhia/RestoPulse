import { config } from '../config';
import { logger } from '../utils/logger';

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

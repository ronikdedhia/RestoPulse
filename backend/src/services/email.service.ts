import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';
import { randomUUID } from 'crypto';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CATEGORY_LABELS: Record<string, string> = {
  food_quality: 'Food Quality', service: 'Service', ambiance: 'Ambiance',
  pricing: 'Pricing', hygiene: 'Hygiene', staff: 'Staff', wait_time: 'Wait Time', overall: 'Overall',
};

const TREND_HTML: Record<string, string> = {
  improved: '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">&#x2191; Improved</span>',
  worsened: '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">&#x2193; Worsened</span>',
  new: '<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">NEW</span>',
  stable: '',
};

const ALERT_COLORS: Record<string, string> = {
  high: '#dc2626', medium: '#d97706', low: '#2563eb',
};

function buildDigestHtml(data: {
  restaurantName: string;
  insights: Array<{ category: string; insight: string; impactScore: number; trend?: string | null }>;
  velocityAlerts: Array<{ alertType: string; severity: string; message: string }>;
  dishComplaints: Array<{ dish: string; mentions: number; negativeMentions: number }>;
  staffFlags: Array<{ staffName: string; mentions: number; negativeMentions: number }>;
  persistentIssues: Array<{ category: string; weeksSeen: number }>;
  unsubscribeUrl: string;
  weekOf: string;
}): string {
  const insightRows = data.insights.slice(0, 3).map((ins) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:600;text-transform:uppercase;color:#6b7280;letter-spacing:0.05em;">${esc(CATEGORY_LABELS[ins.category] ?? ins.category)}</span>
          ${TREND_HTML[ins.trend ?? ''] ?? ''}
        </div>
        <p style="margin:4px 0 0;font-size:14px;color:#111;">${esc(ins.insight)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Impact: ${(ins.impactScore * 100).toFixed(0)}%</p>
      </td>
    </tr>`).join('');

  const alertRows = data.velocityAlerts.map((a) => `
    <div style="padding:10px 12px;border-left:4px solid ${ALERT_COLORS[a.severity] ?? '#6b7280'};background:#fafafa;margin-bottom:8px;border-radius:0 6px 6px 0;font-size:13px;color:#374151;">
      ${a.alertType === 'negative_spike' ? '⚠️' : '📈'} ${esc(a.message)}
    </div>`).join('');

  const dishRows = data.dishComplaints.slice(0, 3).map((d) => `
    <div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
      <strong style="text-transform:capitalize;">${esc(d.dish)}</strong>
      <span style="color:#dc2626;margin-left:8px;">-${d.negativeMentions} negative / ${d.mentions} total</span>
    </div>`).join('');

  const staffRows = data.staffFlags.map((s) => `
    <div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
      <strong>${esc(s.staffName)}</strong>
      <span style="color:#dc2626;margin-left:8px;">${s.negativeMentions} negative mentions</span>
    </div>`).join('');

  const persistentRows = data.persistentIssues.map((p) => `
    <div style="padding:8px 12px;background:#fff7ed;border-left:4px solid #f97316;border-radius:0 6px 6px 0;margin-bottom:6px;font-size:13px;color:#374151;">
      🔁 <strong>${CATEGORY_LABELS[p.category] ?? p.category}</strong> — flagged for ${p.weeksSeen} consecutive weeks
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <div style="background:#111827;padding:28px 32px;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">Weekly Digest</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:22px;">${esc(data.restaurantName)}</h1>
      <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Week of ${esc(data.weekOf)}</p>
    </div>

    <div style="padding:28px 32px;">

      ${data.velocityAlerts.length > 0 ? `
      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">🚨 Velocity Alerts</h2>
        ${alertRows}
      </div>` : ''}

      ${data.persistentIssues.length > 0 ? `
      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">🔁 Persistent Issues</h2>
        ${persistentRows}
      </div>` : ''}

      ${data.insights.length > 0 ? `
      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">Top Insights This Week</h2>
        <table style="width:100%;border-collapse:collapse;">${insightRows}</table>
      </div>` : ''}

      ${data.dishComplaints.length > 0 ? `
      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">🍽️ Dish Complaints</h2>
        ${dishRows}
      </div>` : ''}

      ${data.staffFlags.length > 0 ? `
      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111;">👤 Staff Flags</h2>
        ${staffRows}
      </div>` : ''}

    </div>

    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      Sent by RestoPulse &middot; <a href="${data.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
}

class EmailService {
  async sendWeeklyDigest(restaurantId: string): Promise<boolean> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, ownerEmail: true, digestEnabled: true, unsubscribeToken: true },
    });

    if (!restaurant?.ownerEmail || !restaurant.digestEnabled) return false;

    // Ensure unsubscribe token exists
    let token = restaurant.unsubscribeToken;
    if (!token) {
      token = randomUUID();
      await prisma.restaurant.update({ where: { id: restaurantId }, data: { unsubscribeToken: token } });
    }

    // Gather digest data
    const [insights, velocityAlerts, dishMentions, staffMentions, persistentIssues, snapshots] = await Promise.all([
      prisma.actionableInsight.findMany({ where: { restaurantId }, orderBy: { impactScore: 'desc' }, take: 3 }),
      prisma.velocityAlert.findMany({ where: { restaurantId, isActive: true }, orderBy: { triggeredAt: 'desc' } }),
      prisma.dishMention.findMany({ where: { restaurantId }, orderBy: { negativeMentions: 'desc' } }),
      prisma.staffMention.findMany({ where: { restaurantId } }),
      prisma.persistentIssue.findMany({ where: { restaurantId, isActive: true }, orderBy: { weeksSeen: 'desc' } }),
      prisma.insightSnapshot.findMany({
        where: { restaurantId },
        select: { weekStart: true },
        distinct: ['weekStart'],
        orderBy: { weekStart: 'desc' },
        take: 2,
      }),
    ]);

    // Build insight diff (prev week comparison)
    const prevWeekStart = snapshots[1]?.weekStart ?? null;
    const prevSnaps = prevWeekStart
      ? await prisma.insightSnapshot.findMany({ where: { restaurantId, weekStart: prevWeekStart } })
      : [];
    const prevByCategory = new Map(prevSnaps.map((s) => [s.category, s.impactScore]));

    const insightsWithTrend = insights.map((ins) => {
      const prev = prevByCategory.get(ins.category);
      const score = ins.impactScore ?? 0;
      if (!prev) return { category: ins.category, insight: ins.insight, impactScore: score, trend: 'new' as const };
      const delta = score - prev;
      const trend = delta > 0.05 ? 'improved' as const : delta < -0.05 ? 'worsened' as const : 'stable' as const;
      return { category: ins.category, insight: ins.insight, impactScore: score, trend };
    });

    const dishComplaints = dishMentions.filter((d) => d.negativeMentions > d.positiveMentions);
    const staffFlags = staffMentions.filter((s) => s.negativeMentions > s.positiveMentions);

    const weekOf = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const unsubscribeUrl = `${config.backendUrl}/api/insights/digest/unsubscribe/${token}`;

    const html = buildDigestHtml({
      restaurantName: restaurant.name,
      insights: insightsWithTrend,
      velocityAlerts,
      dishComplaints,
      staffFlags,
      persistentIssues,
      unsubscribeUrl,
      weekOf,
    });

    try {
      await axios.post(
        BREVO_API_URL,
        {
          sender: { email: config.brevo.fromEmail, name: config.brevo.fromName },
          to: [{ email: restaurant.ownerEmail }],
          subject: `📊 Weekly Digest — ${restaurant.name}`,
          htmlContent: html,
        },
        { headers: { 'api-key': config.brevo.apiKey, 'content-type': 'application/json' } },
      );
      logger.info(`[email] Digest sent to ${restaurant.ownerEmail} for ${restaurant.name}`);
      return true;
    } catch (err) {
      logger.error(`[email] Failed to send digest to ${restaurant.ownerEmail}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async sendDigestToAll(): Promise<{ sent: number; skipped: number; failed: number }> {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true, digestEnabled: true, ownerEmail: { not: null } },
      select: { id: true },
    });

    let sent = 0, skipped = 0, failed = 0;

    for (const r of restaurants) {
      const ok = await this.sendWeeklyDigest(r.id);
      if (ok) sent++;
      else failed++;
    }

    skipped = (await prisma.restaurant.count({ where: { isActive: true } })) - restaurants.length;
    logger.info(`[email] Digest batch done — sent=${sent} skipped=${skipped} failed=${failed}`);
    return { sent, skipped, failed };
  }
}

export const emailService = new EmailService();

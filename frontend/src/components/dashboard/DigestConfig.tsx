'use client';

import { useState } from 'react';
import { updateDigestSettings } from '@/lib/api';

interface Props {
  restaurantId: string;
  initialEmail?: string | null;
  initialEnabled?: boolean;
}

export function DigestConfig({ restaurantId, initialEmail, initialEnabled = true }: Props) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDigestSettings(restaurantId, { ownerEmail: email, digestEnabled: enabled });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-white/80">Weekly Digest Email</p>
        <p className="text-xs text-white/40">Sent every Monday with insights, alerts, and dish complaints.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@restaurant.com"
          className="glass-input flex-1 min-w-48 rounded-lg px-3 py-1.5 text-sm text-white/80"
        />
        <label className="flex items-center gap-1.5 text-sm text-white/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded accent-blue-500"
          />
          On
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="glass-button px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 min-w-[60px]"
        >
          {saved ? 'Saved' : saving ? '...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

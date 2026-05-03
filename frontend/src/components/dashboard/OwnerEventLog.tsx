'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOwnerEvent, deleteOwnerEvent } from '@/lib/api';

interface OwnerEvent {
  id: string;
  description: string;
  eventDate: string;
  createdAt: string;
}

interface Props {
  restaurantId: string;
  events: OwnerEvent[];
}

export function OwnerEventLog({ restaurantId, events }: Props) {
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () => createOwnerEvent(restaurantId, { description: desc, eventDate: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-events', restaurantId] });
      setDesc('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteOwnerEvent(restaurantId, eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-events', restaurantId] }),
  });

  return (
    <div className="glass-card p-5 space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (desc.trim()) addMutation.mutate(); }}
        className="flex gap-2 flex-wrap"
      >
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="glass-input rounded-lg px-3 py-1.5 text-sm text-white/80"
        />
        <input
          type="text"
          placeholder="e.g. Changed head chef, New menu launched..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="glass-input rounded-lg px-3 py-1.5 text-sm text-white/80 flex-1 min-w-48"
        />
        <button
          type="submit"
          disabled={!desc.trim() || addMutation.isPending}
          className="glass-button px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
        >
          {addMutation.isPending ? 'Adding...' : 'Log Event'}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm text-white/30 text-center py-4">No events logged yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-white/[0.06] last:border-0 group">
              <div className="shrink-0 text-xs text-white/40 pt-0.5 w-20">
                {new Date(ev.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
              <div className="flex-1 text-sm text-white/70">{ev.description}</div>
              <button
                onClick={() => deleteMutation.mutate(ev.id)}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

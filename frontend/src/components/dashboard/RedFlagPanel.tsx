'use client';

import { useState } from 'react';

interface RedFlagReview {
  id: string;
  reviewerName: string | null;
  rating: number;
  text: string | null;
  redFlagWords: string | null;
  reviewDate: string | null;
  source: string;
}

type Tone = 'formal' | 'apologetic' | 'assertive';

const TONE_LABELS: Record<Tone, string> = {
  apologetic: 'Apologetic',
  formal: 'Formal',
  assertive: 'Assertive',
};

const TONE_DESC: Record<Tone, string> = {
  apologetic: 'Warm, takes responsibility',
  formal: 'Professional, investigative',
  assertive: 'Confident, addresses points',
};

async function fetchReplySuggestion(
  reviewText: string,
  restaurantName: string,
  rating: number,
  tone: Tone
): Promise<string> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reviews/reply-suggestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewText, restaurantName, rating, tone }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? 'Failed');
  return data.data.reply as string;
}

function ReplyBox({ review, restaurantName }: { review: RedFlagReview; restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<Tone>('apologetic');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async (selectedTone: Tone) => {
    if (!review.text) return;
    setLoading(true);
    setError('');
    setReply('');
    setCopied(false);
    try {
      const text = await fetchReplySuggestion(review.text, restaurantName, review.rating, selectedTone);
      setReply(text);
    } catch {
      setError('Could not generate reply. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToneChange = (t: Tone) => {
    setTone(t);
    if (open && reply) generate(t);
  };

  const handleOpen = () => {
    setOpen(true);
    if (!reply && !loading) generate(tone);
  };

  const copy = async () => {
    if (!reply) return;
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!review.text) return null;

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={handleOpen}
          className="text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-1 rounded-md transition-colors"
        >
          Suggest reply
        </button>
      ) : (
        <div className="mt-2 space-y-2 border border-white/10 rounded-lg p-3 bg-white/[0.03]">
          {/* Tone selector */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
              <button
                key={t}
                onClick={() => handleToneChange(t)}
                title={TONE_DESC[t]}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  tone === t
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                }`}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Reply output */}
          {loading && (
            <p className="text-xs text-white/30 italic animate-pulse">Generating reply…</p>
          )}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          {reply && !loading && (
            <div className="space-y-2">
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{reply}</p>
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="text-[11px] px-3 py-1 bg-white/10 hover:bg-white/15 text-white/70 rounded-md transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => generate(tone)}
                  className="text-[11px] px-3 py-1 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 rounded-md transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => { setOpen(false); setReply(''); }}
                  className="text-[11px] text-white/20 hover:text-white/40 ml-auto transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RedFlagPanel({ reviews, restaurantName = '' }: { reviews: RedFlagReview[]; restaurantName?: string }) {
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md">
          {reviews.length} Critical Issue{reviews.length !== 1 ? 's' : ''}
        </span>
        <p className="text-xs text-white/40">Reviews flagged with health, safety, or fraud keywords requiring immediate attention.</p>
      </div>

      <div className="grid gap-3">
        {reviews.map((review) => {
          const keywords = (review.redFlagWords ?? '').split(', ').filter(Boolean);
          return (
            <div key={review.id} className="glass-card border-l-4 border-l-red-500 rounded-l-none p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-400">
                    {review.reviewerName ?? 'Anonymous'}
                  </span>
                  <span className="text-xs text-white/30">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  <span className="text-xs text-white/20 capitalize">{review.source}</span>
                </div>
                {review.reviewDate && (
                  <span className="text-xs text-white/30">
                    {new Date(review.reviewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span key={kw} className="text-[10px] font-medium px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {review.text && (
                <p className="text-xs text-white/50 line-clamp-3 leading-relaxed">
                  {review.text}
                </p>
              )}

              <ReplyBox review={review} restaurantName={restaurantName} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

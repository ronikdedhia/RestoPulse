'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRestaurant } from '@/lib/api';

export default function AddRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const googleMapsUrl = (form.elements.namedItem('googleMapsUrl') as HTMLInputElement).value.trim();
    const zomatoUrl = (form.elements.namedItem('zomatoUrl') as HTMLInputElement).value.trim();

    if (!googleMapsUrl && !zomatoUrl) {
      setError('At least one of Google Maps URL or Zomato URL is required');
      return;
    }

    setLoading(true);
    try {
      await createRestaurant({
        name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
        address: (form.elements.namedItem('address') as HTMLInputElement).value.trim(),
        googleMapsUrl: googleMapsUrl || undefined,
        zomatoUrl: zomatoUrl || undefined,
        cuisine: (form.elements.namedItem('cuisine') as HTMLInputElement).value.trim() || undefined,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to add restaurant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold">Add Restaurant</h1>
      </header>

      <main className="px-6 py-8 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Restaurant Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. Bademiya Colaba"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium">
              Address <span className="text-destructive">*</span>
            </label>
            <input
              id="address"
              name="address"
              required
              placeholder="e.g. Colaba, Mumbai"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-medium">Review Sources <span className="text-muted-foreground font-normal">(fill one or both)</span></p>

            <div className="space-y-2">
              <label htmlFor="googleMapsUrl" className="text-sm flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 border border-blue-200 font-medium">Google</span>
                Google Maps URL
              </label>
              <input
                id="googleMapsUrl"
                name="googleMapsUrl"
                placeholder="https://maps.google.com/?cid=..."
                className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="zomatoUrl" className="text-sm flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 border border-orange-200 font-medium">Zomato</span>
                Zomato Reviews URL
              </label>
              <input
                id="zomatoUrl"
                name="zomatoUrl"
                placeholder="https://www.zomato.com/mumbai/restaurant-name/reviews"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="cuisine" className="text-sm font-medium">
              Cuisine <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              id="cuisine"
              name="cuisine"
              placeholder="e.g. North Indian, Chinese"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard"
              className="flex-1 py-2 border rounded-md text-sm text-center hover:bg-accent transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Restaurant'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

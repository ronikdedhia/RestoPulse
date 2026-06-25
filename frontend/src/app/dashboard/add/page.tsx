'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRestaurant } from '@/lib/api';

type FieldErrors = {
  name?: string;
  address?: string;
  googleMapsUrl?: string;
  zomatoUrl?: string;
  urls?: string;
};

function validateGoogleMapsUrl(url: string): boolean {
  return /google\.com\/maps|maps\.google\.com|goo\.gl\/maps/.test(url);
}

function validateZomatoUrl(url: string): boolean {
  return /zomato\.com/.test(url);
}

export default function AddRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const address = (form.elements.namedItem('address') as HTMLInputElement).value.trim();
    const googleMapsUrl = (form.elements.namedItem('googleMapsUrl') as HTMLInputElement).value.trim();
    const zomatoUrl = (form.elements.namedItem('zomatoUrl') as HTMLInputElement).value.trim();
    const cuisine = (form.elements.namedItem('cuisine') as HTMLInputElement).value.trim();

    const errors: FieldErrors = {};

    if (name.length < 2) errors.name = 'Name must be at least 2 characters';
    if (address.length < 5) errors.address = 'Enter a valid address';
    if (googleMapsUrl && !validateGoogleMapsUrl(googleMapsUrl)) errors.googleMapsUrl = 'Must be a valid Google Maps URL';
    if (zomatoUrl && !validateZomatoUrl(zomatoUrl)) errors.zomatoUrl = 'Must be a valid Zomato URL';
    if (!googleMapsUrl && !zomatoUrl) errors.urls = 'At least one of Google Maps URL or Zomato URL is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await createRestaurant({
        name,
        address,
        googleMapsUrl: googleMapsUrl || undefined,
        zomatoUrl: zomatoUrl || undefined,
        cuisine: cuisine || undefined,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setSubmitError(err.response?.data?.error ?? 'Failed to add restaurant');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'glass-input w-full rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25';
  const inputErrorClass = `${inputClass} border border-red-500/50`;

  return (
    <div className="min-h-screen">
      <header className="glass-header px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-white/40 hover:text-white/80 transition-colors">
          ← Dashboard
        </Link>
        <h1 className="text-lg font-bold text-white/90">Add Restaurant</h1>
      </header>

      <main className="px-6 py-8 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-white/70">
              Restaurant Name <span className="text-red-400">*</span>
            </label>
            <input id="name" name="name" placeholder="e.g. Bademiya Colaba" className={fieldErrors.name ? inputErrorClass : inputClass} />
            {fieldErrors.name && <p className="text-xs text-red-400">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-white/70">
              Address <span className="text-red-400">*</span>
            </label>
            <input id="address" name="address" placeholder="e.g. Colaba, Mumbai" className={fieldErrors.address ? inputErrorClass : inputClass} />
            {fieldErrors.address && <p className="text-xs text-red-400">{fieldErrors.address}</p>}
          </div>

          <div className="glass-card p-4 space-y-4">
            <p className="text-sm font-medium text-white/70">Review Sources <span className="text-white/40 font-normal text-xs">(fill one or both)</span></p>

            <div className="space-y-2">
              <label htmlFor="googleMapsUrl" className="text-sm text-white/60 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Google</span>
                Google Maps URL
              </label>
              <input id="googleMapsUrl" name="googleMapsUrl" placeholder="https://maps.google.com/?cid=..." className={fieldErrors.googleMapsUrl ? inputErrorClass : inputClass} />
              {fieldErrors.googleMapsUrl && <p className="text-xs text-red-400">{fieldErrors.googleMapsUrl}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="zomatoUrl" className="text-sm text-white/60 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">Zomato</span>
                Zomato Reviews URL
              </label>
              <input id="zomatoUrl" name="zomatoUrl" placeholder="https://www.zomato.com/mumbai/restaurant/reviews" className={fieldErrors.zomatoUrl ? inputErrorClass : inputClass} />
              {fieldErrors.zomatoUrl && <p className="text-xs text-red-400">{fieldErrors.zomatoUrl}</p>}
            </div>

            {fieldErrors.urls && <p className="text-xs text-red-400">{fieldErrors.urls}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="cuisine" className="text-sm font-medium text-white/70">
              Cuisine <span className="text-white/30 text-xs">(optional)</span>
            </label>
            <input id="cuisine" name="cuisine" placeholder="e.g. North Indian, Chinese" className={inputClass} />
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard"
              className="flex-1 py-2 glass rounded-lg text-sm text-center text-white/60 hover:text-white/80 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Restaurant'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

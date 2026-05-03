'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { syncAuthUser } from '@/lib/api';

export function AuthSync() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || synced.current) return;

    const sync = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await syncAuthUser(token, {
          email: user.primaryEmailAddress?.emailAddress ?? '',
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
          imageUrl: user.imageUrl ?? undefined,
        });
        synced.current = true;
      } catch {
        // non-blocking — app works without backend user record
      }
    };

    sync();
  }, [isLoaded, user, getToken]);

  return null;
}

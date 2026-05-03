import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RestoPulse — Restaurant Intelligence',
  description: 'AI-powered analytics for Mumbai restaurant owners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorBackground: '#0d0d1a', colorText: '#f1f5f9', colorPrimary: '#3b82f6', colorInputBackground: 'rgba(255,255,255,0.06)', colorInputText: '#e2e8f0' },
        elements: { card: 'glass-card', formButtonPrimary: 'bg-blue-600 hover:bg-blue-500' },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}

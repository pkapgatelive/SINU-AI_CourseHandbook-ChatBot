import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryClientProviderWrapper from '@/components/QueryClientProviderWrapper';
import { ToastProvider } from '@/components/ToastProvider';
import ConditionalHeader from '@/components/ConditionalHeader';
import Script from 'next/script';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | Next.js Chat App',
    default: 'Next.js Chat App - Modern Chat Application',
  },
  description: 'A modern chat application built with Next.js, Tailwind CSS, and TanStack React Query. Experience seamless conversations with our secure and responsive chat platform.',
  keywords: ['Next.js', 'React', 'Chat', 'Messaging', 'Real-time', 'Tailwind CSS', 'TanStack Query'],
  authors: [{ name: 'Next.js Chat App Team' }],
  creator: 'Next.js Chat App Team',
  publisher: 'Next.js Chat App',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Next.js Chat App - Modern Chat Application',
    description: 'A modern chat application built with Next.js, Tailwind CSS, and TanStack React Query. Experience seamless conversations with our secure and responsive chat platform.',
    url: 'https://your-domain.com',
    siteName: 'Next.js Chat App',
    images: [
      {
        url: 'https://your-domain.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Next.js Chat App',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Next.js Chat App - Modern Chat Application',
    description: 'A modern chat application built with Next.js, Tailwind CSS, and TanStack React Query.',
    creator: '@nextjschat',
    images: ['https://your-domain.com/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: 'var(--brand-primary)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <QueryClientProviderWrapper>
      <ToastProvider>
        <html lang="en">
          <head>
          </head>
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
          >
            <ConditionalHeader />
            <main className="flex-grow">
            {children}
          </main>
          <footer className="bg-background border-t border-secondary py-6">
            <div className="container">
              <div className="text-center text-sm text-foreground/60">
                <p>© {new Date().getFullYear()} Next.js Chat App. All rights reserved.</p>
                <p className="mt-2">
                  <a
                    href="/privacy"
                    className="text-primary hover:text-primary-hover hover:underline transition-colors duration-200"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </body>
      </html>
      </ToastProvider>
    </QueryClientProviderWrapper>
  );
}

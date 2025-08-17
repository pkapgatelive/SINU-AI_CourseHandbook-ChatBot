import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with our AI assistant. Get instant responses to your questions and have meaningful conversations.',
  keywords: ['chat', 'AI assistant', 'conversation', 'messaging'],
  openGraph: {
    title: 'Chat - Next.js Chat App',
    description: 'Chat with our AI assistant. Get instant responses to your questions and have meaningful conversations.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Chat - Next.js Chat App',
    description: 'Chat with our AI assistant. Get instant responses to your questions and have meaningful conversations.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
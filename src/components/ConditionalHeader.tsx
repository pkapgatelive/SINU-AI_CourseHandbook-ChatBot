'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Don't show header on home page
  if (pathname === '/') return null;

  return (
    <header className="bg-background border-b border-secondary sticky top-0 z-50">
      <div className="container py-4">
        <nav className="flex justify-between items-center">
          <div className="text-xl font-bold text-primary">Next.js Chat</div>
          <div className="flex space-x-6">
            <Link
              href="/"
              className="text-foreground hover:text-primary transition-colors duration-200"
            >
              Home
            </Link>
            <Link
              href="/chat"
              className="text-foreground hover:text-primary transition-colors duration-200"
            >
              Chat
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
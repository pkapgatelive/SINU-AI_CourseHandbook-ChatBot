'use client';

import { usePathname } from 'next/navigation';

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
            <a
              href="/"
              className="text-foreground hover:text-primary transition-colors duration-200"
            >
              Home
            </a>
            <a
              href="/chat"
              className="text-foreground hover:text-primary transition-colors duration-200"
            >
              Chat
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
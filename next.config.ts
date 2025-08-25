import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Make chat configuration available to client-side
    NEXT_PUBLIC_CHAT_API_ENDPOINT: process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT || '/api/chat',
    NEXT_PUBLIC_CHAT_TIMEOUT: process.env.NEXT_PUBLIC_CHAT_TIMEOUT || '30000',
    NEXT_PUBLIC_CHAT_MAX_RETRIES: process.env.NEXT_PUBLIC_CHAT_MAX_RETRIES || '3',
    NEXT_PUBLIC_CHAT_RETRY_DELAY: process.env.NEXT_PUBLIC_CHAT_RETRY_DELAY || '1000',
  },
  
  // Add script injection for chat configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Chat-Config-Injected',
            value: 'true',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

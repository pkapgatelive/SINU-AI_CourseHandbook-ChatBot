# Next.js Chat Application

A modern chat application built with Next.js 14+, Tailwind CSS, and TanStack React Query.

## Technologies Used

- [Next.js 14+](https://nextjs.org/) with App Router
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [TanStack React Query](https://tanstack.com/query/latest) for server state management
- [TypeScript](https://www.typescriptlang.org/) for type safety

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/` - React components
- `lib/` - Utility functions and configurations
- `types/` - TypeScript type definitions

## Environment Variables

Create a `.env` file with the following variables (`.env.example` is provided as a template):

```env
N8N_WEBHOOK_URL=https://ceit.app.n8n.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=10
```

### Setting Environment Variables

#### Vercel Deployment

For Vercel deployments, you can set environment variables through the Vercel dashboard:

1. Go to your project settings in the Vercel dashboard
2. Navigate to the "Environment Variables" section
3. Add the following variables:
   - `N8N_WEBHOOK_URL` - Your n8n webhook URL
   - `RATE_LIMIT_WINDOW` - Rate limit window in milliseconds (default: 900000)
   - `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window (default: 10)

You can also use the Vercel CLI:
```bash
vercel env add N8N_WEBHOOK_URL
vercel env add RATE_LIMIT_WINDOW
vercel env add RATE_LIMIT_MAX_REQUESTS
```

#### Self-hosted NGINX (Node Process)

For self-hosted deployments with NGINX, you can set environment variables in several ways:

1. **Using a systemd service file** (if running with systemd):
   ```ini
   [Service]
   Environment=N8N_WEBHOOK_URL=https://your-staging-webhook-url.com
   Environment=RATE_LIMIT_WINDOW=900000
   Environment=RATE_LIMIT_MAX_REQUESTS=10
   ```

2. **Using a .env file** in your project root that gets loaded by your process manager

3. **Setting environment variables in your shell** before starting the Node process:
   ```bash
   export N8N_WEBHOOK_URL=https://your-staging-webhook-url.com
   export RATE_LIMIT_WINDOW=900000
   export RATE_LIMIT_MAX_REQUESTS=10
   npm start
   ```

### Swapping to a Staging Webhook

To switch to a staging webhook, simply update the `N8N_WEBHOOK_URL` environment variable:

```env
# Staging webhook
N8N_WEBHOOK_URL=https://your-staging-webhook-url.com
```

This allows you to change the upstream webhook without making any code changes. The application will automatically use the new webhook URL after restarting the server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

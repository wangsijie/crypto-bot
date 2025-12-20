# Crypto Bot

A Cloudflare Workers application that monitors cryptocurrency prices and market indicators, sending updates via Telegram.

## Features

- Monitors BTC, ETH, and DOGE prices
- Tracks Fear & Greed Index from CoinMarketCap
- Calculates funding rates
- Provides trading recommendations
- Sends automated updates via Telegram

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - **For local development**: Copy `.dev.vars.example` to `.dev.vars` and fill in your values
   - **For production** (choose one method):

     **Method 1: Cloudflare Dashboard (Recommended)**
     - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
     - Navigate to: Workers & Pages > crypto-bot > Settings > Variables and Secrets
     - Add the following secrets:
       - `BOT_TOKEN`: Your Telegram bot token
       - `CHAT_ID`: Your Telegram chat ID
       - `CMC_API_KEY`: Your CoinMarketCap API key
     - ✅ **These secrets will persist across all deployments**

     **Method 2: CLI (One-time setup)**
     ```bash
     wrangler secret put BOT_TOKEN
     wrangler secret put CHAT_ID
     wrangler secret put CMC_API_KEY
     ```

3. Local development:
```bash
npm run dev
```

4. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Environment Variables

- `BOT_TOKEN`: Your Telegram bot token
- `CHAT_ID`: Your Telegram chat ID
- `CMC_API_KEY`: Your CoinMarketCap API key

## Scheduled Tasks

The worker runs automatically every 2 hours (00:30, 02:30, 04:30, 06:30, 08:30, 10:30, 12:30, 14:30 UTC) as configured in `wrangler.toml`.

You can also trigger it manually by making an HTTP request to the worker URL.

## Troubleshooting

### Variables Lost After Deployment

**Problem**: Environment variables are missing or lost after pushing new code and deploying.

**Solution**:
- Environment variables must be set in the **Cloudflare Workers dashboard** to persist across deployments
- Variables set via `wrangler secret put` are stored in the Cloudflare environment, not in your code
- Follow the setup instructions above to configure secrets in the dashboard
- Once set in the dashboard, they will remain configured even after new deployments
- You do NOT need to reset them after each `wrangler deploy`

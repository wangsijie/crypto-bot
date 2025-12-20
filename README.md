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
   - Copy `.dev.vars.example` to `.dev.vars` for local development
   - For production, set secrets using:
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

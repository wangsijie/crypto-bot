import { getFearIndex, getFearIndexHistory } from './fearIndex';
import { sendPhoto } from './telegram';
import { generateFearGreedChartUrl } from './chart';

export interface Env {
	BOT_TOKEN: string;
	CHAT_ID: string;
	CMC_API_KEY: string;
	OKX_PROXY_URL: string; // e.g., https://your-vps.com/okx
	OKX_PROXY_AUTH: string; // e.g., username:password
}

const handler = async (env: Env): Promise<{ message: string; chartUrl: string }> => {
	// Helper to fetch via proxy
	const fetchOkx = async (path: string): Promise<Response> => {
		const url = `${env.OKX_PROXY_URL}${path}`;
		const headers: Record<string, string> = {};
		if (env.OKX_PROXY_AUTH) {
			headers['Authorization'] = 'Basic ' + btoa(env.OKX_PROXY_AUTH);
		}
		return fetch(url, { headers });
	};

	const getCoinPrice = async (coin: string): Promise<number> => {
		type DataPayload = {
			last: string;
		};

		type ApiResponseType = {
			data: DataPayload;
		};

		const response = await fetchOkx(
			`/api/v5/market/index-components?index=${coin}-USDT`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch okx price');
		}

		const json = (await response.json()) as ApiResponseType;

		if (!json || !json.data) {
			throw new Error('Failed to latest stats');
		}

		return Number(json.data.last);
	};

	const getIndexTicker = async (instId: string): Promise<number> => {
		const response = await fetchOkx(
			`/api/v5/market/index-tickers?instId=${instId}`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch okx ticker');
		}

		const json = (await response.json()) as {
			data: Array<{
				idxPx: string;
			}>;
		};

		const latestIndexPrice = json.data[0]?.idxPx;

		if (!latestIndexPrice) {
			throw new Error('Failed to fetch latest index price for ' + instId);
		}

		return Number(latestIndexPrice);
	};

	type BtcPriceHistoryPoint = {
		date: string; // YYYY-MM-DD format
		price: number;
	};

	const getBtcPriceHistory = async (days = 30): Promise<BtcPriceHistoryPoint[]> => {
		// OKX candlestick API: returns [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
		const response = await fetchOkx(
			`/api/v5/market/candles?instId=BTC-USDT&bar=1D&limit=${days + 1}`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch BTC price history');
		}

		const json = (await response.json()) as {
			data: Array<[string, string, string, string, string, string, string, string, string]>;
		};

		if (!json.data || !json.data.length) {
			throw new Error('No BTC price history data returned');
		}

		// Convert to our format, data is returned newest first
		const history = json.data
			.map((candle) => {
				const timestamp = Number(candle[0]);
				const closePrice = Number(candle[4]); // Use close price
				const date = new Date(timestamp).toISOString().slice(0, 10);
				return { date, price: closePrice };
			})
			.reverse(); // Reverse to get oldest first

		return history;
	};

	type GoldPriceHistoryPoint = {
		date: string;
		price: number;
	};

	const getGoldPriceHistory = async (days = 30): Promise<GoldPriceHistoryPoint[]> => {
		// Use PAXG (Paxos Gold) as a proxy for gold price (1 PAXG ≈ 1 oz gold)
		const response = await fetchOkx(
			`/api/v5/market/candles?instId=PAXG-USDT&bar=1D&limit=${days + 1}`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch Gold (PAXG) price history');
		}

		const json = (await response.json()) as {
			data: Array<[string, string, string, string, string, string, string, string, string]>;
		};

		if (!json.data || !json.data.length) {
			throw new Error('No Gold (PAXG) price history data returned');
		}

		const history = json.data
			.map((candle) => {
				const timestamp = Number(candle[0]);
				const closePrice = Number(candle[4]);
				const date = new Date(timestamp).toISOString().slice(0, 10);
				return { date, price: closePrice };
			})
			.reverse();

		return history;
	};

	type BtcGoldRatioPoint = {
		date: string;
		ratio: number;
		normalizedRatio: number; // 0-100 scale
	};

	const calculateBtcGoldRatio = (
		btcHistory: BtcPriceHistoryPoint[],
		goldHistory: GoldPriceHistoryPoint[]
	): BtcGoldRatioPoint[] => {
		// Create a map of gold prices by date
		const goldByDate = new Map(goldHistory.map((p) => [p.date, p.price]));

		// Calculate ratio for each BTC data point
		const ratios = btcHistory
			.map((btc) => {
				const goldPrice = goldByDate.get(btc.date);
				if (!goldPrice) return null;
				return {
					date: btc.date,
					ratio: btc.price / goldPrice,
				};
			})
			.filter((r): r is { date: string; ratio: number } => r !== null);

		if (!ratios.length) return [];

		// Normalize to 0-100 scale based on min/max of the period
		const minRatio = Math.min(...ratios.map((r) => r.ratio));
		const maxRatio = Math.max(...ratios.map((r) => r.ratio));
		const range = maxRatio - minRatio || 1; // Avoid division by zero

		return ratios.map((r) => ({
			...r,
			normalizedRatio: ((r.ratio - minRatio) / range) * 100,
		}));
	};

	const getRecommendedAction = (fearIndex: number): string => {
		if (fearIndex < 25) {
			return '买入一份(冷静1天)';
		}
		if (fearIndex < 50) {
			return '买入一份(冷静7天)';
		}
		if (fearIndex < 75) {
			return '观望';
		}
		if (fearIndex < 85) {
			return '卖出一份(冷静5天)';
		}
		return '卖出一份(冷静1天)';
	};

	// Fetch all data in parallel
	const [
		[score, yesterdayScore],
		btcPrice,
		ethPrice,
		dogePrice,
		ethToBtcIndexPrice,
		fearIndexHistory,
		btcPriceHistory,
		goldPriceHistory,
	] = await Promise.all([
		getFearIndex(env.CMC_API_KEY),
		getCoinPrice('BTC'),
		getCoinPrice('ETH'),
		getCoinPrice('DOGE'),
		getIndexTicker('ETH-BTC'),
		getFearIndexHistory(env.CMC_API_KEY, 30),
		getBtcPriceHistory(30),
		getGoldPriceHistory(30),
	]);

	// Calculate BTC/Gold ratio
	const btcGoldRatioHistory = calculateBtcGoldRatio(btcPriceHistory, goldPriceHistory);
	const action = getRecommendedAction(score);

	// Ensure today's data is included in the chart
	const today = new Date().toISOString().slice(0, 10);
	const hasToday = fearIndexHistory.some(point => point.date === today);

	const historyWithToday = hasToday
		? fearIndexHistory
		: [...fearIndexHistory.slice(-(30 - 1)), { date: today, value: score }];

	// Ensure today's BTC price is included
	const hasTodayBtc = btcPriceHistory.some(point => point.date === today);
	const btcHistoryWithToday = hasTodayBtc
		? btcPriceHistory
		: [...btcPriceHistory.slice(-(30 - 1)), { date: today, price: btcPrice }];

	// Get current gold price for display
	const currentGoldPrice = goldPriceHistory[goldPriceHistory.length - 1]?.price;
	const currentBtcGoldRatio = currentGoldPrice ? (btcPrice / currentGoldPrice).toFixed(2) : 'N/A';

	const message = [
		`贪婪指数: ${Math.floor(score)}（昨日: ${Math.floor(yesterdayScore)}）`,
		`BTC: ${Math.floor(btcPrice)}`,
		`推荐操作: ${action}`,
		`ETH: ${Math.floor(ethPrice)}`,
		`DOGE: ${dogePrice.toFixed(4)}`,
		`ETH/BTC: ${ethToBtcIndexPrice}`,
		`BTC/Gold: ${currentBtcGoldRatio}`,
	].join('\n');

	const chartUrl = generateFearGreedChartUrl(historyWithToday, btcHistoryWithToday, btcGoldRatioHistory);

	return { message, chartUrl };
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			const { message, chartUrl } = await handler(env);
			// HTTP trigger: return HTML page
			const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>加密货币监控</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
			background: #0d0d1a;
			min-height: 100vh;
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 20px;
		}
		.container {
			background: #1a1a2e;
			border-radius: 16px;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
			max-width: 900px;
			width: 100%;
			overflow: hidden;
		}
		.header {
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			color: #e0e0e0;
			padding: 30px;
			text-align: center;
			border-bottom: 1px solid rgba(99, 210, 255, 0.2);
		}
		.header h1 {
			font-size: 28px;
			margin-bottom: 10px;
			color: #63d2ff;
		}
		.header p {
			opacity: 0.8;
			font-size: 14px;
			color: #b0b0b0;
		}
		.content {
			padding: 30px;
		}
		.info-box {
			background: #16213e;
			border-radius: 12px;
			padding: 24px;
			margin-bottom: 24px;
			line-height: 1.8;
			font-size: 16px;
			color: #e0e0e0;
			border: 1px solid rgba(99, 210, 255, 0.1);
		}
		.info-box div {
			margin-bottom: 8px;
		}
		.info-box div:last-child {
			margin-bottom: 0;
		}
		.info-box strong {
			color: #63d2ff;
			font-weight: 600;
		}
		.chart-box {
			text-align: center;
		}
		.chart-box h2 {
			color: #e0e0e0;
			margin-bottom: 20px;
			font-size: 20px;
		}
		.chart-box img {
			max-width: 100%;
			height: auto;
			border-radius: 8px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		}
		.footer {
			text-align: center;
			padding: 20px;
			color: #666;
			font-size: 12px;
			border-top: 1px solid rgba(255, 255, 255, 0.1);
		}
		@media (max-width: 600px) {
			.header h1 { font-size: 24px; }
			.content { padding: 20px; }
			.info-box { padding: 16px; font-size: 14px; }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>📊 加密货币监控</h1>
			<p>实时数据更新 | Crypto Market Monitor</p>
		</div>
		<div class="content">
			<div class="info-box">
				${message.split('\n').map(line => `<div>${line}</div>`).join('')}
			</div>
			<div class="chart-box">
				<h2>近30天贪婪恐慌指数走势</h2>
				<img src="${chartUrl}" alt="Fear & Greed Index Chart">
			</div>
		</div>
		<div class="footer">
			数据更新时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
		</div>
	</div>
</body>
</html>`;
			return new Response(html, {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			});
		} catch (error) {
			console.error('Error:', error);
			const errorHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>错误</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: #f5f5f5;
			padding: 20px;
		}
		.error-box {
			background: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			max-width: 500px;
			text-align: center;
		}
		h1 { color: #e74c3c; margin-bottom: 16px; }
		p { color: #666; line-height: 1.6; }
	</style>
</head>
<body>
	<div class="error-box">
		<h1>⚠️ 出错了</h1>
		<p>${String(error)}</p>
	</div>
</body>
</html>`;
			return new Response(errorHtml, {
				status: 500,
				headers: { 'content-type': 'text/html; charset=utf-8' },
			});
		}
	},

	async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
		try {
			const { message, chartUrl } = await handler(env);
			// Send photo with message as caption
			await sendPhoto(chartUrl, message, env.BOT_TOKEN, env.CHAT_ID);
			console.log('Scheduled task completed successfully');
		} catch (error) {
			console.error('Scheduled task error:', error);
		}
	},
};

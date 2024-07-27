import { CryptoStats, GlobalVolume, stringifyCryptoStats, stringifyGlobalVolume } from './utils';

const sendMessage = async (message: string) => {
	const botToken = process.env.BOT_TOKEN;
	const baseUrl = `https://api.telegram.org/bot${botToken}`;
	const chatId = process.env.CHAT_ID;

	if (!chatId) {
		console.log('No chat id, skip sending message', message);
		return;
	}

	const url = `${baseUrl}/sendMessage`;
	const response = await fetch(url, {
		body: JSON.stringify({
			chat_id: Number(chatId),
			text: message,
		}),
		method: 'POST',
		headers: {
			'content-type': 'application/json;charset=UTF-8',
		},
	});

	if (!response.ok) {
		throw new Error('Failed to send message');
	}
};

const handler = async () => {
	const cmcApiKey = process.env.CMC_API_KEY;

	const getGlobalMetrics = async (): Promise<{
		btc: number;
		eth: number;
		globalVolume: GlobalVolume;
	}> => {
		type ApiResponseType = {
			data: {
				btc_dominance: number;
				eth_dominance: number;
				quote: {
					USD: GlobalVolume;
				};
			};
		};

		if (!cmcApiKey) {
			throw new Error('No CMC API key');
		}

		const response = await fetch(
			'https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest',
			{
				headers: {
					'X-CMC_PRO_API_KEY': cmcApiKey,
				},
			}
		);

		if (!response.ok) {
			throw new Error('Failed to fetch coinmarketcap.com');
		}

		const json = (await response.json()) as ApiResponseType;

		const {
			btc_dominance,
			eth_dominance,
			quote: {
				USD: {
					total_volume_24h,
					total_market_cap,
					total_market_cap_yesterday,
					total_volume_24h_yesterday,
					total_market_cap_yesterday_percentage_change,
					total_volume_24h_yesterday_percentage_change,
				},
			},
		} = json.data;

		return {
			btc: btc_dominance,
			eth: eth_dominance,
			globalVolume: {
				total_volume_24h,
				total_market_cap,
				total_market_cap_yesterday,
				total_volume_24h_yesterday,
				total_market_cap_yesterday_percentage_change,
				total_volume_24h_yesterday_percentage_change,
			},
		};
	};

	const getCoinPrice = async (coin: string): Promise<number> => {
		type DataPayload = {
			last: string;
		};

		type ApiResponseType = {
			data: DataPayload;
		};

		const response = await fetch(
			`https://www.okx.com/api/v5/market/index-components?index=${coin}-USDT`
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
		const response = await fetch(`https://www.okx.com/api/v5/market/index-tickers?instId=${instId}`);

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
	}

	const getLatestStats = async (): Promise<{
		btc?: CryptoStats;
	}> => {
		type DataPayload = {
			id: number;
			symbol: string;
			quote: {
				USD: CryptoStats;
			};
		};

		type ApiResponseType = {
			data: DataPayload[];
		};

		if (!cmcApiKey) {
			throw new Error('No CMC API key');
		}

		const response = await fetch(
			'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
			{
				headers: {
					'X-CMC_PRO_API_KEY': cmcApiKey,
				},
			}
		);

		if (!response.ok) {
			throw new Error('Failed to fetch coinmarketcap.com');
		}

		const json = (await response.json()) as ApiResponseType;

		if (!json || !json.data) {
			throw new Error('Failed to latest stats');
		}

		const btcPayload = json.data.find(({ symbol }) => symbol === 'BTC'); // BTC coinMarketCap id 1

		return { btc: btcPayload?.quote.USD };
	};

	const getFearIndex = async (): Promise<[number, number]> => {
		const response = await fetch('https://api.coin-stats.com/v2/fear-greed');

		if (!response.ok) {
			throw new Error('Failed to fetch api.coin-stats.com');
		}

		const json = (await response.json()) as {
			now: { value: string };
			yesterday: { value: string };
		};

		return [Number(json.now.value), Number(json.yesterday.value)];
	};

	const getFundingRate = async (): Promise<number> => {
		const response = await fetch(
			'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP'
		);

		if (!response.ok) {
			throw new Error('Failed to fetch okx');
		}

		const json = (await response.json()) as {
			data: Array<{
				fundingRate: string;
			}>;
		};

		const rate = json.data[0]?.fundingRate;

		if (!rate) {
			throw new Error('Failed to fetch funding rate');
		}

		return Math.round(Number(rate) * 100 * 1000) / 1000;
	};

	// Refactor the following code with promise.all
	const [
		[score, yesterdayScore],
		{ btc, globalVolume },
		{ btc: btcStats },
		fundingRate,
		btcPrice,
		ethPrice,
		ethToBtcIndexPrice,
	] = await Promise.all([
		getFearIndex(),
		getGlobalMetrics(),
		getLatestStats(),
		getFundingRate(),
		getCoinPrice('BTC'),
		getCoinPrice('ETH'),
		getIndexTicker('ETH-BTC'),
	]);

	return [
		`贪婪指数: ${Math.floor(score)}（昨日: ${Math.floor(yesterdayScore)}）`,
		`BTC: ${Math.floor(btcPrice)}`,
		`合约费率: ${fundingRate}% 年化 ${Math.round(fundingRate * 365 * 3)}%`,
		`ETH: ${Math.floor(ethPrice)}`,
		`ETH/BTC: ${ethToBtcIndexPrice}`,
		'',
		...(btcStats
			? stringifyCryptoStats({
					...btcStats,
					total_volume_24h: globalVolume.total_volume_24h,
					dominance: btc,
			  })
			: []),
		'',
		...stringifyGlobalVolume(globalVolume),
		'',
	].join('\n');
};

void handler().then(sendMessage);

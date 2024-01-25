/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { CryptoStats, GlobalVolume, stringifyCryptoStats, stringifyGlobalVolume } from './utils';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;

	BOT_TOKEN: string;
	CHAT_ID: string;
	CMC_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('Hello World!');
	},
	async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
		const botToken = env.BOT_TOKEN;
		const baseUrl = `https://api.telegram.org/bot${botToken}`;
		const chatId = env.CHAT_ID;
		const cmcApiKey = env.CMC_API_KEY;

		const sendMessage = async (message: string) => {
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

		const getLatestStats = async (): Promise<{ btc?: CryptoStats; eth?: CryptoStats }> => {
			type DataPayload = {
				id: number;
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

			const btcPayload = json.data.find(({ id }) => id === 1); // BTC coinMarketCap id 1
			const ethPayload = json.data.find(({ id }) => id === 1027); // ETH coinMarketCap id 1027

			return { btc: btcPayload?.quote.USD, eth: ethPayload?.quote.USD };
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

		const [score, yesterdayScore] = await getFearIndex();
		const { btc, globalVolume } = await getGlobalMetrics();
		const { btc: btcStats } = await getLatestStats();

		await sendMessage(
			[
				`贪婪指数: ${Math.floor(score)}（昨日: ${Math.floor(yesterdayScore)}）`,
				`BTC: ${btcStats && Math.floor(btcStats.price)}`,
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
			].join('\n')
		);
	},
};

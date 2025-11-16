import 'dotenv/config';
import { getFearIndex } from './fearIndex';
import { sendMessage } from './telegram';

const handler = async () => {
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
		const response = await fetch(
			`https://www.okx.com/api/v5/market/index-tickers?instId=${instId}`
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

	const getRecommendedPositionSize = (fearIndex: number): number => {
		if (fearIndex < 10) {
			return 3.0;
		}
		if (fearIndex < 20) {
			return 3.0 - ((fearIndex - 10) / 10) * 1.0;
		}
		if (fearIndex < 40) {
			return 2 - ((fearIndex - 20) / 20) * 1.25;
		}
		if (fearIndex < 80) {
			return 0.75 - ((fearIndex - 40) / 40) * 0.25;
		}
		return 0.25;
	};

	// Refactor the following code with promise.all
	const [[score, yesterdayScore], fundingRate, btcPrice, ethPrice, dogePrice, ethToBtcIndexPrice] =
		await Promise.all([
			getFearIndex(),
			getFundingRate(),
			getCoinPrice('BTC'),
			getCoinPrice('ETH'),
			getCoinPrice('DOGE'),
			getIndexTicker('ETH-BTC'),
		]);
	const positionSize = getRecommendedPositionSize(score);

	return [
		`贪婪指数: ${Math.floor(score)}（昨日: ${Math.floor(yesterdayScore)}）`,
		`BTC: ${Math.floor(btcPrice)}`,
		`合约费率: ${fundingRate}% 年化 ${Math.round(fundingRate * 365 * 3)}%`,
		`推荐仓位: ${Math.round(positionSize * 100)}%`,
		`ETH: ${Math.floor(ethPrice)}`,
		`DOGE: ${dogePrice.toFixed(4)}`,
		`ETH/BTC: ${ethToBtcIndexPrice}`,
	].join('\n');
};

void handler().then(sendMessage);

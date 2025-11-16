import 'dotenv/config';

type LatestResponse = {
	data?: {
		value?: number | string;
		score?: number | string;
		fg_index?: number | string;
		value_classification?: string;
		update_time?: string;
	};
};

type HistoricalEntry = {
	timestamp?: number | string;
	time?: number | string;
	updated_at?: number | string;
	value?: number | string;
	score?: number | string;
	fg_index?: number | string;
	value_score?: number | string;
	value_classification?: string;
};

type HistoricalResponse =
	| {
			data?:
				| HistoricalEntry[]
				| {
						data?: HistoricalEntry[];
						values?: HistoricalEntry[];
						points?: HistoricalEntry[];
						quotes?: HistoricalEntry[];
				  };
	  }
	| HistoricalEntry[];

const parseNumericValue = (value: unknown): number => {
	const numericValue = Number(value);
	if (Number.isNaN(numericValue)) {
		throw new Error('Received invalid fear & greed value from CoinMarketCap');
	}
	return numericValue;
};

const normalizeTimestamp = (
	timestamp?: number | string,
	fallbacks: Array<number | string | undefined> = []
): number => {
	const sources = [timestamp, ...fallbacks];
	for (const source of sources) {
		if (source === undefined) {
			continue;
		}
		if (typeof source === 'number') {
			const normalized = source > 1_000_000_000_000 ? source : source * 1000;
			return normalized;
		}
		if (typeof source === 'string') {
			const trimmed = source.trim();
			if (/^\d+(\.\d+)?$/.test(trimmed)) {
				const asNumber = Number(trimmed);
				if (!Number.isNaN(asNumber)) {
					return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
				}
			}
			const parsed = Date.parse(trimmed);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}
	}
	return Number.NaN;
};

const requestFearAndGreedApi = async (input: string | URL): Promise<unknown> => {
	const apiKey = process.env.CMC_API_KEY;
	if (!apiKey) {
		throw new Error('Missing CMC_API_KEY');
	}

	const response = await fetch(input, {
		headers: {
			accept: 'application/json',
			'X-CMC_PRO_API_KEY': apiKey,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch CoinMarketCap fear & greed data from ${input.toString()}`);
	}

	return response.json();
};

const fetchLatestIndex = async (): Promise<number> => {
	const json = (await requestFearAndGreedApi(
		'https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest'
	)) as LatestResponse;
	const latestValue = json?.data?.value ?? json?.data?.score ?? json?.data?.fg_index;
	return parseNumericValue(latestValue);
};

const fetchYesterdayIndex = async (): Promise<number> => {
	const historicalUrl = new URL('https://pro-api.coinmarketcap.com/v3/fear-and-greed/historical');
	historicalUrl.searchParams.set('limit', '10');

	const json = (await requestFearAndGreedApi(historicalUrl)) as HistoricalResponse;
	const entries = (() => {
		if (Array.isArray(json)) {
			return json;
		}
		const payload = json?.data;
		if (Array.isArray(payload)) {
			return payload;
		}
		if (payload && typeof payload === 'object') {
			const nested = payload as {
				data?: HistoricalEntry[];
				values?: HistoricalEntry[];
				points?: HistoricalEntry[];
				quotes?: HistoricalEntry[];
			};
			return nested.data ?? nested.values ?? nested.points ?? nested.quotes ?? [];
		}
		return [];
	})();

	if (!entries.length) {
		throw new Error('No historical fear & greed data returned by CoinMarketCap');
	}

	const todayKey = new Date().toISOString().slice(0, 10);

	const normalizedEntries = entries
		.map((entry) => {
			const timestamp = normalizeTimestamp(entry.timestamp, [entry.time, entry.updated_at]);
			const value = entry.value ?? entry.score ?? entry.fg_index ?? entry.value_score;
			if (Number.isNaN(timestamp) || value === undefined) {
				return undefined;
			}
			return { timestamp, value: parseNumericValue(value) };
		})
		.filter((entry): entry is { timestamp: number; value: number } => !!entry)
		.sort((a, b) => b.timestamp - a.timestamp);

	if (!normalizedEntries.length) {
		throw new Error('Unable to parse historical fear & greed data from CoinMarketCap');
	}

	const yesterdayEntry =
		normalizedEntries.find((entry) => new Date(entry.timestamp).toISOString().slice(0, 10) !== todayKey) ??
		normalizedEntries[0];

	return yesterdayEntry.value;
};

export const getFearIndex = async (): Promise<[number, number]> => {
	const [today, yesterday] = await Promise.all([fetchLatestIndex(), fetchYesterdayIndex()]);
	return [today, yesterday];
};

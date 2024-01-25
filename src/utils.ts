export type CryptoStats = {
	price: number;
	volume_24h: number;
	percent_change_1h: number;
	percent_change_24h: number;
	market_cap: number;
};

export type GlobalVolume = {
	total_volume_24h: number;
	total_market_cap: number;
	total_market_cap_yesterday: number;
	total_volume_24h_yesterday: number;
	total_market_cap_yesterday_percentage_change: number;
	total_volume_24h_yesterday_percentage_change: number;
};

export const formatNumberWithCommas = (number_: number): string =>
	number_.toFixed(2).replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');

export const prettifyBigNumber = (number_: number): string => {
	const million = 1_000_000;
	const billion = 1_000_000_000;
	const trillion = 1_000_000_000_000;
	if (number_ < million) {
		return formatNumberWithCommas(number_);
	}
	if (million <= number_ && number_ < billion) {
		return `${formatNumberWithCommas(number_ / million)} m`;
	}
	if (billion <= number_ && number_ < trillion) {
		return `${formatNumberWithCommas(number_ / billion)} b`;
	}
	return `${formatNumberWithCommas(number_ / trillion)} t`;
};

export const stringifyCryptoStats = (
	stats: CryptoStats & { total_volume_24h?: number; dominance: number }
): string[] => {
	const { dominance, volume_24h, percent_change_1h, percent_change_24h, market_cap, total_volume_24h } =
		stats;
	return [
		`占比: ${Math.floor(dominance)}%`,
		`1 小时涨跌幅: ${Math.floor(percent_change_1h)}%`,
		`24 小时涨跌幅: ${Math.floor(percent_change_24h)}%`,
		`24 小时换手率: ${Math.floor((100 * volume_24h) / market_cap)}%`,
		`24 小时成交量: ${prettifyBigNumber(volume_24h)}`,
		...(total_volume_24h
			? [`24 小时成交额占比: ${Math.floor((100 * volume_24h) / total_volume_24h)}%`]
			: []),
	];
};

export const stringifyGlobalVolume = (stats: GlobalVolume): string[] => {
	const {
		total_market_cap_yesterday_percentage_change,
		total_volume_24h_yesterday_percentage_change,
	} = stats;
	return [
		`市值变化: ${total_market_cap_yesterday_percentage_change.toFixed(2)}%`,
		`成交额变化: ${total_volume_24h_yesterday_percentage_change.toFixed(2)}%`,
	];
};

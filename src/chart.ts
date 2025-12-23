import type { FearIndexHistoryPoint } from './fearIndex';

export type BtcPriceHistoryPoint = {
	date: string; // YYYY-MM-DD format
	price: number;
};

export type BtcGoldRatioHistoryPoint = {
	date: string;
	ratio: number;
	normalizedRatio: number; // 0-100 scale for chart display
};

/**
 * Generate a chart URL for Fear & Greed Index history using QuickChart.io
 * @param history Array of historical fear & greed index data points
 * @param btcPriceHistory Optional array of BTC price history data points
 * @param btcGoldRatioHistory Optional array of BTC/Gold ratio history data points
 * @returns URL to the generated chart image
 */
export const generateFearGreedChartUrl = (
	history: FearIndexHistoryPoint[],
	btcPriceHistory?: BtcPriceHistoryPoint[],
	btcGoldRatioHistory?: BtcGoldRatioHistoryPoint[]
): string => {
	if (!history.length) {
		throw new Error('No history data provided for chart generation');
	}

	// Extract labels (dates) and data (values)
	const labels = history.map((point) => {
		// Format date as MM-DD for better readability
		const date = new Date(point.date);
		return `${date.getMonth() + 1}-${date.getDate()}`;
	});
	const data = history.map((point) => point.value);

	// Match BTC price data to fear index dates
	const btcPriceData = btcPriceHistory
		? history.map((point) => {
				const btcPoint = btcPriceHistory.find((bp) => bp.date === point.date);
				return btcPoint ? btcPoint.price : null;
		  })
		: null;

	// Match BTC/Gold ratio data to fear index dates (using normalized values)
	const btcGoldData = btcGoldRatioHistory
		? history.map((point) => {
				const ratioPoint = btcGoldRatioHistory.find((rp) => rp.date === point.date);
				return ratioPoint ? ratioPoint.normalizedRatio : null;
		  })
		: null;

	// Build datasets array
	const datasets: Array<Record<string, unknown>> = [
		{
			label: '贪婪恐慌指数',
			data,
			fill: true,
			backgroundColor: 'rgba(99, 210, 255, 0.2)',
			borderColor: 'rgb(99, 210, 255)',
			borderWidth: 2,
			pointRadius: 3,
			pointBackgroundColor: 'rgb(99, 210, 255)',
			tension: 0.3, // Smooth line
			yAxisID: 'y-axis-0',
		},
	];

	// Add BTC price dataset if available
	if (btcPriceData) {
		datasets.push({
			label: 'BTC 价格 (USDT)',
			data: btcPriceData,
			fill: false,
			borderColor: 'rgb(255, 178, 102)',
			borderWidth: 2,
			pointRadius: 2,
			pointBackgroundColor: 'rgb(255, 178, 102)',
			tension: 0.3,
			yAxisID: 'y-axis-1',
		});
	}

	// Add BTC/Gold ratio dataset if available (shares y-axis-0 with fear index)
	if (btcGoldData) {
		datasets.push({
			label: 'BTC/Gold 比率',
			data: btcGoldData,
			fill: false,
			borderColor: 'rgb(255, 99, 132)',
			borderWidth: 2,
			pointRadius: 2,
			pointBackgroundColor: 'rgb(255, 99, 132)',
			tension: 0.3,
			borderDash: [5, 5], // Dashed line to distinguish from fear index
			yAxisID: 'y-axis-0', // Share with fear index (both 0-100)
		});
	}

	// Create Chart.js configuration with dark mode
	const chartConfig = {
		type: 'line',
		data: {
			labels,
			datasets,
		},
		options: {
			title: {
				display: true,
				text: btcPriceData && btcGoldData
					? '近30天贪婪恐慌指数 & BTC价格 & BTC/Gold'
					: btcPriceData
					? '近30天贪婪恐慌指数 & BTC价格'
					: '近30天贪婪恐慌指数',
				fontSize: 18,
				fontColor: '#e0e0e0',
			},
			scales: {
				yAxes: [
					{
						id: 'y-axis-0',
						position: 'left',
						ticks: {
							beginAtZero: false,
							min: 0,
							max: 100,
							stepSize: 20,
							fontColor: '#b0b0b0',
						},
						scaleLabel: {
							display: true,
							labelString: '指数值',
							fontColor: 'rgb(99, 210, 255)',
						},
						gridLines: {
							color: 'rgba(255, 255, 255, 0.1)',
						},
					},
					...(btcPriceData
						? [
								{
									id: 'y-axis-1',
									position: 'right',
									ticks: {
										fontColor: 'rgb(255, 178, 102)',
										callback: (value: number) => `$${Math.round(value / 1000)}k`,
									},
									scaleLabel: {
										display: true,
										labelString: 'BTC (USDT)',
										fontColor: 'rgb(255, 178, 102)',
									},
									gridLines: {
										drawOnChartArea: false,
									},
								},
						  ]
						: []),
				],
				xAxes: [
					{
						scaleLabel: {
							display: true,
							labelString: '日期',
							fontColor: '#b0b0b0',
						},
						ticks: {
							maxRotation: 45,
							minRotation: 45,
							fontColor: '#b0b0b0',
						},
						gridLines: {
							color: 'rgba(255, 255, 255, 0.1)',
						},
					},
				],
			},
			legend: {
				display: true,
				position: 'top',
				labels: {
					fontColor: '#e0e0e0',
				},
			},
			plugins: {
				// Add reference lines for fear/greed zones
				annotation: {
					annotations: [
						{
							type: 'line',
							mode: 'horizontal',
							scaleID: 'y-axis-0',
							value: 25,
							borderColor: 'rgba(255, 99, 132, 0.5)',
							borderWidth: 1,
							borderDash: [5, 5],
							label: {
								enabled: true,
								content: '极度恐慌',
								position: 'left',
							},
						},
						{
							type: 'line',
							mode: 'horizontal',
							scaleID: 'y-axis-0',
							value: 50,
							borderColor: 'rgba(255, 206, 86, 0.5)',
							borderWidth: 1,
							borderDash: [5, 5],
							label: {
								enabled: true,
								content: '中立',
								position: 'left',
							},
						},
						{
							type: 'line',
							mode: 'horizontal',
							scaleID: 'y-axis-0',
							value: 75,
							borderColor: 'rgba(54, 162, 235, 0.5)',
							borderWidth: 1,
							borderDash: [5, 5],
							label: {
								enabled: true,
								content: '贪婪',
								position: 'left',
							},
						},
					],
				},
			},
		},
	};

	// Encode chart configuration for URL
	const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));

	// QuickChart.io URL with configuration
	// Using width=800, height=400 for good mobile/desktop viewing
	const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}&width=800&height=400&backgroundColor=%231a1a2e`;

	return chartUrl;
};

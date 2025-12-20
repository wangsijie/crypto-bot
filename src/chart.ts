import type { FearIndexHistoryPoint } from './fearIndex';

/**
 * Generate a chart URL for Fear & Greed Index history using QuickChart.io
 * @param history Array of historical fear & greed index data points
 * @returns URL to the generated chart image
 */
export const generateFearGreedChartUrl = (history: FearIndexHistoryPoint[]): string => {
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

	// Create Chart.js configuration
	const chartConfig = {
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label: '贪婪恐慌指数',
					data,
					fill: true,
					backgroundColor: 'rgba(75, 192, 192, 0.2)',
					borderColor: 'rgb(75, 192, 192)',
					borderWidth: 2,
					pointRadius: 3,
					pointBackgroundColor: 'rgb(75, 192, 192)',
					tension: 0.3, // Smooth line
				},
			],
		},
		options: {
			title: {
				display: true,
				text: '近30天贪婪恐慌指数',
				fontSize: 18,
				fontColor: '#333',
			},
			scales: {
				yAxes: [
					{
						ticks: {
							beginAtZero: false,
							min: 0,
							max: 100,
							stepSize: 20,
						},
						scaleLabel: {
							display: true,
							labelString: '指数值',
						},
					},
				],
				xAxes: [
					{
						scaleLabel: {
							display: true,
							labelString: '日期',
						},
						ticks: {
							maxRotation: 45,
							minRotation: 45,
						},
					},
				],
			},
			legend: {
				display: true,
				position: 'top',
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
	const chartUrl = `https://quickchart.io/chart?c=${encodedConfig}&width=800&height=400&backgroundColor=white`;

	return chartUrl;
};

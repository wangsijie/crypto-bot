import { type NextRequest, NextResponse } from 'next/server';

const botToken = process.env.BOT_TOKEN;
const baseUrl = `https://api.telegram.org/bot${botToken}`;
const chatId = process.env.CHAT_ID;
const cmcApiKey = process.env.CMC_API_KEY;

type CryptoStats = {
  price: number;
  volume_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  market_cap: number;
};

type GlobalVolume = {
  total_volume_24h: number;
  total_market_cap: number;
  total_market_cap_yesterday: number;
  total_volume_24h_yesterday: number;
  total_market_cap_yesterday_percentage_change: number;
  total_volume_24h_yesterday_percentage_change: number;
};

const formatNumberWithCommas = (number_: number): string =>
  number_.toFixed(2).replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');

const prettifyBigNumber = (number_: number): string => {
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

const stringifyCryptoStats = (stats: CryptoStats & { total_volume_24h?: number }): string[] => {
  const { price, volume_24h, percent_change_1h, percent_change_24h, market_cap, total_volume_24h } =
    stats;
  return [
    `价格: ${price.toFixed(2)} USD`,
    `1 小时涨跌幅: ${percent_change_1h.toFixed(2)}%`,
    `24 小时涨跌幅: ${percent_change_24h.toFixed(2)}%`,
    `24 小时换手率: ${((100 * volume_24h) / market_cap).toFixed(2)}%`,
    `24 小时成交量: ${prettifyBigNumber(volume_24h)}`,
    ...(total_volume_24h
      ? [`24 小时成交额占比: ${((100 * volume_24h) / total_volume_24h).toFixed(2)}%`]
      : []),
  ];
};

const stringifyGlobalVolume = (stats: GlobalVolume): string[] => {
  const {
    total_volume_24h,
    total_market_cap,
    total_market_cap_yesterday,
    total_volume_24h_yesterday,
    total_market_cap_yesterday_percentage_change,
    total_volume_24h_yesterday_percentage_change,
  } = stats;
  return [
    `当前市值: ${prettifyBigNumber(total_market_cap)}`,
    `昨日市值: ${prettifyBigNumber(total_market_cap_yesterday)}`,
    `24 小时市值涨跌幅: ${total_market_cap_yesterday_percentage_change.toFixed(2)}%`,
    `昨日成交额: ${prettifyBigNumber(total_volume_24h_yesterday)}`,
    `24 小时成交额: ${prettifyBigNumber(total_volume_24h)}`,
    `24 小时成交额涨跌幅: ${total_volume_24h_yesterday_percentage_change.toFixed(2)}%`,
  ];
};

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
    cache: 'no-store',
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

const getFearIndex = async (): Promise<number> => {
  const response = await fetch('https://coinmarketcap.com/', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch coinmarketcap.com');
  }

  const html = await response.text();
  const match = /"score":([^,]+)/.exec(html);

  if (!match || !match[1]) {
    throw new Error('Failed to parse coinmarketcap.com');
  }

  const score = Number(match[1]);

  return score;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false },
      {
        status: 401,
      }
    );
  }

  try {
    const score = await getFearIndex();
    const { btc, eth, globalVolume } = await getGlobalMetrics();
    const { btc: btcStats, eth: ethStats } = await getLatestStats();

    await sendMessage(
      [
        `贪婪指数: ${Math.floor(score)}`,
        '',
        ...stringifyGlobalVolume(globalVolume),
        '',
        `BTC 占比: ${btc.toFixed(2)}%`,
        ...(btcStats
          ? stringifyCryptoStats({ ...btcStats, total_volume_24h: globalVolume.total_volume_24h })
          : []),
        '',
        `ETH 占比: ${eth.toFixed(2)}%`,
        ...(ethStats
          ? stringifyCryptoStats({ ...ethStats, total_volume_24h: globalVolume.total_volume_24h })
          : []),
      ].join('\n')
    );

    return NextResponse.json({ score }, { headers: { 'cache-control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

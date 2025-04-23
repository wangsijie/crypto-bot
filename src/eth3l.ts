import { sendMessage } from "./telegram";

async function getETH3LPrice(): Promise<number> {
  const url = 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=ETH3LUSDT';
  const res = await fetch(url);
  const data = await res.json();
  return parseFloat(data.result.list[0].lastPrice);
}

async function getETH3LNAV(): Promise<number> {
  const url = 'https://api.bybit.com/v5/spot-lever-token/reference?ltCoin=ETH3L';
  const res = await fetch(url);
  const data = await res.json();

  const navStr = data?.result?.nav;
  if (!navStr || isNaN(parseFloat(navStr))) {
    throw new Error('无法从接口解析出 ETH3L 的 NAV 值');
  }

  return parseFloat(navStr);
}

async function main(): Promise<void> {
  try {
    const price = await getETH3LPrice();
    const nav = await getETH3LNAV();
    const diff = Math.abs(price - nav) / nav;

    console.log(`Price: ${price}, NAV: ${nav}, Diff: ${(diff * 100).toFixed(2)}%`);

    if (diff > 0.03) {
      const msg = `⚠️ ETH3L 警报\n现价: ${price}\nNAV: ${nav}\n偏差: ${(diff * 100).toFixed(2)}%`;
      await sendMessage(msg);
      console.log('✅ 已发送 Telegram 通知');
    } else {
      console.log('✅ 差价正常，无需通知');
    }
  } catch (err: any) {
    console.error('❌ 错误:', err.message);
  }
}

main();

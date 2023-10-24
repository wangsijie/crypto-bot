import { NextRequest, NextResponse } from "next/server";

const botToken = process.env.BOT_TOKEN;
const baseUrl = `https://api.telegram.org/bot${botToken}`;
const chatId = process.env.CHAT_ID;
const cmcApiKey = process.env.CMC_API_KEY;

const sendMessage = async (message: string) => {
  if (!chatId) {
    console.log("No chat id, skip sending message", message);
    return;
  }

  const url = `${baseUrl}/sendMessage`;
  const response = await fetch(url, {
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
    method: "POST",
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to send message");
  }
};

const getDominance = async (): Promise<number> => {
  if (!cmcApiKey) {
    throw new Error("No CMC API key");
  }

  const response = await fetch(
    "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest",
    {
      headers: {
        "X-CMC_PRO_API_KEY": cmcApiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch coinmarketcap.com");
  }

  const json = await response.json();

  const dominance = json.data.btc_dominance;

  return dominance;
};

const getFearIndex = async (): Promise<number> => {
  const response = await fetch("https://coinmarketcap.com/", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch coinmarketcap.com");
  }

  const html = await response.text();
  const match = html.match(/"score":([^,]+)/);

  if (!match || !match[1]) {
    throw new Error("Failed to parse coinmarketcap.com");
  }

  const score = Number(match[1]);

  return score;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false },
      {
        status: 401,
      }
    );
  }

  try {
    const score = await getFearIndex();
    const dominance = await getDominance();

    await sendMessage(
      `恐慌贪婪指数: ${Math.floor(score)}，BTC占比: ${Math.floor(dominance)}%`
    );

    return NextResponse.json(
      { score },
      { headers: { "cache-control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

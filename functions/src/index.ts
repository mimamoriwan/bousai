import * as dotenv from "dotenv";
dotenv.config();

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {
  validateSignature,
  Client,
  WebhookEvent,
  LocationMessage,
  TextMessage,
  ImageMessage,
} from "@line/bot-sdk";
import axios from "axios";

// ---------------------------------------------------------------------------
// Global options
// ---------------------------------------------------------------------------
setGlobalOptions({ maxInstances: 10 });

// ---------------------------------------------------------------------------
// LINE SDK の設定
// ---------------------------------------------------------------------------
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
};

const lineClient = new Client(lineConfig);

// ---------------------------------------------------------------------------
// Yahoo! 気象情報 API のレスポンス型（必要な部分のみ）
// ---------------------------------------------------------------------------
interface YahooWeatherFeature {
  Property: {
    WeatherList: {
      Weather: Array<{
        Type: string; // "observation" | "forecast"
        Date: string;
        Rainfall: number;
      }>;
    };
  };
}

interface YahooWeatherResponse {
  Feature?: YahooWeatherFeature[];
}

// ---------------------------------------------------------------------------
// お散歩アドバイス生成ロジック
// ---------------------------------------------------------------------------
async function getWalkAdvice(lat: number, lng: number): Promise<string> {
  const yahooClientId = process.env.YAHOO_CLIENT_ID ?? "";

  const url = "https://map.yahooapis.jp/weather/V1/place";
  const params = {
    coordinates: `${lng},${lat}`,
    output: "json",
    appid: yahooClientId,
  };

  let data: YahooWeatherResponse;
  try {
    const response = await axios.get<YahooWeatherResponse>(url, { params });
    data = response.data;
  } catch (err) {
    logger.error("Yahoo Weather API request failed", err);
    return "天気情報の取得に失敗しました。しばらくしてから再度お試しください🙇";
  }

  const weatherList =
    data.Feature?.[0]?.Property?.WeatherList?.Weather ?? [];

  if (weatherList.length === 0) {
    return "天気情報を取得できませんでした。別の場所をお試しください🐾";
  }

  // observation（現在）と forecast（予報）に分類
  const observations = weatherList.filter((w) => w.Type === "observation");
  const forecasts = weatherList.filter((w) => w.Type === "forecast");

  const currentRainfall =
    observations.length > 0 ? observations[observations.length - 1].Rainfall : 0;

  // 今後60分以内に rainfall > 0 になるか
  const rainSoon = forecasts.some((w) => w.Rainfall > 0);

  // 現在の雨量閾値：0.5mm/h 以上を「雨あり」とみなす
  const isRainingNow = currentRainfall >= 0.5;

  // 雨量別メッセージ
  if (isRainingNow) {
    const mm = currentRainfall.toFixed(1);
    if (currentRainfall >= 10) {
      return (
        `☔️ 現在、強い雨が降っています（${mm}mm/h）。\n` +
        "お散歩は中止して、安全な場所で雨宿りしてください🐶💦"
      );
    } else {
      return (
        `🌧 現在、雨が降っています（${mm}mm/h）。\n` +
        "お散歩はお休みして、室内で過ごしてあげましょう☔️"
      );
    }
  }

  if (rainSoon) {
    // いつ頃から降り始めるか
    const firstRainForecast = forecasts.find((w) => w.Rainfall > 0);
    if (firstRainForecast) {
      const dateStr = firstRainForecast.Date; // "YYYYMMDDHHmm" 形式
      const hh = dateStr.slice(8, 10);
      const mm = dateStr.slice(10, 12);
      return (
        `⚠️ まもなく（${hh}:${mm}頃から）雨が降りそうです。\n` +
        "お散歩は短めに済ませるか、もう少し待ったほうがいいかも☔️\n" +
        "レインコートの準備もお忘れなく🐾"
      );
    }
    return (
      "⚠️ 今後60分以内に雨が降りそうです。\n" +
      "お散歩は短めに済ませるか、様子を見てから出かけましょう☔️"
    );
  }

  // 終日降水なし
  return (
    "✅ 今は雨が降っていません。お散歩のチャンスです🐾\n" +
    "今後60分も雨の心配なし！思いっきり楽しんできてください🐶☀️"
  );
}

// ---------------------------------------------------------------------------
// LINE Webhook ハンドラー
// ---------------------------------------------------------------------------
async function handleEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== "message") {
    logger.info("Unsupported event type, skipping.", { eventType: event.type });
    return;
  }

  const replyToken = (event as { replyToken: string }).replyToken;
  const messageType = event.message.type;

  // ── テキストメッセージ：「お散歩予報」のときだけ反応 ───────────────────
  if (messageType === "text") {
    const textBody = (event.message as { text: string }).text.trim();
    if (textBody !== "お散歩予報") {
      // それ以外のテキストは無視
      return;
    }
    const imageMsg: ImageMessage = {
      type: "image",
      originalContentUrl: "https://i.imgur.com/CpicTpd.jpeg",
      previewImageUrl: "https://i.imgur.com/CpicTpd.jpeg",
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "location",
              label: "📍現在地を送る",
            },
          },
        ],
      },
    };
    await lineClient.replyMessage(replyToken, imageMsg);
    return;
  }

  // ── 位置情報メッセージ：お散歩予報を返す ─────────────────────────────
  if (messageType === "location") {
    const locationMessage = event.message as LocationMessage;
    const { latitude, longitude } = locationMessage;

    logger.info("Received location message", { latitude, longitude });

    const adviceText = await getWalkAdvice(latitude, longitude);

    const replyMessage: TextMessage = {
      type: "text",
      text: adviceText,
    };

    await lineClient.replyMessage(replyToken, replyMessage);
    return;
  }

  // ── その他のメッセージタイプはスキップ ────────────────────────────────
  logger.info("Unsupported message type, skipping.", { messageType });
}

// ---------------------------------------------------------------------------
// Cloud Functions エクスポート
// ---------------------------------------------------------------------------

// Firebase Functions は req.body を自動でパースするため、middleware() による
// 署名検証が機能しない。rawBody バッファ を使って手動で検証する。
export const webhook = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    // ── 1. 署名を取得 ──────────────────────────────────────────────────────
    const signature = req.headers["x-line-signature"] as string | undefined;
    if (!signature) {
      logger.warn("Missing x-line-signature header");
      res.status(401).send("Unauthorized");
      return;
    }

    // ── 2. rawBody で署名を検証 ────────────────────────────────────────────
    // Firebase Functions は req.rawBody に生のバッファを保持している
    const rawBody: Buffer = (req as unknown as { rawBody: Buffer }).rawBody;
    const channelSecret = lineConfig.channelSecret;

    if (!validateSignature(rawBody, channelSecret, signature)) {
      logger.error("LINE signature verification failed");
      res.status(401).send("Unauthorized");
      return;
    }

    // ── 3. イベントを処理 ─────────────────────────────────────────────────
    const events: WebhookEvent[] =
      (req.body as { events: WebhookEvent[] }).events;

    try {
      await Promise.all(events.map(handleEvent));
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error handling LINE events", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

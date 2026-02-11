import { Client, WebhookEvent, TextMessage, validateSignature } from "@line/bot-sdk";
import { ENV } from "./env";

/**
 * LINE Messaging API Client
 */
const lineClient = new Client({
  channelAccessToken: ENV.lineChannelAccessToken,
  channelSecret: ENV.lineChannelSecret,
});

/**
 * Webhook署名を検証
 */
export function verifyLineSignature(body: string, signature: string): boolean {
  return validateSignature(body, ENV.lineChannelSecret, signature);
}

/**
 * LINEメッセージを送信
 */
export async function sendLineMessage(userId: string, messages: TextMessage[]): Promise<void> {
  try {
    await lineClient.pushMessage(userId, messages);
  } catch (error) {
    console.error("[LINE] Failed to send message:", error);
    throw error;
  }
}

/**
 * テキストメッセージを送信（簡易版）
 */
export async function sendLineTextMessage(userId: string, text: string): Promise<void> {
  await sendLineMessage(userId, [{ type: "text", text }]);
}

/**
 * Webhookイベントを処理
 */
export async function handleLineWebhook(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      console.log("[LINE] Received message:", event.message.text);
      // メッセージ処理はrouters.tsで実装
    } else if (event.type === "follow") {
      console.log("[LINE] User followed:", event.source.userId);
      // フォローイベント処理はrouters.tsで実装
    } else if (event.type === "unfollow") {
      console.log("[LINE] User unfollowed:", event.source.userId);
      // アンフォローイベント処理はrouters.tsで実装
    }
  }
}

/**
 * LINE User IDからプロフィール情報を取得
 */
export async function getLineProfile(userId: string) {
  try {
    return await lineClient.getProfile(userId);
  } catch (error) {
    console.error("[LINE] Failed to get profile:", error);
    throw error;
  }
}

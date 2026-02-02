/**
 * クライアント側環境変数
 */

export const ENV = {
  /** LIFF ID（LINE Front-end Framework） */
  liffId: import.meta.env.VITE_LIFF_ID as string | undefined,
  /** アプリケーションID */
  appId: import.meta.env.VITE_APP_ID as string,
  /** OAuth Portal URL */
  oauthPortalUrl: import.meta.env.VITE_OAUTH_PORTAL_URL as string,
} as const;

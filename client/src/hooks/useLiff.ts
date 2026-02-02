/**
 * LIFF（LINE Front-end Framework）フック
 * LIFF SDKの初期化とLINE認証を管理
 */

import { useState, useEffect } from "react";
import liff from "@line/liff";
import { trpc } from "@/lib/trpc";

interface UseLiffOptions {
  /** LIFF IDが設定されている場合のみ自動初期化 */
  liffId?: string;
  /** 自動ログインを有効にするか */
  autoLogin?: boolean;
}

interface UseLiffReturn {
  /** LIFF初期化が完了したか */
  isReady: boolean;
  /** LIFF初期化中か */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** LINEログイン済みか */
  isLoggedIn: boolean;
  /** LINEユーザーID */
  lineUserId: string | null;
  /** LIFF経由でシステムにログイン */
  loginWithLiff: () => Promise<void>;
}

export function useLiff(options: UseLiffOptions = {}): UseLiffReturn {
  const { liffId, autoLogin = true } = options;
  
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  const authenticateMutation = trpc.liff.authenticate.useMutation();

  // LIFF初期化
  useEffect(() => {
    if (!liffId) {
      setIsLoading(false);
      return;
    }

    const initializeLiff = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // LIFF初期化
        await liff.init({ liffId });
        setIsReady(true);

        // LINEログイン状態を確認
        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);

          // 自動ログインが有効な場合、システムにログイン
          if (autoLogin) {
            await loginWithLiff(profile.userId);
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("[LIFF] Initialization failed:", err);
        setError(err instanceof Error ? err.message : "LIFF初期化に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    initializeLiff();
  }, [liffId, autoLogin]);

  // LIFF経由でシステムにログイン
  const loginWithLiff = async (userId?: string) => {
    try {
      const targetUserId = userId || lineUserId;
      
      if (!targetUserId) {
        throw new Error("LINE User ID not found");
      }

      // 既に認証済みかチェック（無限リロード防止）
      const authKey = `liff_auth_${targetUserId}`;
      const isAlreadyAuthenticated = sessionStorage.getItem(authKey);
      
      if (isAlreadyAuthenticated) {
        console.log("[LIFF] Already authenticated, skipping reload");
        return;
      }

      const result = await authenticateMutation.mutateAsync({
        lineUserId: targetUserId,
      });

      if (!result.success) {
        throw new Error(result.message || "認証に失敗しました");
      }

      // 認証成功をマーク
      sessionStorage.setItem(authKey, "true");
      
      // 認証成功後、ページをリロードしてセッションを反映
      window.location.reload();
    } catch (err) {
      console.error("[LIFF] Login failed:", err);
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      throw err;
    }
  };

  return {
    isReady,
    isLoading,
    error,
    isLoggedIn,
    lineUserId,
    loginWithLiff,
  };
}

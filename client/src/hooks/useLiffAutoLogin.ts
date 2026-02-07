import { useState, useEffect } from "react";
import liff from "@line/liff";
import { trpc } from "@/lib/trpc";
import { ENV } from "@/env";

export function useLiffAutoLogin() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const loginMutation = trpc.liffAuth.loginOrRegister.useMutation();

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: ENV.liffId || "2009029347-SE3MfVUQ" });

        if (!liff.isLoggedIn()) {
          // LINEログインしていない場合はログイン画面へ
          liff.login();
          return;
        }

        // LINEアクセストークンとユーザーIDを取得
        const accessToken = liff.getAccessToken();
        const profile = await liff.getProfile();

        if (!accessToken || !profile.userId) {
          throw new Error("Failed to get LINE credentials");
        }

        // バックエンドでログイン・ユーザー登録
        const result = await loginMutation.mutateAsync({
          lineUserId: profile.userId,
          lineAccessToken: accessToken,
        });

        if (result.success && result.sessionToken) {
          // セッショントークンをクッキーに保存
          document.cookie = `session=${result.sessionToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          
          setIsNewUser(result.isNewUser || false);
          setIsLoggedIn(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[LIFF Auto Login] Error:", err);
        setError(err instanceof Error ? err.message : "ログインに失敗しました");
        setIsLoading(false);
      }
    };

    initLiff();
  }, []);

  return {
    isLoading,
    error,
    isLoggedIn,
    isNewUser,
  };
}

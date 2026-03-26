import React from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLiff } from "@/hooks/useLiff";
import { ENV } from "@/env";

interface LiffLayoutProps {
  children: React.ReactNode;
}

/**
 * LIFF専用レイアウト
 * - DashboardLayout（Manusアカウント必須）を使わない
 * - LINE認証（LIFF）のみで動作する
 * - LINEアプリ内ブラウザからのアクセスを前提とする
 */
export default function LiffLayout({ children }: LiffLayoutProps) {
  const { isLoading, error } = useLiff({
    liffId: ENV.liffId,
    autoLogin: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-green-600" />
          <p className="text-sm text-muted-foreground">LINE認証中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white p-4">
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              LINE認証に失敗しました。LINEアプリから再度アクセスしてください。
              <br />
              <span className="text-xs opacity-70">{error}</span>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* シンプルなヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">入</span>
        </div>
        <span className="font-semibold text-gray-800 text-sm">三重県入札情報</span>
      </header>

      {/* コンテンツ */}
      <main className="container py-6 max-w-2xl">
        {children}
      </main>
    </div>
  );
}

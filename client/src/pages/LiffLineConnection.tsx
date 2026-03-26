import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Bell } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import LiffLayout from "@/components/LiffLayout";

export default function LiffLineConnection() {
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: connection, isLoading, refetch } = trpc.line.getConnection.useQuery();
  const generateCodeMutation = trpc.line.generateCode.useMutation();
  const disconnectMutation = trpc.line.disconnect.useMutation();

  const handleGenerateCode = async () => {
    try {
      const result = await generateCodeMutation.mutateAsync();
      setVerificationCode(result.code);
      toast.success("認証コードを発行しました");
    } catch (error) {
      console.error("Failed to generate code:", error);
      toast.error("認証コードの発行に失敗しました");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("LINE連携を解除しますか？")) return;

    try {
      await disconnectMutation.mutateAsync();
      setVerificationCode(null);
      await refetch();
      toast.success("LINE連携を解除しました");
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("LINE連携の解除に失敗しました");
    }
  };

  if (isLoading) {
    return (
      <LiffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </LiffLayout>
    );
  }

  const isConnected = !!connection;

  return (
    <LiffLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">LINE連携</h1>
        <p className="text-sm text-muted-foreground">
          LINEアカウントと連携して、入札情報の通知をLINEで受け取ることができます
        </p>
      </div>

      {/* 連携状態カード */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                連携済み
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-muted-foreground" />
                未連携
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? `${connection.lineDisplayName || "LINE"} アカウントと連携中`
              : "まだLINEアカウントと連携していません"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/liff/notifications")}
                className="w-full"
              >
                <Bell className="mr-2 h-4 w-4" />
                通知設定を確認する
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="w-full"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                連携を解除する
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 認証コード発行 */}
              {!verificationCode ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    下のボタンを押すと認証コードが発行されます。
                    LINEのトーク画面でコードを送信してください。
                  </p>
                  <Button
                    onClick={handleGenerateCode}
                    disabled={generateCodeMutation.isPending}
                    className="w-full"
                  >
                    {generateCodeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    認証コードを発行する
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription>
                      <p className="font-medium text-green-800 mb-2">認証コードが発行されました</p>
                      <div className="bg-white border border-green-300 rounded-lg p-3 text-center">
                        <span className="text-3xl font-bold tracking-widest text-green-700">
                          {verificationCode}
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium">連携手順：</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1">
                      <li>このLINEの公式アカウントのトーク画面を開く</li>
                      <li>上記の認証コードをメッセージとして送信する</li>
                      <li>連携完了のメッセージが届いたら完了</li>
                    </ol>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateCode}
                    disabled={generateCodeMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    コードを再発行する
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="w-full"
                  >
                    連携状態を確認する
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </LiffLayout>
  );
}

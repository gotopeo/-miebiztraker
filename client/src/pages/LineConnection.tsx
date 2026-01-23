import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function LineConnection() {
  const [verificationCode, setVerificationCode] = useState<string | null>(null);

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
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isConnected = !!connection;

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">LINE連携</h1>
        <p className="text-muted-foreground">
          LINEアカウントと連携して、入札情報の通知をLINEで受け取ることができます
        </p>
      </div>

      {/* 連携状態カード */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
              ? "LINEアカウントと連携されています"
              : "LINEアカウントとの連携が必要です"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">連携アカウント</p>
                <p className="font-medium">{connection.lineDisplayName || "LINE User"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  連携日時: {new Date(connection.connectedAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                連携を解除
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  LINE連携を行うと、設定した条件に一致する新着入札情報をLINEで受け取ることができます。
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleGenerateCode}
                disabled={generateCodeMutation.isPending || !!verificationCode}
              >
                {generateCodeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                認証コードを発行
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 認証コード表示カード */}
      {verificationCode && !isConnected && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>認証コード</CardTitle>
            <CardDescription>
              以下の手順でLINE連携を完了してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 認証コード */}
            <div className="p-6 bg-primary/5 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">認証コード</p>
              <p className="text-4xl font-bold tracking-wider text-primary">
                {verificationCode}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                有効期限: 30分
              </p>
            </div>

            {/* 手順 */}
            <div className="space-y-4">
              <h3 className="font-semibold">連携手順</h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    1
                  </span>
                  <span>
                    下のボタンから「MieBid Tracker」公式アカウントを友だち追加してください
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    2
                  </span>
                  <span>
                    LINEのトーク画面で、上記の6桁の認証コードを送信してください
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    3
                  </span>
                  <span>
                    連携完了のメッセージが届いたら、このページを更新してください
                  </span>
                </li>
              </ol>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <a
                  href="https://line.me/R/ti/p/@YOUR_LINE_ID"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  友だち追加
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                状態を更新
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                認証コードは30分間有効です。有効期限が切れた場合は、新しいコードを発行してください。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* 説明カード */}
      {!isConnected && !verificationCode && (
        <Card>
          <CardHeader>
            <CardTitle>LINE連携について</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              LINE連携を行うことで、以下の機能が利用できます：
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>設定した条件に一致する新着入札情報をLINEで受信</li>
              <li>指定した時刻に定期的に通知を受け取る</li>
              <li>複数の通知条件を設定可能</li>
            </ul>
            <p className="text-xs">
              ※ LINE連携を解除すると、通知の受信ができなくなります。通知設定は保持されます。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

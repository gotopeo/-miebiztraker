import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle, Home, Loader2, Play } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function ScrapingLogs() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: logs, isLoading, refetch } = trpc.scraping.getLogs.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const executeMutation = trpc.scraping.execute.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          `スクレイピング完了: ${result.newItems}件の新規案件を取得しました`
        );
        refetch();
      } else {
        toast.error(`スクレイピング失敗: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleExecute = () => {
    if (confirm("スクレイピングを実行しますか?")) {
      executeMutation.mutate();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>認証が必要です</CardTitle>
            <CardDescription>この機能を使用するにはログインしてください</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">スクレイピング実行</h1>
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              ホーム
            </Button>
          </Link>
        </div>
      </header>

      <main className="container py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>手動実行</CardTitle>
            <CardDescription>
              三重県入札情報サイトから最新の入札情報を取得します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              size="lg"
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  実行中...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  スクレイピング実行
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              ※ 実行には30秒〜1分程度かかる場合があります
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>実行履歴</CardTitle>
            <CardDescription>過去のスクレイピング実行履歴</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>実行日時</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>取得件数</TableHead>
                      <TableHead>新規件数</TableHead>
                      <TableHead>エラー</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.startedAt).toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          {log.executionType === "manual" ? "手動" : "スケジュール"}
                        </TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              成功
                            </span>
                          ) : log.status === "failed" ? (
                            <span className="inline-flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              失敗
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              実行中
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{log.itemsScraped || 0}</TableCell>
                        <TableCell>{log.newItems || 0}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {log.errorMessage || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                実行履歴がありません
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

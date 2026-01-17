import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Download, Home, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function BiddingList() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [orderOrganCode, setOrderOrganCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = trpc.biddings.search.useQuery(
    {
      keyword: keyword || undefined,
      orderOrganCode: orderOrganCode || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      pageSize,
    },
    {
      enabled: isAuthenticated,
    }
  );

  const exportCsvQuery = trpc.biddings.exportCsv.useQuery(
    {
      keyword: keyword || undefined,
      orderOrganCode: orderOrganCode || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    {
      enabled: false,
    }
  );

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const handleExportCsv = async () => {
    try {
      const result = await exportCsvQuery.refetch();
      if (!result.data) {
        toast.error("データの取得に失敗しました");
        return;
      }

      // CSVデータを生成
      const headers = [
        "案件番号",
        "案件名",
        "発注機関名",
        "入札日",
        "予定価格",
        "状態",
      ];
      const rows = result.data.map((item) => [
        item.caseNumber,
        item.title,
        item.orderOrganName || "",
        item.biddingDate ? new Date(item.biddingDate).toLocaleDateString("ja-JP") : "",
        item.estimatedPrice || "",
        item.status || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // BOMを追加してExcelで正しく開けるようにする
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `biddings_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("CSVファイルをダウンロードしました");
    } catch (error) {
      console.error("CSV export error:", error);
      toast.error("CSVエクスポートに失敗しました");
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
          <h1 className="text-2xl font-bold text-foreground">入札情報検索</h1>
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
            <CardTitle>検索条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="keyword">キーワード</Label>
                <Input
                  id="keyword"
                  placeholder="案件名で検索"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <Label htmlFor="orderOrganCode">発注機関コード</Label>
                <Input
                  id="orderOrganCode"
                  placeholder="例: 2025173100"
                  value={orderOrganCode}
                  onChange={(e) => setOrderOrganCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <Label htmlFor="startDate">開始日</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">終了日</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="h-4 w-4 mr-2" />
                検索
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={exportCsvQuery.isFetching}
              >
                <Download className="h-4 w-4 mr-2" />
                CSVエクスポート
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>検索結果</CardTitle>
            <CardDescription>
              {data ? `${data.total}件中 ${data.items.length}件を表示` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : data && data.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>案件番号</TableHead>
                        <TableHead>案件名</TableHead>
                        <TableHead>発注機関</TableHead>
                        <TableHead>入札日</TableHead>
                        <TableHead>状態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {item.caseNumber}
                          </TableCell>
                          <TableCell className="max-w-md">{item.title}</TableCell>
                          <TableCell>{item.orderOrganName}</TableCell>
                          <TableCell>
                            {item.biddingDate
                              ? new Date(item.biddingDate).toLocaleDateString("ja-JP")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {item.status || "不明"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {data.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      前へ
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      {page} / {data.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === data.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                データがありません
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

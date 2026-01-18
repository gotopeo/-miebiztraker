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
import { Download, FileSpreadsheet, Home, Loader2, Search } from "lucide-react";
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
  
  // 詳細検索条件
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const exportExcelMutation = trpc.biddings.exportExcel.useMutation();

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportExcelMutation.mutateAsync({
        keyword: keyword || undefined,
        orderOrganCode: orderOrganCode || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!result.success) {
        toast.error("Excelエクスポートに失敗しました");
        return;
      }

      // Base64データをBlobに変換
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // ダウンロード
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Excelファイルをダウンロードしました");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Excelエクスポート中にエラーが発生しました");
    }
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
      toast.error("CSVエクスポート中にエラーが発生しました");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>認証が必要です</CardTitle>
            <CardDescription>この機能を使用するにはログインしてください。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">入札情報一覧</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>検索条件</CardTitle>
            <CardDescription>キーワードや条件を指定して入札情報を検索できます</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={exportExcelMutation.isPending}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excelエクスポート
              </Button>
              <Button onClick={() => setShowAdvanced(!showAdvanced)} variant="outline">
                {showAdvanced ? "詳細検索を閉じる" : "詳細検索"}
              </Button>
            </div>

            {showAdvanced && (
              <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-sm font-semibold mb-4">詳細検索条件</h3>
                <p className="text-sm text-muted-foreground">
                  詳細検索条件は今後のアップデートで実装予定です。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>検索結果</CardTitle>
            <CardDescription>
              {data?.items.length ?? 0}件の入札情報が見つかりました（全{data?.total ?? 0}件中）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
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
                        <TableHead>入札方式</TableHead>
                        <TableHead>格付</TableHead>
                        <TableHead>状態</TableHead>
                        <TableHead>入札日</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.caseNumber}</TableCell>
                          <TableCell className="max-w-md">{item.title}</TableCell>
                          <TableCell>{item.orderOrganName || "-"}</TableCell>
                          <TableCell>{item.biddingMethod || "-"}</TableCell>
                          <TableCell>{item.rating || "-"}</TableCell>
                          <TableCell>{item.status || "-"}</TableCell>
                          <TableCell>
                            {item.biddingDate
                              ? new Date(item.biddingDate).toLocaleDateString("ja-JP")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    ページ {page} / {Math.ceil((data.total ?? 0) / pageSize)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      前へ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= Math.ceil((data.total ?? 0) / pageSize)}
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                検索条件に一致する入札情報が見つかりませんでした
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

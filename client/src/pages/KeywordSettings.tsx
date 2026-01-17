import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Home, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function KeywordSettings() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [newKeyword, setNewKeyword] = useState("");

  const { data: keywords, isLoading, refetch } = trpc.keywords.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const addMutation = trpc.keywords.add.useMutation({
    onSuccess: () => {
      toast.success("キーワードを追加しました");
      setNewKeyword("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.keywords.delete.useMutation({
    onSuccess: () => {
      toast.success("キーワードを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = trpc.keywords.update.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleAdd = () => {
    if (!newKeyword.trim()) {
      toast.error("キーワードを入力してください");
      return;
    }
    addMutation.mutate({ keyword: newKeyword.trim() });
  };

  const handleDelete = (id: number) => {
    if (confirm("このキーワードを削除しますか?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleToggle = (id: number, enabled: boolean) => {
    updateMutation.mutate({ id, enabled });
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
          <h1 className="text-2xl font-bold text-foreground">キーワード監視設定</h1>
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
            <CardTitle>新規キーワード追加</CardTitle>
            <CardDescription>
              監視したいキーワードを登録すると、該当する新規案件を通知します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="newKeyword" className="sr-only">
                  キーワード
                </Label>
                <Input
                  id="newKeyword"
                  placeholder="例: 道路工事、橋梁、etc"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <Button onClick={handleAdd} disabled={addMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                追加
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>登録済みキーワード</CardTitle>
            <CardDescription>
              {keywords ? `${keywords.length}件のキーワードが登録されています` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : keywords && keywords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>キーワード</TableHead>
                      <TableHead>登録日時</TableHead>
                      <TableHead>有効/無効</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="font-medium">{keyword.keyword}</TableCell>
                        <TableCell>
                          {new Date(keyword.createdAt).toLocaleDateString("ja-JP")}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={keyword.enabled}
                            onCheckedChange={(checked) =>
                              handleToggle(keyword.id, checked)
                            }
                            disabled={updateMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(keyword.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                キーワードが登録されていません
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

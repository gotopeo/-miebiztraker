import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function ScheduleSettings() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly" | "custom">("daily");
  const [executionTime, setExecutionTime] = useState("09:00");
  const [daysOfWeek, setDaysOfWeek] = useState("");

  const { data: schedules, isLoading, refetch } = trpc.schedules.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const addMutation = trpc.schedules.add.useMutation({
    onSuccess: () => {
      toast.success("スケジュールを追加しました");
      setName("");
      setScheduleType("daily");
      setExecutionTime("09:00");
      setDaysOfWeek("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => {
      toast.success("スケジュールを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error("スケジュール名を入力してください");
      return;
    }
    if (!executionTime) {
      toast.error("実行時刻を入力してください");
      return;
    }

    addMutation.mutate({
      name: name.trim(),
      scheduleType,
      executionTime,
      daysOfWeek: scheduleType === "weekly" ? daysOfWeek : undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("このスケジュールを削除しますか?")) {
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
          <h1 className="text-2xl font-bold text-foreground">スケジュール設定</h1>
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
            <CardTitle>新規スケジュール追加</CardTitle>
            <CardDescription>
              自動スクレイピングのスケジュールを設定します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">スケジュール名</Label>
                <Input
                  id="name"
                  placeholder="例: 毎日午前9時実行"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="scheduleType">実行頻度</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(value: "daily" | "weekly" | "custom") =>
                    setScheduleType(value)
                  }
                >
                  <SelectTrigger id="scheduleType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">毎日</SelectItem>
                    <SelectItem value="weekly">毎週</SelectItem>
                    <SelectItem value="custom">カスタム（未実装）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="executionTime">実行時刻</Label>
                <Input
                  id="executionTime"
                  type="time"
                  value={executionTime}
                  onChange={(e) => setExecutionTime(e.target.value)}
                />
              </div>

              {scheduleType === "weekly" && (
                <div>
                  <Label htmlFor="daysOfWeek">曜日（カンマ区切り）</Label>
                  <Input
                    id="daysOfWeek"
                    placeholder="例: 1,3,5 (月・水・金)"
                    value={daysOfWeek}
                    onChange={(e) => setDaysOfWeek(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    0=日曜, 1=月曜, 2=火曜, 3=水曜, 4=木曜, 5=金曜, 6=土曜
                  </p>
                </div>
              )}

              <Button onClick={handleAdd} disabled={addMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                追加
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>登録済みスケジュール</CardTitle>
            <CardDescription>
              {schedules ? `${schedules.length}件のスケジュールが登録されています` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : schedules && schedules.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>実行時刻</TableHead>
                      <TableHead>最終実行</TableHead>
                      <TableHead>有効/無効</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium">{schedule.name}</TableCell>
                        <TableCell>
                          {schedule.scheduleType === "daily"
                            ? "毎日"
                            : schedule.scheduleType === "weekly"
                            ? "毎週"
                            : "カスタム"}
                        </TableCell>
                        <TableCell>{schedule.executionTime}</TableCell>
                        <TableCell>
                          {schedule.lastExecutedAt
                            ? new Date(schedule.lastExecutedAt).toLocaleString("ja-JP")
                            : "未実行"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={schedule.enabled}
                            onCheckedChange={(checked) =>
                              handleToggle(schedule.id, checked)
                            }
                            disabled={updateMutation.isPending}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(schedule.id)}
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
                スケジュールが登録されていません
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">注意事項</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700">
              現在、スケジュール機能は設定のみ可能で、実際の自動実行は未実装です。
              <br />
              今後のアップデートで自動実行機能を追加予定です。
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

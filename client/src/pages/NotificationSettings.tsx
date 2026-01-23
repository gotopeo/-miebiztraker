import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Bell, BellOff, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

interface NotificationFormData {
  name: string;
  orderOrganCodes: string;
  publicationDateDays: string;
  updateDateDays: string;
  keywords: string;
  ratings: string;
  estimatedPriceMin: string;
  estimatedPriceMax: string;
  notificationTimes: string;
}

const initialFormData: NotificationFormData = {
  name: "",
  orderOrganCodes: "",
  publicationDateDays: "",
  updateDateDays: "",
  keywords: "",
  ratings: "",
  estimatedPriceMin: "",
  estimatedPriceMax: "",
  notificationTimes: "08:00",
};

export default function NotificationSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(initialFormData);

  const { data: subscriptions, isLoading, refetch } = trpc.notifications.list.useQuery();
  const { data: lineConnection } = trpc.line.getConnection.useQuery();
  const createMutation = trpc.notifications.create.useMutation();
  const updateMutation = trpc.notifications.update.useMutation();
  const deleteMutation = trpc.notifications.delete.useMutation();
  const testMutation = trpc.notifications.sendTest.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        orderOrganCodes: formData.orderOrganCodes || undefined,
        publicationDateDays: formData.publicationDateDays ? parseInt(formData.publicationDateDays) : undefined,
        updateDateDays: formData.updateDateDays ? parseInt(formData.updateDateDays) : undefined,
        keywords: formData.keywords || undefined,
        ratings: formData.ratings || undefined,
        estimatedPriceMin: formData.estimatedPriceMin || undefined,
        estimatedPriceMax: formData.estimatedPriceMax || undefined,
        notificationTimes: formData.notificationTimes,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast.success("通知設定を更新しました");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("通知設定を作成しました");
      }

      setIsDialogOpen(false);
      setEditingId(null);
      setFormData(initialFormData);
      refetch();
    } catch (error) {
      console.error("Failed to save notification:", error);
      toast.error("通知設定の保存に失敗しました");
    }
  };

  const handleEdit = (subscription: any) => {
    setEditingId(subscription.id);
    setFormData({
      name: subscription.name,
      orderOrganCodes: subscription.orderOrganCodes || "",
      publicationDateDays: subscription.publicationDateDays?.toString() || "",
      updateDateDays: subscription.updateDateDays?.toString() || "",
      keywords: subscription.keywords || "",
      ratings: subscription.ratings || "",
      estimatedPriceMin: subscription.estimatedPriceMin || "",
      estimatedPriceMax: subscription.estimatedPriceMax || "",
      notificationTimes: subscription.notificationTimes || "08:00",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この通知設定を削除しますか？")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("通知設定を削除しました");
      refetch();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("通知設定の削除に失敗しました");
    }
  };

  const handleSendTest = async (subscriptionId: number) => {
    try {
      await testMutation.mutateAsync({ subscriptionId });
      toast.success("テスト通知を送信しました。LINEを確認してください。");
    } catch (error: any) {
      console.error("Failed to send test notification:", error);
      toast.error(error.message || "テスト通知の送信に失敗しました");
    }
  };

  const handleToggleEnabled = async (id: number, enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, enabled });
      toast.success(enabled ? "通知を有効化しました" : "通知を無効化しました");
      refetch();
    } catch (error) {
      console.error("Failed to toggle notification:", error);
      toast.error("通知設定の更新に失敗しました");
    }
  };

  const handleNewNotification = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
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

  const isLineConnected = !!lineConnection;

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">通知設定</h1>
          <p className="text-muted-foreground">
            条件に一致する新着入札情報をLINEで受け取る設定を管理します
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewNotification} disabled={!isLineConnected}>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "通知設定を編集" : "新しい通知設定"}
                </DialogTitle>
                <DialogDescription>
                  条件に一致する新着入札情報を指定した時刻に通知します
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* 設定名 */}
                <div className="space-y-2">
                  <Label htmlFor="name">設定名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: 県発注の土木工事"
                    required
                  />
                </div>

                {/* 発注機関コード */}
                <div className="space-y-2">
                  <Label htmlFor="orderOrganCodes">発注機関コード</Label>
                  <Input
                    id="orderOrganCodes"
                    value={formData.orderOrganCodes}
                    onChange={(e) => setFormData({ ...formData, orderOrganCodes: e.target.value })}
                    placeholder="複数の場合はカンマ区切り（例: 001,002）"
                  />
                  <p className="text-xs text-muted-foreground">
                    空欄の場合は全ての発注機関が対象になります
                  </p>
                </div>

                {/* 公告日フィルター */}
                <div className="space-y-2">
                  <Label htmlFor="publicationDateDays">公告日フィルター（日数）</Label>
                  <Input
                    id="publicationDateDays"
                    type="number"
                    value={formData.publicationDateDays}
                    onChange={(e) => setFormData({ ...formData, publicationDateDays: e.target.value })}
                    placeholder="例: 7（過去7日間）"
                  />
                </div>

                {/* 更新日フィルター */}
                <div className="space-y-2">
                  <Label htmlFor="updateDateDays">更新日フィルター（日数）</Label>
                  <Input
                    id="updateDateDays"
                    type="number"
                    value={formData.updateDateDays}
                    onChange={(e) => setFormData({ ...formData, updateDateDays: e.target.value })}
                    placeholder="例: 3（過去3日間）"
                  />
                </div>

                {/* キーワード */}
                <div className="space-y-2">
                  <Label htmlFor="keywords">キーワード</Label>
                  <Input
                    id="keywords"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    placeholder="複数の場合はカンマ区切り（例: 道路,橋梁）"
                  />
                </div>

                {/* 格付 */}
                <div className="space-y-2">
                  <Label htmlFor="ratings">格付</Label>
                  <Input
                    id="ratings"
                    value={formData.ratings}
                    onChange={(e) => setFormData({ ...formData, ratings: e.target.value })}
                    placeholder="複数の場合はカンマ区切り（例: A,B）"
                  />
                </div>

                {/* 予定価格 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedPriceMin">予定価格（最小）</Label>
                    <Input
                      id="estimatedPriceMin"
                      type="number"
                      value={formData.estimatedPriceMin}
                      onChange={(e) => setFormData({ ...formData, estimatedPriceMin: e.target.value })}
                      placeholder="円"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedPriceMax">予定価格（最大）</Label>
                    <Input
                      id="estimatedPriceMax"
                      type="number"
                      value={formData.estimatedPriceMax}
                      onChange={(e) => setFormData({ ...formData, estimatedPriceMax: e.target.value })}
                      placeholder="円"
                    />
                  </div>
                </div>

                {/* 通知時刻 */}
                <div className="space-y-2">
                  <Label htmlFor="notificationTimes">通知時刻 *</Label>
                  <Input
                    id="notificationTimes"
                    value={formData.notificationTimes}
                    onChange={(e) => setFormData({ ...formData, notificationTimes: e.target.value })}
                    placeholder="複数の場合はカンマ区切り（例: 08:00,12:00,17:00）"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    HH:MM形式で入力してください
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "更新" : "作成"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* LINE未連携の警告 */}
      {!isLineConnected && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            通知を受け取るには、LINEアカウントとの連携が必要です。
            <Link href="/line-connection">
              <Button variant="link" className="p-0 h-auto ml-1">
                LINE連携ページ
              </Button>
            </Link>
            から連携を行ってください。
          </AlertDescription>
        </Alert>
      )}

      {/* 通知設定一覧 */}
      {subscriptions && subscriptions.length > 0 ? (
        <div className="grid gap-4">
          {subscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {subscription.enabled ? (
                        <Bell className="h-5 w-5 text-primary" />
                      ) : (
                        <BellOff className="h-5 w-5 text-muted-foreground" />
                      )}
                      {subscription.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      通知時刻: {subscription.notificationTimes}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={subscription.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(subscription.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(subscription)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subscription.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendTest(subscription.id)}
                      disabled={testMutation.isPending}
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="ml-2">テスト通知</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {subscription.orderOrganCodes && (
                    <div>
                      <span className="text-muted-foreground">発注機関:</span>{" "}
                      {subscription.orderOrganCodes}
                    </div>
                  )}
                  {subscription.publicationDateDays && (
                    <div>
                      <span className="text-muted-foreground">公告日:</span>{" "}
                      過去{subscription.publicationDateDays}日間
                    </div>
                  )}
                  {subscription.updateDateDays && (
                    <div>
                      <span className="text-muted-foreground">更新日:</span>{" "}
                      過去{subscription.updateDateDays}日間
                    </div>
                  )}
                  {subscription.keywords && (
                    <div>
                      <span className="text-muted-foreground">キーワード:</span>{" "}
                      {subscription.keywords}
                    </div>
                  )}
                  {subscription.ratings && (
                    <div>
                      <span className="text-muted-foreground">格付:</span>{" "}
                      {subscription.ratings}
                    </div>
                  )}
                  {(subscription.estimatedPriceMin || subscription.estimatedPriceMax) && (
                    <div>
                      <span className="text-muted-foreground">予定価格:</span>{" "}
                      {subscription.estimatedPriceMin && `${parseInt(subscription.estimatedPriceMin).toLocaleString()}円〜`}
                      {subscription.estimatedPriceMax && `${parseInt(subscription.estimatedPriceMax).toLocaleString()}円`}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              通知設定がありません
            </p>
            {isLineConnected && (
              <Button onClick={handleNewNotification}>
                <Plus className="mr-2 h-4 w-4" />
                最初の通知設定を作成
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

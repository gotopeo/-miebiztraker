import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useLocation } from "wouter";
import LiffLayout from "@/components/LiffLayout";
import { CONSTRUCTION_TYPES } from "../../../shared/constructionTypes";

interface NotificationFormData {
  name: string;
  issuerIds: number[];
  projectTypes: string[];
  notificationTimes: string;
}

const initialFormData: NotificationFormData = {
  name: "",
  issuerIds: [],
  projectTypes: [],
  notificationTimes: "08:00",
};

export default function LiffNotificationSettings() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(initialFormData);

  const { data: subscriptions, isLoading, refetch } = trpc.notifications.list.useQuery();
  const { data: lineConnection } = trpc.line.getConnection.useQuery();
  const { data: issuers } = trpc.issuers.list.useQuery();

  const issuerOptions = useMemo(() => {
    if (!issuers) return [];
    return issuers.map((issuer) => ({
      label: issuer.name,
      value: String(issuer.id),
    }));
  }, [issuers]);

  const createMutation = trpc.notifications.create.useMutation();
  const updateMutation = trpc.notifications.update.useMutation();
  const deleteMutation = trpc.notifications.delete.useMutation();
  const testMutation = trpc.notifications.sendTest.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        issuerIds: formData.issuerIds.length > 0 ? formData.issuerIds.join(",") : undefined,
        projectType: formData.projectTypes.length > 0 ? formData.projectTypes.join(",") : undefined,
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
      setFormData(initialFormData);
      setEditingId(null);
      refetch();
    } catch (error) {
      console.error("Failed to save notification:", error);
      toast.error("通知設定の保存に失敗しました");
    }
  };

  const handleEdit = (subscription: any) => {
    setEditingId(subscription.id);
    let issuerIdsArray: number[] = [];
    if (subscription.orderOrganNames && issuers) {
      const organNames = subscription.orderOrganNames.split(",").map((n: string) => n.trim());
      issuerIdsArray = issuers
        .filter((issuer) => organNames.includes(issuer.name))
        .map((issuer) => issuer.id);
    }
    const projectTypesArray = subscription.projectType
      ? subscription.projectType.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0)
      : [];
    setFormData({
      name: subscription.name,
      issuerIds: issuerIdsArray,
      projectTypes: projectTypesArray,
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
    if (subscriptions && subscriptions.length >= 3) {
      toast.error("通知設定は最大3件までです。既存の設定を削除してください。");
      return;
    }
    setEditingId(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
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

  const isLineConnected = !!lineConnection;

  return (
    <LiffLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">通知設定</h1>
          <p className="text-sm text-muted-foreground">
            条件に合った新着入札情報をLINEで受け取ります（最大3件）
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={handleNewNotification}
              disabled={!isLineConnected || (subscriptions && subscriptions.length >= 3)}
            >
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

                {/* 発注機関選択 */}
                <div className="space-y-2">
                  <Label>発注機関</Label>
                  <Select
                    value={formData.issuerIds.length > 0 ? formData.issuerIds[0].toString() : "all"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, issuerIds: value === "all" ? [] : [Number(value)] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="発注機関を選択" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">全ての発注機関</SelectItem>
                      {issuerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">未選択の場合は全ての発注機関が対象</p>
                </div>

                {/* 工種/委託種別 */}
                <div className="space-y-2">
                  <Label>工種/委託種別</Label>
                  <Select
                    value={formData.projectTypes.length > 0 ? formData.projectTypes[0] : "all"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, projectTypes: value === "all" ? [] : [value] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="工種/委託種別を選択" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">全ての種別</SelectItem>
                      {CONSTRUCTION_TYPES.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">未選択の場合は全ての種別が対象</p>
                </div>

                {/* 通知時刻 */}
                <div className="space-y-2">
                  <Label>通知時刻 *</Label>
                  <Select
                    value={formData.notificationTimes}
                    onValueChange={(value) => setFormData({ ...formData, notificationTimes: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="時刻を選択" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 144 }, (_, i) => {
                        const hour = Math.floor(i / 6);
                        const minute = (i % 6) * 10;
                        const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                        return (
                          <SelectItem key={timeStr} value={timeStr}>
                            {timeStr}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">指定した時刻に新規案件を通知します</p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
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
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>通知を受け取るには、まずLINE連携が必要です。</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/liff/line-connection")}
              className="w-fit"
            >
              LINE連携ページへ
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 通知設定一覧 */}
      {subscriptions && subscriptions.length > 0 ? (
        <div className="space-y-3">
          {subscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {subscription.enabled ? (
                        <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate">{subscription.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      通知時刻: {subscription.notificationTimes}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Switch
                      checked={subscription.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(subscription.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(subscription)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(subscription.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  {subscription.orderOrganNames && (
                    <div>
                      <span className="font-medium">発注機関:</span>{" "}
                      {subscription.orderOrganNames}
                    </div>
                  )}
                  {subscription.projectType && (
                    <div>
                      <span className="font-medium">種別:</span>{" "}
                      {subscription.projectType}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleSendTest(subscription.id)}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  テスト通知を送信
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              通知設定がありません
            </p>
            {isLineConnected && (
              <Button size="sm" onClick={handleNewNotification}>
                <Plus className="mr-1 h-4 w-4" />
                最初の通知設定を作成
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </LiffLayout>
  );
}

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLiff } from "@/hooks/useLiff";
import { ENV } from "@/env";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { Link } from "wouter";
import { CONSTRUCTION_TYPES, CONSTRUCTION_CATEGORY_TYPES, CONSIGNMENT_CATEGORY_TYPES, getFilteredTypes, type Category } from "../../../shared/constructionTypes";

interface NotificationFormData {
  name: string;
  issuerIds: number[];
  category: Category | null; // 区分（工事・委託・未選択）
  projectTypes: string[]; // 工種/委託種別
  notificationTimes: string;
}

const initialFormData: NotificationFormData = {
  name: "",
  issuerIds: [],
  category: null,
  projectTypes: [],
  notificationTimes: "09:00",
};

const NOTIFICATION_TIME_OPTIONS = [
  { label: "9:00", value: "09:00" },
  { label: "12:00", value: "12:00" },
  { label: "16:00", value: "16:00" },
];

export default function NotificationSettings() {
  // LIFF認証フック（LIFF IDが設定されている場合のみ有効）
  const { isLoading: isLiffLoading, error: liffError } = useLiff({
    liffId: ENV.liffId,
    autoLogin: true,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<NotificationFormData>(initialFormData);

  const { data: subscriptions, isLoading, refetch } = trpc.notifications.list.useQuery();
  const { data: lineConnection } = trpc.line.getConnection.useQuery();
  const { data: issuers } = trpc.issuers.list.useQuery();

  // 発注機関オプションを生成
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
      // 区分と工種を結合してprojectTypeに保存
      // 例: "工事" または "工事,土木一式工事" または "土木一式工事"
      let projectTypeValue: string | undefined;
      if (formData.category && formData.projectTypes.length > 0) {
        projectTypeValue = [formData.category, ...formData.projectTypes].join(",");
      } else if (formData.category) {
        projectTypeValue = formData.category;
      } else if (formData.projectTypes.length > 0) {
        projectTypeValue = formData.projectTypes.join(",");
      }

      const payload = {
        name: formData.name,
        issuerIds: formData.issuerIds.length > 0 ? formData.issuerIds.join(",") : undefined,
        projectType: projectTypeValue,
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
    
    // orderOrganNamesからissuerIdsへの逆変換
    let issuerIdsArray: number[] = [];
    if (subscription.orderOrganNames && issuers) {
      const organNames = subscription.orderOrganNames.split(",").map((n: string) => n.trim());
      issuerIdsArray = issuers
        .filter((issuer) => organNames.includes(issuer.name))
        .map((issuer) => issuer.id);
    }
    
    // projectTypeから区分と工種を分離
    const rawTypes = subscription.projectType
      ? subscription.projectType.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0)
      : [];
    let parsedCategory: Category | null = null;
    let parsedProjectTypes: string[] = [];
    for (const t of rawTypes) {
      if (t === "工事" || t === "委託") {
        parsedCategory = t as Category;
      } else {
        parsedProjectTypes.push(t);
      }
    }

    setFormData({
      name: subscription.name,
      issuerIds: issuerIdsArray,
      category: parsedCategory,
      projectTypes: parsedProjectTypes,
      notificationTimes: subscription.notificationTimes || "09:00",
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
    // 通知設定の上限チェック（3件まで）
    if (subscriptions && subscriptions.length >= 3) {
      toast.error("通知設定は最大3件までしか作成できません。新しい設定を作成するには、既存の設定を削除してください。");
      return;
    }
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
      {/* LIFF認証エラー表示 */}
      {liffError && (
        <Alert className="mb-4" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            LIFF認証エラー: {liffError}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">通知設定</h1>
          <p className="text-muted-foreground">
            条件に一致する新着入札情報をLINEで受け取る設定を管理します（最大3件まで）
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewNotification} disabled={!isLineConnected || (subscriptions && subscriptions.length >= 3)}>
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

                {/* 発注機関選択 */}
                <div className="space-y-2">
                  <Label htmlFor="issuerIds">発注機関</Label>
                  <Select
                    value={formData.issuerIds.length > 0 ? formData.issuerIds[0].toString() : ""}
                    onValueChange={(value) => setFormData({ ...formData, issuerIds: value ? [Number(value)] : [] })}
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
                  <p className="text-xs text-muted-foreground">
                    未選択の場合は全ての発注機関が対象になります
                  </p>
                </div>

                {/* 区分選択 */}
                <div className="space-y-2">
                  <Label>区分</Label>
                  <div className="flex gap-3">
                    {(["工事", "委託"] as Category[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const newCategory = formData.category === cat ? null : cat;
                          // 区分変更時、選択済み工種が新区分に含まれないものを除去
                          const allowedTypes = newCategory ? getFilteredTypes(newCategory) : CONSTRUCTION_TYPES;
                          const filteredTypes = formData.projectTypes.filter((t) => allowedTypes.includes(t));
                          setFormData({ ...formData, category: newCategory, projectTypes: filteredTypes });
                        }}
                        className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                          formData.category === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-accent"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    {formData.category && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, category: null })}
                        className="px-3 py-2 rounded-md border text-sm text-muted-foreground hover:bg-accent"
                      >
                        クリア
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    未選択の場合は工事・委託の両方が対象になります
                  </p>
                </div>

                {/* 工種/委託種別 */}
                <div className="space-y-2">
                  <Label htmlFor="projectTypes">工種/委託種別</Label>
                  <Select
                    value={formData.projectTypes.length > 0 ? formData.projectTypes[0] : "all"}
                    onValueChange={(value) => setFormData({ ...formData, projectTypes: value === "all" ? [] : [value] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="工種/委託種別を選択" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">全ての種別</SelectItem>
                      {getFilteredTypes(formData.category).map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    未選択の場合は全ての種別が対象になります
                  </p>
                </div>

                {/* 通知時刻 */}
                <div className="space-y-2">
                  <Label htmlFor="notificationTimes">通知時刻 *</Label>
                  <Select
                    value={formData.notificationTimes}
                    onValueChange={(value) => setFormData({ ...formData, notificationTimes: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="時刻を選択" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {NOTIFICATION_TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    指定した時刻に新規案件を通知します
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
                  {subscription.orderOrganNames && (
                    <div>
                      <span className="text-muted-foreground">発注機関:</span>{" "}
                      {subscription.orderOrganNames}
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

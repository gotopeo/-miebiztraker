import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, MessageSquare, Bell, Clock } from "lucide-react";
import { Link, useParams } from "wouter";

export default function UserDetail() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const params = useParams();
  const userId = parseInt(params.userId || "0");

  const { data, isLoading } = trpc.admin.users.detail.useQuery({ userId });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">アクセス権限がありません</h1>
          <p className="text-muted-foreground mb-6">このページは管理者のみアクセスできます。</p>
          <Button asChild>
            <Link href="/">ホームに戻る</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">ユーザーが見つかりません</h1>
          <Button asChild>
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              管理者ダッシュボードに戻る
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { user, lineConnection, notificationSettings, notificationLogs } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">ユーザー詳細</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            {currentUser?.name || currentUser?.email}
          </span>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* ユーザー基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">ユーザーID</p>
                <p className="font-medium">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">名前</p>
                <p className="font-medium">{user.name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">メールアドレス</p>
                <p className="font-medium">{user.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">権限</p>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? '管理者' : 'ユーザー'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">登録日</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleString('ja-JP')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">最終ログイン</p>
                <p className="font-medium">{new Date(user.lastSignedIn).toLocaleString('ja-JP')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LINE連携状態 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              LINE連携状態
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineConnection ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    連携済み
                  </Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">LINE表示名</p>
                    <p className="font-medium">{lineConnection.lineDisplayName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">LINE User ID</p>
                    <p className="font-mono text-xs">{lineConnection.lineUserId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">連携日時</p>
                    <p className="font-medium">{new Date(lineConnection.createdAt).toLocaleString('ja-JP')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Badge variant="outline" className="bg-gray-50 text-gray-500 mb-2">
                  未連携
                </Badge>
                <p className="text-sm text-muted-foreground">
                  このユーザーはLINEアカウントを連携していません
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 通知設定一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              通知設定（{notificationSettings.length}件）
            </CardTitle>
            <CardDescription>ユーザーが設定している通知条件</CardDescription>
          </CardHeader>
          <CardContent>
            {notificationSettings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>設定名</TableHead>
                    <TableHead>発注機関</TableHead>
                    <TableHead>工事種別</TableHead>
                    <TableHead>通知時刻</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationSettings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium">{setting.name}</TableCell>
                      <TableCell className="text-sm">
                        {setting.orderOrganNames ? (
                          <span className="text-muted-foreground">
                            {setting.orderOrganNames.split(',').slice(0, 2).join(', ')}
                            {setting.orderOrganNames.split(',').length > 2 && ' 他'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">すべて</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {setting.projectType ? (
                          <span className="text-muted-foreground">
                            {setting.projectType.split(',').slice(0, 2).join(', ')}
                            {setting.projectType.split(',').length > 2 && ' 他'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">すべて</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {setting.notificationTimes}
                      </TableCell>
                      <TableCell>
                        <Badge variant={setting.enabled ? 'default' : 'secondary'}>
                          {setting.enabled ? '有効' : '無効'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                通知設定がありません
              </div>
            )}
          </CardContent>
        </Card>

        {/* 通知履歴 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              通知履歴（最新50件）
            </CardTitle>
            <CardDescription>過去に送信された通知の履歴</CardDescription>
          </CardHeader>
          <CardContent>
            {notificationLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>送信日時</TableHead>
                    <TableHead>通知タイプ</TableHead>
                    <TableHead>案件</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.sentAt).toLocaleString('ja-JP')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.notificationType === 'NEW' ? 'default' : 'secondary'}>
                          {log.notificationType === 'NEW' ? '新規' : '更新'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {log.tenderCanonicalId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'outline' : 'destructive'}>
                          {log.status === 'success' ? '成功' : '失敗'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                通知履歴がありません
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

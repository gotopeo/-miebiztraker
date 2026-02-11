import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Bell, MessageSquare, Database, Eye } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: users, isLoading: usersLoading } = trpc.admin.users.list.useQuery();

  if (authLoading || statsLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">管理者ダッシュボード</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/">ホームに戻る</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* システム統計 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">システム統計</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総ユーザー数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">登録済みユーザー</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">LINE連携済み</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.lineConnectedUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalUsers ? Math.round((stats.lineConnectedUsers / stats.totalUsers) * 100) : 0}% のユーザー
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">通知設定総数</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalNotificationSettings || 0}</div>
                <p className="text-xs text-muted-foreground">全ユーザーの通知設定</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">入札案件総数</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalBiddings || 0}</div>
                <p className="text-xs text-muted-foreground">データベース内の案件</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ユーザー一覧 */}
        <div>
          <h2 className="text-2xl font-bold mb-4">ユーザー一覧</h2>
          <Card>
            <CardHeader>
              <CardTitle>全ユーザー</CardTitle>
              <CardDescription>システムに登録されているすべてのユーザー</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead>権限</TableHead>
                    <TableHead>LINE連携</TableHead>
                    <TableHead>通知設定</TableHead>
                    <TableHead>登録日</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.id}</TableCell>
                        <TableCell>{u.name || "-"}</TableCell>
                        <TableCell>{u.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                            {u.role === 'admin' ? '管理者' : 'ユーザー'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.lineConnected ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {u.lineDisplayName || '連携済み'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500">
                              未連携
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {u.notificationCount} 件
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString('ja-JP')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/users/${u.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              詳細
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        ユーザーが見つかりません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingModal } from "@/components/OnboardingModal";
import { getLoginUrl } from "@/const";
import { Database, Search, Bell, Calendar, FileSpreadsheet, Activity, MessageSquare, Link2 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(!user?.isOnboarded);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-foreground mb-6">
              三重県入札情報取得システム
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              三重県の入札情報を自動収集し、検索・通知・管理を効率化するシステムです
            </p>
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>ログインして開始</a>
            </Button>

            <div className="mt-16 grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Database className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>自動収集</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Seleniumを使用して三重県入札サイトから自動的に情報を収集します
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Search className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>高度な検索</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    キーワード、発注機関、日付範囲などで入札情報を柔軟に検索できます
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Bell className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>キーワード通知</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    登録したキーワードに一致する新規案件を自動的に通知します
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />
      <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">三重県入札情報取得システム</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">ダッシュボード</h2>
          <p className="text-muted-foreground">
            三重県の入札情報を管理・検索できます
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/biddings">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Search className="h-10 w-10 text-primary mb-2" />
                <CardTitle>入札情報検索</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  収集した入札情報を検索・閲覧・エクスポートできます
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/scraping">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Activity className="h-10 w-10 text-primary mb-2" />
                <CardTitle>スクレイピング実行</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  手動でスクレイピングを実行し、履歴を確認できます
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/notifications">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>通知設定</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  条件に一致する新着入札情報をLINEで受け取る設定を管理します
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/line-connection">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-2" />
                <CardTitle>LINE連携</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  LINEアカウントと連携して、通知をLINEで受け取ることができます
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/schedules">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-2" />
                <CardTitle>スケジュール設定</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  自動スクレイピングのスケジュールを設定できます
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-muted/50">
            <CardHeader>
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle className="text-muted-foreground">CSVエクスポート</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                入札情報一覧ページからCSV形式でデータをエクスポートできます
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader>
              <Database className="h-10 w-10 text-muted-foreground mb-2" />
              <CardTitle className="text-muted-foreground">データ蓄積</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                取得した入札情報はデータベースに自動的に保存されます
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
    </>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CheckCircle, Clock, Filter } from "lucide-react";
import { ENV } from "@/env";

export default function Landing() {
  const liffUrl = `https://liff.line.me/${ENV.liffId || '2009029347-SE3MfVUQ'}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* ヘッダー */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900">MieBid Tracker</h1>
          <Button asChild size="sm" variant="outline">
            <a href="/admin/login">管理者ログイン</a>
          </Button>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="container py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
            三重県の入札情報を
            <br />
            <span className="text-blue-600">LINEで自動通知</span>
          </h2>
          <p className="text-xl text-gray-600">
            気になる入札案件を見逃さない。
            <br />
            条件に合った新着情報を、毎日LINEでお届けします。
          </p>
          <div className="pt-4">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <a href={liffUrl} target="_blank" rel="noopener noreferrer">
                <Bell className="mr-2 h-5 w-5" />
                LINEで通知を受け取る
              </a>
            </Button>
            <p className="text-sm text-gray-500 mt-3">
              ※ ID・パスワード不要。LINEアカウントで簡単登録
            </p>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="container py-16">
        <h3 className="text-3xl font-bold text-center mb-12">
          MieBid Trackerの特徴
        </h3>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Filter className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="text-xl font-semibold">条件で絞り込み</h4>
              <p className="text-gray-600">
                発注機関や工事種別など、あなたの興味に合わせて通知条件をカスタマイズできます。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold">指定時刻に通知</h4>
              <p className="text-gray-600">
                朝8時、昼12時など、あなたの都合に合わせた時刻に通知を受け取れます。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="text-xl font-semibold">簡単登録</h4>
              <p className="text-gray-600">
                ID・パスワード不要。LINEアカウントがあれば、すぐに利用開始できます。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="bg-gray-50 py-16">
        <div className="container">
          <h3 className="text-3xl font-bold text-center mb-12">
            3ステップで始められます
          </h3>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">LINEで連携</h4>
                <p className="text-gray-600">
                  下のボタンをタップして、LINEアカウントで認証します。
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">通知条件を設定</h4>
                <p className="text-gray-600">
                  LINEのリッチメニューから「通知設定」を開き、受け取りたい案件の条件を設定します。
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">通知を受け取る</h4>
                <p className="text-gray-600">
                  条件に合った新着案件が公開されると、自動的にLINEで通知が届きます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="container py-16 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h3 className="text-3xl font-bold">
            今すぐ始めて、入札情報を見逃さない
          </h3>
          <p className="text-gray-600">
            無料で利用できます。まずはLINE連携から始めましょう。
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <a href={liffUrl} target="_blank" rel="noopener noreferrer">
              <Bell className="mr-2 h-5 w-5" />
              LINEで通知を受け取る
            </a>
          </Button>
        </div>
      </section>

      {/* 固定フッターボタン */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40 md:hidden">
        <Button asChild size="lg" className="w-full">
          <a href={liffUrl} target="_blank" rel="noopener noreferrer">
            <Bell className="mr-2 h-5 w-5" />
            この案件の経過をLINEで通知する
          </a>
        </Button>
      </div>

      {/* フッター */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container text-center">
          <p className="text-gray-400">
            © 2026 MieBid Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

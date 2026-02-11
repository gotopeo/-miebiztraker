import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function AdminLogin() {
  const loginUrl = getLoginUrl();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">管理者ログイン</CardTitle>
          <CardDescription>
            MieBid Tracker 管理画面へのアクセス
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <p className="font-semibold mb-1">管理者専用</p>
            <p>
              このページは管理者専用です。一般ユーザーの方は
              <a href="/" className="underline font-semibold ml-1">
                トップページ
              </a>
              からLINE連携を行ってください。
            </p>
          </div>

          <Button asChild size="lg" className="w-full">
            <a href={loginUrl}>
              Manusアカウントでログイン
            </a>
          </Button>

          <div className="text-center">
            <a href="/" className="text-sm text-gray-600 hover:underline">
              トップページに戻る
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

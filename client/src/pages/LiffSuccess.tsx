import { useLiffAutoLogin } from "@/hooks/useLiffAutoLogin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function LiffSuccess() {
  const { isLoading, error, isLoggedIn } = useLiffAutoLogin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="text-lg">LINE連携を処理しています...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-600" />
              <CardTitle>連携に失敗しました</CardTitle>
            </div>
            <CardDescription>
              LINE連携中にエラーが発生しました
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">{error}</p>
            <Button asChild className="w-full">
              <a href="/">トップページに戻る</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle>連携が完了しました！</CardTitle>
            </div>
            <CardDescription>
              LINE連携が正常に完了しました
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold">次のステップ</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>
                    LINEのトーク画面を開いてください
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>
                    リッチメニューから「通知設定」をタップ
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>
                    受け取りたい案件の条件を設定してください
                  </span>
                </li>
              </ol>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                このページは閉じても問題ありません
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

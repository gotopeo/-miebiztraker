import { useLiffAutoLogin } from "@/hooks/useLiffAutoLogin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function LiffSuccess() {
  const { isLoading, error, isLoggedIn } = useLiffAutoLogin();
  const [, setLocation] = useLocation();

  // 連携完了後、3秒待ってから通知設定画面にリダイレクト
  useEffect(() => {
    if (isLoggedIn) {
      const timer = setTimeout(() => {
        setLocation("/notifications");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, setLocation]);

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
            <div className="text-center space-y-4">
              <p className="text-lg">まもなく通知設定画面に移動します...</p>
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                onClick={() => setLocation("/notifications")} 
                className="w-full"
              >
                今すぐ通知設定画面へ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

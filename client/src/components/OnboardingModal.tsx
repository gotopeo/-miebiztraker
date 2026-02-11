import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  
  // LINE連携状態を確認
  const { data: lineConnection } = trpc.line.getConnection.useQuery();
  
  // 通知設定の数を確認
  const { data: subscriptions } = trpc.notifications.list.useQuery();
  
  const steps = [
    {
      id: 1,
      title: "LINE連携",
      description: "LINEアカウントと連携して通知を受け取れるようにします",
      completed: !!lineConnection,
      action: () => setLocation("/line-connection"),
    },
    {
      id: 2,
      title: "通知設定の作成",
      description: "受け取りたい案件の条件を設定します",
      completed: (subscriptions?.length || 0) > 0,
      action: () => setLocation("/notifications"),
    },
    {
      id: 3,
      title: "完了",
      description: "設定が完了しました！通知をお待ちください",
      completed: false,
      action: () => {
        markOnboardingComplete.mutate();
        onClose();
      },
    },
  ];

  const markOnboardingComplete = trpc.auth.completeOnboarding.useMutation();

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  const handleNext = () => {
    const step = steps[currentStep - 1];
    if (step.action) {
      step.action();
    }
  };

  const handleSkip = () => {
    markOnboardingComplete.mutate();
    onClose();
  };

  useEffect(() => {
    // 各ステップの完了状態に応じて現在のステップを更新
    if (!lineConnection) {
      setCurrentStep(1);
    } else if ((subscriptions?.length || 0) === 0) {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }
  }, [lineConnection, subscriptions]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            三重県入札情報取得システムへようこそ！
          </DialogTitle>
          <DialogDescription>
            3つのステップで通知設定を完了しましょう
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 進捗バー */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>ステップ {currentStep} / {steps.length}</span>
              <span>{Math.round(progress)}% 完了</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* ステップリスト */}
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                  step.id === currentStep
                    ? "border-primary bg-primary/5"
                    : step.completed
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {step.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : step.id === currentStep ? (
                    <Circle className="h-6 w-6 text-primary fill-primary" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* アクションボタン */}
          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={handleSkip}>
              後で設定する
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length ? (
                "完了"
              ) : (
                <>
                  次へ <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

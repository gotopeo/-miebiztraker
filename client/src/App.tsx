import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Landing from "./pages/Landing";
import LiffSuccess from "./pages/LiffSuccess";
import AdminLogin from "./pages/AdminLogin";
import Home from "./pages/Home";
import BiddingList from "./pages/BiddingList";
import ScrapingLogs from "./pages/ScrapingLogs";
import KeywordSettings from "./pages/KeywordSettings";
import ScheduleSettings from "./pages/ScheduleSettings";
import LineConnection from "./pages/LineConnection";
import NotificationSettings from "./pages/NotificationSettings";
import LiffLineConnection from "./pages/LiffLineConnection";
import LiffNotificationSettings from "./pages/LiffNotificationSettings";
import AdminDashboard from "./pages/AdminDashboard";
import UserDetail from "./pages/UserDetail";

function Router() {
  return (
    <Switch>
      {/* 管理者画面をトップページに設定 */}
      <Route path={"/"} component={Home} />
      <Route path={"/public"} component={Landing} />
      <Route path={"/liff-success"} component={LiffSuccess} />
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/admin/users/:userId"} component={UserDetail} />
      <Route path={"/admin/dashboard"} component={AdminDashboard} />
      <Route path={"/admin"} component={Home} />
      <Route path={"/biddings"} component={BiddingList} />
      <Route path={"/scraping"} component={ScrapingLogs} />
      <Route path={"/keywords"} component={KeywordSettings} />
      <Route path={"/schedules"} component={ScheduleSettings} />
      <Route path={"/line-connection"} component={LineConnection} />
      <Route path={"/notifications"} component={NotificationSettings} />
      {/* LIFF専用ページ（LINEアプリ内ブラウザ用・Manusログイン不要） */}
      <Route path={"/liff/line-connection"} component={LiffLineConnection} />
      <Route path={"/liff/notifications"} component={LiffNotificationSettings} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

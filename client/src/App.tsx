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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Landing} />
      <Route path={"/liff-success"} component={LiffSuccess} />
      <Route path={"/admin/login"} component={AdminLogin} />
      <Route path={"/admin"} component={Home} />
      <Route path={"/biddings"} component={BiddingList} />
      <Route path={"/scraping"} component={ScrapingLogs} />
      <Route path={"/keywords"} component={KeywordSettings} />
      <Route path={"/schedules"} component={ScheduleSettings} />
      <Route path={"/line-connection"} component={LineConnection} />
      <Route path={"/notifications"} component={NotificationSettings} />
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

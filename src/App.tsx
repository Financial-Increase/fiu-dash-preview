import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Overview from "./pages/Overview";
import ShippingDashboard from "./pages/ShippingDashboard";
import VelocitySalesDashboard from "./pages/VelocitySalesDashboard";
import PaymentsDashboard from "./pages/PaymentsDashboard";
import WorkshopDashboard from "./pages/WorkshopDashboard";
import VelocityMembersDashboard from "./pages/VelocityMembersDashboard";
import MembershipDashboard from "./pages/MembershipDashboard";
import SummitDashboard from "./pages/SummitDashboard";
import ContactsDashboard from "./pages/ContactsDashboard";
import SalesDashboard from "./pages/SalesDashboard";
import CallsDashboard from "./pages/CallsDashboard";
import TransactionsDashboard from "./pages/TransactionsDashboard";
import PnlReport from "./pages/PnlReport";
import ReceivablesReport from "./pages/ReceivablesReport";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";
import CompensationDashboard from "./pages/CompensationDashboard";
import CompensationLedger from "./pages/CompensationLedger";
import UnsubscribePage from "./pages/UnsubscribePage";
import DigitsOAuthCallback from "./pages/DigitsOAuthCallback";
import NotFound from "./pages/NotFound";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import { firstAllowedPage, hasPageAccess, isAdmin } from "@/lib/pagePermissions";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  const { data: teamMember, isLoading: memberLoading } = useCurrentTeamMember();

  if (loading || (user && memberLoading)) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-gold font-heading tracking-widest uppercase animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const fallback = firstAllowedPage(teamMember);
  const page = (permission: string, content: React.ReactNode) =>
    hasPageAccess(teamMember, permission)
      ? <DashboardLayout>{content}</DashboardLayout>
      : <Navigate to={fallback} replace />;
  return (
    <Routes>
      <Route path="/" element={page("/", <Overview />)} />
      <Route path="/shipping" element={page("/shipping", <ShippingDashboard />)} />
      <Route path="/velocity-sales" element={page("/sales", <VelocitySalesDashboard />)} />
      <Route path="/payments" element={page("/sales", <PaymentsDashboard />)} />
      <Route path="/workshop" element={page("/workshop", <WorkshopDashboard />)} />
      <Route path="/velocity-members" element={page("/velocity-members", <VelocityMembersDashboard />)} />
      <Route path="/membership" element={page("/membership", <MembershipDashboard />)} />
      <Route path="/summit" element={page("/summit", <SummitDashboard />)} />
      <Route path="/sales" element={page("/sales", <SalesDashboard />)} />
      <Route path="/calls" element={page("/calls", <CallsDashboard />)} />
      <Route path="/transactions" element={page("/transactions", <TransactionsDashboard />)} />
      <Route path="/contacts" element={page("/contacts", <ContactsDashboard />)} />
      <Route path="/accounting/pnl" element={page("/accounting/pnl", <PnlReport />)} />
      <Route path="/accounting/receivables" element={page("/accounting/receivables", <ReceivablesReport />)} />
      <Route path="/accounting/compensation" element={page("/accounting/compensation", <CompensationDashboard />)} />
      <Route path="/accounting/compensation/:memberId" element={page("/accounting/compensation", <CompensationLedger />)} />
      <Route path="/tasks" element={page("/tasks", <TasksPage />)} />
      <Route path="/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
      <Route path="/oauth/digits/callback" element={isAdmin(teamMember) ? <DigitsOAuthCallback /> : <Navigate to={fallback} replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

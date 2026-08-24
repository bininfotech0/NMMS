import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { PublicLayout } from "@/pages/public/PublicLayout";
import { Home } from "@/pages/public/Home";
import { Login } from "@/pages/auth/Login";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/admin/Dashboard";
import { MembersList } from "@/pages/admin/MembersList";
import { MemberWizard } from "@/pages/admin/members/MemberWizard";
import { MemberEditPage } from "@/pages/admin/members/MemberEditPage";
import { MemberProfile } from "@/pages/admin/members/MemberProfile";
import { MemberCard } from "@/pages/admin/members/MemberCard";
import { PaymentReceiptPage } from "@/pages/admin/members/PaymentReceiptPage";
import { VerifyCard } from "@/pages/public/VerifyCard";
import { JoinViaReferral } from "@/pages/public/JoinViaReferral";
import { Applications } from "@/pages/admin/Applications";
import { MembershipPlans } from "@/pages/admin/MembershipPlans";
import { Payments } from "@/pages/admin/Payments";
import { Reports } from "@/pages/admin/Reports";
import { Events } from "@/pages/admin/Events";
import { Documents } from "@/pages/admin/Documents";
import { Notices } from "@/pages/admin/Notices";
import { Settings } from "@/pages/admin/Settings";
import { Users } from "@/pages/admin/Users";
import { AuditLogs } from "@/pages/admin/AuditLogs";
import { ReferralRewards } from "@/pages/admin/ReferralRewards";
import { WithdrawalRequests } from "@/pages/admin/WithdrawalRequests";
import { KycReview } from "@/pages/admin/KycReview";
import { Donations } from "@/pages/admin/Donations";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MemberProtectedRoute } from "@/components/auth/MemberProtectedRoute";
import { MemberLogin } from "@/pages/member/MemberLogin";
import { MemberPortalLayout } from "@/pages/member/MemberPortalLayout";
import { MemberDashboard } from "@/pages/member/MemberDashboard";
import { MemberReferrals } from "@/pages/member/MemberReferrals";
import { MemberWallet } from "@/pages/member/MemberWallet";
import { MemberRewards } from "@/pages/member/MemberRewards";
import { MemberEvents } from "@/pages/member/MemberEvents";
import { MemberKyc } from "@/pages/member/MemberKyc";
import { MyProfile } from "@/pages/member/MyProfile";
import { MemberIdCard } from "@/pages/member/MemberIdCard";
import { MemberDocuments } from "@/pages/member/MemberDocuments";
import { MemberPayments } from "@/pages/member/MemberPayments";
import { MemberPaymentReceiptPage } from "@/pages/member/MemberPaymentReceiptPage";
import { MemberDonations } from "@/pages/member/MemberDonations";
import { MemberDonationReceiptPage } from "@/pages/member/MemberDonationReceiptPage";
import { initializeAuth } from "@/lib/auth";
import { initializeMemberAuth } from "@/lib/member-auth";

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-heading text-6xl font-bold text-brand-green">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">Page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <a href="/admin" className="mt-6 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark">
        Go to Dashboard
      </a>
    </div>
  );
}

function Forbidden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-heading text-6xl font-bold text-brand-gold">403</h1>
      <p className="mt-2 text-lg text-muted-foreground">Access Denied</p>
      <p className="mt-1 text-sm text-muted-foreground">You don't have permission to access this page.</p>
      <a href="/admin" className="mt-6 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark">
        Go to Dashboard
      </a>
    </div>
  );
}

function AdminLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

function MemberLayout() {
  return (
    <MemberProtectedRoute>
      <MemberPortalLayout />
    </MemberProtectedRoute>
  );
}

function App() {
  useEffect(() => {
    initializeAuth();
    initializeMemberAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        <Route path="/verify/:token" element={<VerifyCard />} />
        <Route path="/join" element={<JoinViaReferral />} />
        <Route path="/login" element={<MemberLogin />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />

        <Route path="/member" element={<MemberLayout />}>
          <Route index element={<MemberDashboard />} />
          <Route path="referrals" element={<MemberReferrals />} />
          <Route path="wallet" element={<MemberWallet />} />
          <Route path="rewards" element={<MemberRewards />} />
          <Route path="events" element={<MemberEvents />} />
          <Route path="kyc" element={<MemberKyc />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="card" element={<MemberIdCard />} />
          <Route path="documents" element={<MemberDocuments />} />
          <Route path="payments" element={<MemberPayments />} />
          <Route path="payments/:paymentId/receipt" element={<MemberPaymentReceiptPage />} />
          <Route path="donations" element={<MemberDonations />} />
          <Route path="donations/:id/receipt" element={<MemberDonationReceiptPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<MembersList />} />
          <Route path="members/:id/wizard" element={<MemberWizard />} />
          <Route path="members/:id/edit" element={<MemberEditPage />} />
          <Route path="members/:id/profile" element={<MemberProfile />} />
          <Route path="members/:id/card" element={<MemberCard />} />
          <Route path="members/:id/payments/:paymentId/receipt" element={<PaymentReceiptPage />} />
          <Route path="applications" element={<Applications />} />
          <Route path="membership" element={<MembershipPlans />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="events" element={<Events />} />
          <Route path="documents" element={<Documents />} />
          <Route path="notices" element={<Notices />} />
          <Route path="settings" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="referral-rewards" element={<ReferralRewards />} />
          <Route path="withdrawals" element={<WithdrawalRequests />} />
          <Route path="kyc" element={<KycReview />} />
          <Route path="donations" element={<Donations />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { bootstrapSession, forceUnauthenticated } from "@/store/authSlice";
import { registerRefreshFailureHandler } from "@/services/apiClient";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { showToast } from "@/store/toastSlice";

import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { Skeleton } from "@/components/ui/Primitives";

// Lazy-loaded so each route's code only downloads when a user actually
// visits it, instead of every page (including admin-only and rarely-used
// auth flows) being bundled into the initial payload regardless of which
// one the visitor needs.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const PublicSharePage = lazy(() => import("@/pages/PublicSharePage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const FilesPage = lazy(() => import("@/pages/FilesPage"));
const SharedPage = lazy(() => import("@/pages/SharedPage"));
const StarredPage = lazy(() => import("@/pages/StarredPage"));
const TrashPage = lazy(() => import("@/pages/TrashPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export default function App() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    dispatch(bootstrapSession());
    registerRefreshFailureHandler(() => dispatch(forceUnauthenticated()));
  }, [dispatch]);

  useRealtimeEvents(user?.id ?? null, (evt) => {
    if (evt.event === "security_alert") {
      dispatch(showToast("Security alert on your account — check recent activity.", "error"));
    }
    if (evt.event === "file_processed") {
      dispatch(showToast("A file finished background processing.", "info"));
    }
  });

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/s/:token" element={<PublicSharePage />} />

          {/* Protected app shell */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/shared" element={<SharedPage />} />
            <Route path="/starred" element={<StarredPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </>
  );
}

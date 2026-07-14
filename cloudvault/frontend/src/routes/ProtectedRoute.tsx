import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/hooks/redux";
import { UserRole } from "@/types";
import { Skeleton } from "@/components/ui/Primitives";

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: UserRole;
}) {
  const { status, user } = useAppSelector((s) => s.auth);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

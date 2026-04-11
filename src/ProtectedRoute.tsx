import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = sessionStorage.getItem("token"); // ✅ FIXED
  const user = sessionStorage.getItem("user");   // ✅ EXTRA SAFE

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

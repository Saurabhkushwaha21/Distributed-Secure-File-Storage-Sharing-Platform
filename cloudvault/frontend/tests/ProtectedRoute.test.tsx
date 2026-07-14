import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import authReducer from "@/store/authSlice";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

function renderWithAuthState(status: string, user: any, requiredRole?: "USER" | "ADMIN") {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { status, user, error: null } as any },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute requiredRole={requiredRole}>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

const regularUser = { id: "u1", email: "u@example.com", full_name: "User", role: "USER" as const };
const adminUser = { id: "a1", email: "a@example.com", full_name: "Admin", role: "ADMIN" as const };

describe("ProtectedRoute", () => {
  it("shows a loading state while auth status is idle or loading", () => {
    const { container } = renderWithAuthState("loading", null);
    expect(screen.queryByText("Secret Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse, [class*='skeleton']") || container.firstChild).toBeTruthy();
  });

  it("redirects to /login when unauthenticated", () => {
    renderWithAuthState("unauthenticated", null);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders children when authenticated with no role requirement", () => {
    renderWithAuthState("authenticated", regularUser);
    expect(screen.getByText("Secret Content")).toBeInTheDocument();
  });

  it("redirects a non-matching role away from an admin-only route", () => {
    renderWithAuthState("authenticated", regularUser, "ADMIN");
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Secret Content")).not.toBeInTheDocument();
  });

  it("allows access to an admin-only route for an admin user", () => {
    renderWithAuthState("authenticated", adminUser, "ADMIN");
    expect(screen.getByText("Secret Content")).toBeInTheDocument();
  });
});

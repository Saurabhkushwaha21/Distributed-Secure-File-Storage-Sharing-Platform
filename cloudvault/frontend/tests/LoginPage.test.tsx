import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/authSlice";
import toastReducer from "@/store/toastSlice";
import uploadReducer from "@/store/uploadSlice";
import LoginPage from "@/pages/LoginPage";
import { authApi } from "@/services/authApi";

vi.mock("@/services/authApi", () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { auth: authReducer, toasts: toastReducer, uploads: uploadReducer },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows an error message when login fails", async () => {
    (authApi.login as any).mockRejectedValue({ response: { data: { detail: "Invalid credentials" } } });

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
    });
  });

  it("calls authApi.login with entered credentials on submit", async () => {
    (authApi.login as any).mockResolvedValue({
      data: { access_token: "a", refresh_token: "b", token_type: "bearer" },
    });
    (authApi.getMe as any).mockResolvedValue({
      data: { id: "1", email: "test@example.com", full_name: "Test", role: "USER", is_email_verified: true, storage_quota_bytes: 100, storage_used_bytes: 0, created_at: "2026-01-01" },
    });

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "correctpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith("test@example.com", "correctpass");
    });
  });
});

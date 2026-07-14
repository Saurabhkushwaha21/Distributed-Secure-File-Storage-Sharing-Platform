import { api } from "./apiClient";
import { TokenPair, User } from "@/types";

export const authApi = {
  register: (email: string, password: string, full_name: string) =>
    api.post<{ id: string; email: string; message: string }>("/auth/register", { email, password, full_name }),

  verifyEmail: (email: string, code: string) => api.post("/auth/verify-email", { email, code }),

  login: (email: string, password: string, device_info = "web") =>
    api.post<TokenPair>("/auth/login", { email, password, device_info }),

  refresh: (refresh_token: string) => api.post<TokenPair>("/auth/refresh", { refresh_token }),

  logout: (refresh_token: string) => api.post("/auth/logout", { refresh_token }),

  logoutAll: () => api.post("/auth/logout-all"),

  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),

  resetPassword: (email: string, code: string, new_password: string) =>
    api.post("/auth/reset-password", { email, code, new_password }),

  getMe: () => api.get<User>("/users/me"),
};

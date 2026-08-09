import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/services/authApi";
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from "@/services/tokenStorage";
import { User } from "@/types";
import { getErrorMessage } from "@/utils/errors";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (params: { email: string; password: string; rememberMe: boolean }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(params.email, params.password);
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token, params.rememberMe);
      const me = await authApi.getMe();
      return me.data;
    } catch (err: any) {
      return rejectWithValue(getErrorMessage(err, "Login failed"));
    }
  }
);

export const bootstrapSession = createAsyncThunk("auth/bootstrap", async (_, { rejectWithValue }) => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return rejectWithValue("no session");
  try {
    const { data } = await authApi.refresh(refreshToken);
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token, true);
    const me = await authApi.getMe();
    return me.data;
  } catch (err) {
    clearTokens();
    return rejectWithValue("session expired");
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await authApi.logout(refreshToken);
    } catch {
      // best-effort; clear local state regardless
    }
  }
  clearTokens();
});

export const logoutAllDevices = createAsyncThunk("auth/logoutAll", async () => {
  await authApi.logoutAll();
  clearTokens();
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    forceUnauthenticated(state) {
      state.user = null;
      state.status = "unauthenticated";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Login failed";
      })
      .addCase(bootstrapSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(bootstrapSession.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = "unauthenticated";
        state.user = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "unauthenticated";
      })
      .addCase(logoutAllDevices.fulfilled, (state) => {
        state.user = null;
        state.status = "unauthenticated";
      });
  },
});

export const { forceUnauthenticated } = authSlice.actions;
export default authSlice.reducer;

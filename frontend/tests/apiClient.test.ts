import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { api, registerRefreshFailureHandler } from "@/services/apiClient";
import { setAccessToken, setRefreshToken, getAccessToken, clearTokens } from "@/services/tokenStorage";

describe("apiClient token refresh interceptor", () => {
  let apiMock: MockAdapter;
  let axiosMock: MockAdapter;

  beforeEach(() => {
    apiMock = new MockAdapter(api);
    axiosMock = new MockAdapter(axios);
    clearTokens();
  });

  afterEach(() => {
    apiMock.restore();
    axiosMock.restore();
  });

  it("attaches the access token as an Authorization header on every request", async () => {
    setAccessToken("my-access-token");
    apiMock.onGet("/files/contents").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer my-access-token");
      return [200, { folders: [], files: [] }];
    });

    await api.get("/files/contents");
  });

  it("refreshes the token and retries the original request on a 401", async () => {
    setAccessToken("expired-token");
    setRefreshToken("valid-refresh-token", true);

    let firstAttempt = true;
    apiMock.onGet("/files/contents").reply((config) => {
      if (firstAttempt && config.headers?.Authorization === "Bearer expired-token") {
        firstAttempt = false;
        return [401, { detail: "Token expired" }];
      }
      expect(config.headers?.Authorization).toBe("Bearer new-access-token");
      return [200, { folders: [], files: [] }];
    });
    axiosMock.onPost(/\/auth\/refresh$/).reply(200, {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
    });

    const response = await api.get("/files/contents");

    expect(response.status).toBe(200);
    expect(getAccessToken()).toBe("new-access-token");
  });

  it("queues concurrent requests during a single in-flight refresh instead of refreshing once per request", async () => {
    setAccessToken("expired-token");
    setRefreshToken("valid-refresh-token", true);

    let refreshCallCount = 0;
    axiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCallCount += 1;
      return [200, { access_token: "new-access-token", refresh_token: "new-refresh-token" }];
    });

    apiMock.onGet("/endpoint-a").reply((config) =>
      config.headers?.Authorization === "Bearer expired-token" ? [401] : [200, { ok: "a" }]
    );
    apiMock.onGet("/endpoint-b").reply((config) =>
      config.headers?.Authorization === "Bearer expired-token" ? [401] : [200, { ok: "b" }]
    );

    const [resA, resB] = await Promise.all([api.get("/endpoint-a"), api.get("/endpoint-b")]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(refreshCallCount).toBe(1); // only one refresh, not one per queued request
  });

  it("clears tokens and calls the failure handler when the refresh itself fails", async () => {
    setAccessToken("expired-token");
    setRefreshToken("stale-refresh-token", true);

    apiMock.onGet("/files/contents").reply(401);
    axiosMock.onPost(/\/auth\/refresh$/).reply(401, { detail: "Refresh token invalid" });

    const onFailure = vi.fn();
    registerRefreshFailureHandler(onFailure);

    await expect(api.get("/files/contents")).rejects.toBeTruthy();

    expect(getAccessToken()).toBeNull();
    expect(onFailure).toHaveBeenCalled();
  });

  it("does not attempt a refresh at all when there is no refresh token stored", async () => {
    setAccessToken("expired-token");
    // deliberately no refresh token set

    let refreshAttempted = false;
    axiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshAttempted = true;
      return [200, {}];
    });
    apiMock.onGet("/files/contents").reply(401);

    const onFailure = vi.fn();
    registerRefreshFailureHandler(onFailure);

    await expect(api.get("/files/contents")).rejects.toBeTruthy();

    expect(refreshAttempted).toBe(false);
    expect(onFailure).toHaveBeenCalled();
  });

  it("does not try to refresh on a 401 from the login endpoint itself (avoids a refresh loop)", async () => {
    setRefreshToken("some-refresh-token", true);

    let refreshAttempted = false;
    axiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshAttempted = true;
      return [200, {}];
    });
    apiMock.onPost("/auth/login").reply(401, { detail: "Invalid credentials" });

    await expect(api.post("/auth/login", { email: "a@b.com", password: "wrong" })).rejects.toBeTruthy();

    expect(refreshAttempted).toBe(false);
  });
});

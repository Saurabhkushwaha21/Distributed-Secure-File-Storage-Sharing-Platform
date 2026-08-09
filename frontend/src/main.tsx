import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { store } from "@/store";
import { showToast } from "@/store/toastSlice";
import { getErrorMessage } from "@/utils/errors";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
  // Safety net: individual queries don't each need their own onError toast
  // wired up (most just render a loading/empty state on failure, which
  // looks identical to "genuinely nothing here" without this). A 401 is
  // deliberately excluded - that's handled by the axios refresh interceptor
  // and shouldn't also pop a toast on top of a silent, expected retry.
  queryCache: new QueryCache({
    onError: (err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return;
      store.dispatch(showToast(getErrorMessage(err, "Couldn't load data. Please try again."), "error"));
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

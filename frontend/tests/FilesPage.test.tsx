import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import authReducer from "@/store/authSlice";
import toastReducer from "@/store/toastSlice";
import uploadReducer from "@/store/uploadSlice";
import FilesPage from "@/pages/FilesPage";
import { filesApi } from "@/services/filesApi";

vi.mock("@/services/filesApi", () => ({
  filesApi: {
    listContents: vi.fn(),
    search: vi.fn(),
    createFolder: vi.fn(),
    renameFile: vi.fn(),
    moveFile: vi.fn(),
    copyFile: vi.fn(),
    deleteFile: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

function renderWithProviders() {
  const store = configureStore({
    reducer: { auth: authReducer, toasts: toastReducer, uploads: uploadReducer },
    preloadedState: {
      auth: {
        status: "authenticated",
        user: { id: "u1", email: "u@example.com", full_name: "Test User", role: "USER" },
        error: null,
      } as any,
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/files"]}>
          <FilesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const sampleFile = {
  id: "f1",
  name: "budget.xlsx",
  folder_id: null,
  mime_type: "application/vnd.ms-excel",
  size_bytes: 4096,
  current_version_id: "v1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const sampleFolder = { id: "folder1", name: "Reports", owner_id: "u1", parent_id: null };

describe("FilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when the current folder has nothing in it", async () => {
    (filesApi.listContents as any).mockResolvedValue({ data: { folders: [], files: [] } });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /my files/i })).toBeInTheDocument();
    });
    // Nothing to click through to, but the page should render without error
    expect(screen.queryByText("budget.xlsx")).not.toBeInTheDocument();
  });

  it("lists files and folders returned from the API", async () => {
    (filesApi.listContents as any).mockResolvedValue({ data: { folders: [sampleFolder], files: [sampleFile] } });
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("budget.xlsx")).toBeInTheDocument();
      expect(screen.getByText("Reports")).toBeInTheDocument();
    });
  });

  it("creates a folder when the new folder form is submitted", async () => {
    (filesApi.listContents as any).mockResolvedValue({ data: { folders: [], files: [] } });
    (filesApi.createFolder as any).mockResolvedValue({ data: { ...sampleFolder, name: "New Stuff" } });
    renderWithProviders();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByRole("heading", { name: /my files/i })).toBeInTheDocument());

    await user.click(screen.getByText("New folder"));
    const input = screen.getByPlaceholderText("Folder name");
    await user.type(input, "New Stuff");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(filesApi.createFolder).toHaveBeenCalledWith("New Stuff", null);
    });
  });

  it("switches into search mode when a ?q= param is present", async () => {
    (filesApi.search as any).mockResolvedValue({ data: [sampleFile] });
    render(
      <Provider
        store={configureStore({
          reducer: { auth: authReducer, toasts: toastReducer, uploads: uploadReducer },
          preloadedState: {
            auth: { status: "authenticated", user: { id: "u1", email: "u@example.com", full_name: "T", role: "USER" }, error: null } as any,
          },
        })}
      >
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/files?q=budget"]}>
            <FilesPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/search: "budget"/i)).toBeInTheDocument();
      expect(screen.getByText("budget.xlsx")).toBeInTheDocument();
    });
  });
});

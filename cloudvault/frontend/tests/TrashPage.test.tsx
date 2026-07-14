import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import toastReducer from "@/store/toastSlice";
import TrashPage from "@/pages/TrashPage";
import { filesApi } from "@/services/filesApi";

vi.mock("@/services/filesApi", () => ({
  filesApi: {
    listTrash: vi.fn(),
    restoreFile: vi.fn(),
    permanentlyDeleteFile: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const store = configureStore({ reducer: { toasts: toastReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
}

const sampleFile = {
  id: "f1",
  name: "old-report.pdf",
  folder_id: null,
  mime_type: "application/pdf",
  size_bytes: 2048,
  current_version_id: "v1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-05T00:00:00Z",
};

describe("TrashPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when trash has nothing in it", async () => {
    (filesApi.listTrash as any).mockResolvedValue({ data: [] });
    renderWithProviders(<TrashPage />);

    await waitFor(() => {
      expect(screen.getByText(/trash is empty/i)).toBeInTheDocument();
    });
  });

  it("lists trashed files", async () => {
    (filesApi.listTrash as any).mockResolvedValue({ data: [sampleFile] });
    renderWithProviders(<TrashPage />);

    await waitFor(() => {
      expect(screen.getByText("old-report.pdf")).toBeInTheDocument();
    });
  });

  it("restores a file when Restore is clicked", async () => {
    (filesApi.listTrash as any).mockResolvedValue({ data: [sampleFile] });
    (filesApi.restoreFile as any).mockResolvedValue({ data: sampleFile });
    renderWithProviders(<TrashPage />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("old-report.pdf")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/more actions/i));
    await user.click(screen.getByText("Restore"));

    await waitFor(() => {
      expect(filesApi.restoreFile).toHaveBeenCalledWith("f1");
    });
  });

  it("requires confirmation before permanently deleting a file", async () => {
    (filesApi.listTrash as any).mockResolvedValue({ data: [sampleFile] });
    (filesApi.permanentlyDeleteFile as any).mockResolvedValue({});
    renderWithProviders(<TrashPage />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("old-report.pdf")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/more actions/i));
    await user.click(screen.getByText("Delete forever"));

    // Confirmation dialog should appear, and nothing should be deleted yet
    expect(screen.getByText(/delete forever\?/i)).toBeInTheDocument();
    expect(filesApi.permanentlyDeleteFile).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^delete forever$/i }));

    await waitFor(() => {
      expect(filesApi.permanentlyDeleteFile).toHaveBeenCalledWith("f1");
    });
  });
});

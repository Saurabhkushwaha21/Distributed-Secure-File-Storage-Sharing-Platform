import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "@/pages/RegisterPage";
import { authApi } from "@/services/authApi";

vi.mock("@/services/authApi", () => ({
  authApi: {
    register: vi.fn(),
  },
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name, email, and password fields", () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows a strength label once the user starts typing a password", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    const user = userEvent.setup();

    expect(screen.queryByText(/too weak|weak|fair|good|strong/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/password/i), "abc");
    expect(screen.getByText(/too weak/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/password/i), "12345ABC!");
    expect(screen.getByText(/strong/i)).toBeInTheDocument();
  });

  it("submits registration and shows an error on failure", async () => {
    (authApi.register as any).mockRejectedValue({ response: { data: { detail: "Email already registered" } } });
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/password/i), "SuperSecret1!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email already registered");
    });
  });

  it("calls authApi.register with the entered values on submit", async () => {
    (authApi.register as any).mockResolvedValue({ data: {} });
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");
    await user.type(screen.getByLabelText(/password/i), "SuperSecret1!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith("jane@example.com", "SuperSecret1!", "Jane Doe");
    });
  });
});

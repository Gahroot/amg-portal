import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LoginForm } from "../login-form";

// ---- next/navigation --------------------------------------------------------
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/login",
}));

// ---- auth-provider ----------------------------------------------------------
// vi.hoisted ensures these values exist when vi.mock() factory runs (mocks are
// hoisted to top of file before any other variable declarations).
const { MockMFARequiredError, MockMFASetupRequiredError, mockLogin } =
  vi.hoisted(() => {
    const mockLogin = vi.fn();

    class MockMFARequiredError extends Error {
      mfaRequired = true;
      constructor() {
        super("MFA code required");
        this.name = "MFARequiredError";
      }
    }

    class MockMFASetupRequiredError extends Error {
      mfaSetupRequired = true;
      constructor() {
        super("MFA setup required");
        this.name = "MFASetupRequiredError";
      }
    }

    return { MockMFARequiredError, MockMFASetupRequiredError, mockLogin };
  });

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ login: mockLogin }),
  MFARequiredError: MockMFARequiredError,
  MFASetupRequiredError: MockMFASetupRequiredError,
}));

// -----------------------------------------------------------------------------

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // react-hook-form / zod validation messages
    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email address/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("calls login with email and password on valid submit", async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@anchormillgroup.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "admin@anchormillgroup.com",
        password: "secret123",
      });
    });
  });

  it("displays server error message when login fails", async () => {
    mockLogin.mockRejectedValue({
      response: { data: { detail: "Invalid credentials" } },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@anchormillgroup.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows MFA input when login returns mfaRequired", async () => {
    mockLogin.mockRejectedValue({ mfaRequired: true });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@anchormillgroup.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(/two-factor authentication code/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to login/i })).toBeInTheDocument();
  });

  it("redirects to mfa-setup when MFASetupRequiredError is thrown", async () => {
    mockLogin.mockRejectedValue(new MockMFASetupRequiredError());
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "admin@anchormillgroup.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/mfa-setup");
    });
  });
});

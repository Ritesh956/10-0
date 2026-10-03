import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const api = vi.hoisted(() => ({ getAuthProviders: vi.fn(), requestMagicLink: vi.fn() }));
vi.mock("../api/client", () => ({ api }));
const signInWithGoogle = vi.fn();
vi.mock("../lib/auth-context", () => ({ useAuth: () => ({ signInWithGoogle }) }));

import { PasswordlessSignIn } from "./PasswordlessSignIn";

afterEach(() => {
  vi.clearAllMocks();
});

describe("PasswordlessSignIn", () => {
  it("emails a link (with the redirect) and confirms where it went", async () => {
    api.getAuthProviders.mockResolvedValue({ emailLink: true, google: false, googleClientId: null });
    api.requestMagicLink.mockResolvedValue({ sent: true });
    const { getByPlaceholderText, getByRole, findByText } = render(<PasswordlessSignIn redirect="/profile" />);

    fireEvent.change(getByPlaceholderText("you@example.com"), { target: { value: "kdb@city.com" } });
    fireEvent.click(getByRole("button", { name: /email me a sign-in link/i }));

    expect(await findByText(/check your inbox/i)).toBeTruthy();
    expect(api.requestMagicLink).toHaveBeenCalledWith("kdb@city.com", "/profile");
    expect(await findByText("kdb@city.com")).toBeTruthy();
  });

  it("shows the server's error, e.g. too many links", async () => {
    api.getAuthProviders.mockResolvedValue({ emailLink: true, google: false, googleClientId: null });
    api.requestMagicLink.mockRejectedValue(new Error("Too many sign-in links requested"));
    const { getByPlaceholderText, getByRole, findByText } = render(<PasswordlessSignIn />);
    fireEvent.change(getByPlaceholderText("you@example.com"), { target: { value: "a@b.com" } });
    fireEvent.click(getByRole("button", { name: /email me/i }));
    expect(await findByText(/too many/i)).toBeTruthy();
  });

  it("hides Google until the server has a client id", async () => {
    api.getAuthProviders.mockResolvedValue({ emailLink: true, google: false, googleClientId: null });
    const { queryByTestId, findByPlaceholderText } = render(<PasswordlessSignIn />);
    await findByPlaceholderText("you@example.com");
    await Promise.resolve();
    expect(queryByTestId("google-button")).toBeNull();
  });
});

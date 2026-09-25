import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { disableDraftMode } from "@/app/actions/disableDraftMode";
import { DisableDraftMode } from "@/components/DisableDraftMode";

const mocks = vi.hoisted(() => ({
  environment: "live",
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("next-sanity/hooks", () => ({
  useDraftModeEnvironment: () => mocks.environment,
}));
vi.mock("@/app/actions/disableDraftMode", () => ({
  disableDraftMode: vi.fn(),
}));

describe("draft preview exit", () => {
  it("disables draft mode and refreshes the public page", async () => {
    mocks.environment = "live";
    vi.mocked(disableDraftMode).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DisableDraftMode />);

    await user.click(
      screen.getByRole("button", { name: "Disable draft mode" }),
    );

    expect(disableDraftMode).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not show the exit control inside Sanity Presentation", () => {
    mocks.environment = "presentation";

    render(<DisableDraftMode />);

    expect(
      screen.queryByRole("button", { name: "Disable draft mode" }),
    ).not.toBeInTheDocument();
  });
});

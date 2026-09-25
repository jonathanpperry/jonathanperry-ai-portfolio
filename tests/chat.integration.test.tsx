import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/app/actions/create-session";
import ChatWrapper from "@/components/chat/ChatWrapper";

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  useChatKit: vi.fn((_options: unknown) => ({ control: "test-control" })),
  toggleSidebar: vi.fn(),
}));

vi.mock("next-sanity", () => ({ defineQuery: (query: string) => query }));
vi.mock("@/sanity/lib/live", () => ({ sanityFetch: mocks.fetchProfile }));
vi.mock("@openai/chatkit-react", () => ({
  useChatKit: mocks.useChatKit,
  ChatKit: ({ control }: { control: string }) => <div>ChatKit: {control}</div>,
}));
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ toggleSidebar: mocks.toggleSidebar }),
}));
vi.mock("@/app/actions/create-session", () => ({ createSession: vi.fn() }));

type ChatOptions = {
  api: { getClientSecret: (oldSecret?: string) => Promise<string> };
  header: { title: { text: string }; leftAction: { onClick: () => void } };
  startScreen: { greeting: string; prompts: { label: string }[] };
};

describe("CMS profile into the ChatKit sidebar", () => {
  it("personalizes the chat and delegates session creation and close", async () => {
    mocks.fetchProfile.mockResolvedValue({
      data: { firstName: "Test", lastName: "Engineer" },
    });
    vi.mocked(createSession).mockResolvedValue("secret-123");

    render(await ChatWrapper());

    expect(screen.getByText("ChatKit: test-control")).toBeInTheDocument();
    const options = mocks.useChatKit.mock.calls[0][0] as ChatOptions;
    expect(options.header.title.text).toContain("Test");
    expect(options.startScreen.greeting).toContain("Test Engineer");
    expect(options.startScreen.prompts.map((prompt) => prompt.label)).toContain(
      "What have you built?",
    );
    await expect(options.api.getClientSecret()).resolves.toBe("secret-123");
    expect(createSession).toHaveBeenCalledOnce();
    options.header.leftAction.onClick();
    expect(mocks.toggleSidebar).toHaveBeenCalledOnce();
  });

  it("shows a useful greeting when the CMS profile is absent", async () => {
    mocks.fetchProfile.mockResolvedValue({ data: null });

    render(await ChatWrapper());

    const options = mocks.useChatKit.mock.calls[0][0] as ChatOptions;
    expect(options.header.title.text).toContain("Me");
    expect(options.startScreen.greeting).toContain("Ask me anything");
  });
});

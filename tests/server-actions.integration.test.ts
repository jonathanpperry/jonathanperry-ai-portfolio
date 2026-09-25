import { auth } from "@clerk/nextjs/server";
import { draftMode } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/app/actions/create-session";
import { disableDraftMode } from "@/app/actions/disableDraftMode";
import { submitContactForm } from "@/app/actions/submit-contact-form";
import { serverClient } from "@/sanity/lib/serverClient";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
const sessionConfig = vi.hoisted(() => ({ workflowId: "workflow-test" }));
vi.mock("@/lib/config", () => ({
  get WORKFLOW_ID() {
    return sessionConfig.workflowId;
  },
}));
vi.mock("@/sanity/lib/serverClient", () => ({
  serverClient: { create: vi.fn() },
}));
vi.mock("next/headers", () => ({ draftMode: vi.fn() }));

const form = (overrides: Record<string, string> = {}) => {
  const values = {
    name: "Test Visitor",
    email: "visitor@example.com",
    subject: "Project inquiry",
    message: "Let's talk about a project.",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

describe("contact form through the Sanity write boundary", () => {
  it("persists a complete submission with its status and timestamp", async () => {
    vi.mocked(serverClient.create).mockResolvedValue({
      _id: "contact-1",
    } as never);

    const result = await submitContactForm(form());

    expect(result).toEqual({ success: true, data: { _id: "contact-1" } });
    expect(serverClient.create).toHaveBeenCalledOnce();
    expect(serverClient.create).toHaveBeenCalledWith({
      _type: "contact",
      name: "Test Visitor",
      email: "visitor@example.com",
      subject: "Project inquiry",
      message: "Let's talk about a project.",
      status: "new",
      submittedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it.each(["name", "email", "message"])(
    "rejects a missing %s before writing",
    async (field) => {
      expect(await submitContactForm(form({ [field]: "" }))).toEqual({
        success: false,
        error: "Please fill in all required fields",
      });
      expect(serverClient.create).not.toHaveBeenCalled();
    },
  );

  it("reports a Sanity failure without claiming the message was delivered", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(serverClient.create).mockRejectedValue(
      new Error("network failure"),
    );

    expect(await submitContactForm(form())).toEqual({
      success: false,
      error: "Failed to submit the form. Please try again later.",
    });
  });
});

describe("authenticated ChatKit session creation", () => {
  beforeEach(() => {
    sessionConfig.workflowId = "workflow-test";
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses an unsigned visitor before contacting OpenAI", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(createSession()).rejects.toThrow(
      "Unauthorized - Please sign in",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires an API key before contacting OpenAI", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-123" } as never);
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(createSession()).rejects.toThrow(
      "OPENAI_API_KEY not configured",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires a configured workflow before contacting OpenAI", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-123" } as never);
    sessionConfig.workflowId = "";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(createSession()).rejects.toThrow("WORKFLOW_ID not configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes the Clerk identity and workflow to OpenAI and returns the secret", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-123" } as never);
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ client_secret: "session-secret" }),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(createSession()).resolves.toBe("session-secret");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chatkit/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "OpenAI-Beta": "chatkit_beta=v1",
        }),
        body: JSON.stringify({
          workflow: { id: "workflow-test" },
          user: "user-123",
        }),
      }),
    );
  });

  it("surfaces a provider error to the caller", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-123" } as never);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, text: async () => "invalid workflow" }),
    );

    await expect(createSession()).rejects.toThrow(
      "Failed to create session: invalid workflow",
    );
  });
});

describe("draft-mode cookie", () => {
  it("disables the preview session", async () => {
    const disable = vi.fn().mockResolvedValue(undefined);
    vi.mocked(draftMode).mockResolvedValue({ disable } as never);
    vi.useFakeTimers();
    try {
      const action = disableDraftMode();
      await vi.advanceTimersByTimeAsync(1000);
      await action;
      expect(disable).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

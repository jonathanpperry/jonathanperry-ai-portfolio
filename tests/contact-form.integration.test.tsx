import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { submitContactForm } from "@/app/actions/submit-contact-form";
import { ContactForm } from "@/components/sections/ContactForm";

vi.mock("@/app/actions/submit-contact-form", () => ({
  submitContactForm: vi.fn(),
}));

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Test Visitor");
  await user.type(screen.getByLabelText("Email"), "visitor@example.com");
  await user.type(screen.getByLabelText("Subject"), "Hello");
  await user.type(screen.getByLabelText("Message"), "I like your portfolio.");
}

describe("visitor contact journey", () => {
  it("sends the entered fields, confirms success, and resets the form", async () => {
    vi.mocked(submitContactForm).mockResolvedValue({
      success: true,
      data: { _id: "contact-1" } as never,
    });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send Message" }));

    expect(
      await screen.findByText(
        "Thank you! Your message has been sent successfully.",
      ),
    ).toBeInTheDocument();
    expect(submitContactForm).toHaveBeenCalledOnce();
    const data = vi.mocked(submitContactForm).mock.calls[0][0];
    expect(Object.fromEntries(data.entries())).toEqual({
      name: "Test Visitor",
      email: "visitor@example.com",
      subject: "Hello",
      message: "I like your portfolio.",
    });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("keeps the message for retry when the write fails", async () => {
    vi.mocked(submitContactForm).mockResolvedValue({
      success: false,
      error: "Failed to submit the form. Please try again later.",
    });
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Send Message" }));

    expect(
      await screen.findByText(
        "Failed to submit the form. Please try again later.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue(
      "I like your portfolio.",
    );
  });

  it("requires all four visible inputs before submitting", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    await user.click(screen.getByRole("button", { name: "Send Message" }));

    expect(submitContactForm).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Name")).toBeInvalid();
  });
});

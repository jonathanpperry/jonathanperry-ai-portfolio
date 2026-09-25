import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModeToggle } from "@/components/DarkModeToggle";
import { FloatingDock } from "@/components/FloatingDock";
import { FloatingDockClient } from "@/components/FloatingDockClient";
import SidebarToggle from "@/components/SidebarToggle";
import { ProfileImage } from "@/components/sections/ProfileImage";

const state = vi.hoisted(() => ({
  signedIn: false,
  sidebarOpen: false,
  toggleSidebar: vi.fn(),
  openSignIn: vi.fn(),
  signOut: vi.fn(),
  setTheme: vi.fn(),
  fetchNavigation: vi.fn(),
}));

vi.mock("next-sanity", () => ({ defineQuery: (query: string) => query }));
vi.mock("@/sanity/lib/live", () => ({ sanityFetch: state.fetchNavigation }));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: state.signedIn }),
  useClerk: () => ({ signOut: state.signOut, openSignIn: state.openSignIn }),
  SignInButton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    open: state.sidebarOpen,
    openMobile: false,
    isMobile: false,
    toggleSidebar: state.toggleSidebar,
  }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: state.setTheme }),
}));
vi.mock("@/components/DynamicIcon", () => ({
  DynamicIcon: () => <span aria-hidden="true" />,
}));
vi.mock("next/image", () => ({
  default: ({
    alt,
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => (
    <span role="img" aria-label={alt} />
  ),
}));

const items = [
  { title: "Home", href: "#home", icon: "IconHome" },
  { title: "About", href: "#about", icon: "IconUser" },
  { title: "Experience", href: "#experience", icon: "IconBriefcase" },
  { title: "Projects", href: "#projects", icon: "IconCode" },
  { title: "Skills", href: "#skills", icon: "IconBulb" },
  { title: "Writing", href: "https://example.com/writing", isExternal: true },
  { title: "Contact", href: "#contact", icon: "IconMail" },
];

describe("portfolio navigation and visitor controls", () => {
  beforeEach(() => {
    state.signedIn = false;
    state.sidebarOpen = false;
  });

  it("reveals overflow links and marks external links safely", async () => {
    const user = userEvent.setup();
    render(<FloatingDockClient navItems={items} />);

    expect(screen.getByRole("link", { name: "Writing" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "Writing" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(
      screen.queryByRole("link", { name: "Contact" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "More" })[0]);
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "#contact",
    );
  });

  it("loads dock links from Sanity and hides an empty dock", async () => {
    state.fetchNavigation.mockResolvedValueOnce({ data: items });
    const { unmount } = render(await FloatingDock());
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "#home",
    );
    unmount();

    state.fetchNavigation.mockResolvedValueOnce({ data: [] });
    expect(await FloatingDock()).toBeNull();
  });

  it("opens and closes the overflow menu on mobile", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <FloatingDockClient
        navItems={[
          ...items,
          { title: "Blog", href: "#blog" },
          { title: "Resume", href: "#resume" },
        ]}
      />,
    );
    const mobileMenu = container.querySelector(".md\\:hidden > button");
    if (!mobileMenu) throw new Error("Mobile menu button is missing");

    await user.click(mobileMenu);
    const more = screen.getAllByRole("button", { name: "More" }).at(-1);
    if (!more) throw new Error("Mobile overflow button is missing");
    await user.click(more);
    await user.click(screen.getByRole("link", { name: "Resume" }));

    expect(
      screen.queryByRole("link", { name: "Resume" }),
    ).not.toBeInTheDocument();
  });

  it("lets signed-in visitors sign out from the dock", async () => {
    state.signedIn = true;
    const user = userEvent.setup();
    render(<FloatingDockClient navItems={items} />);

    await user.click(screen.getAllByRole("button", { name: "More" })[0]);
    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(state.signOut).toHaveBeenCalledOnce();
  });

  it("gates the chat button and profile image with Clerk sign-in", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SidebarToggle />
        <ProfileImage
          imageUrl="https://cdn.sanity.io/example.jpg"
          firstName="Test"
          lastName="Engineer"
        />
      </>,
    );

    expect(
      screen.getByRole("button", { name: "Sign in to chat with AI Twin" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Toggle AI Chat Sidebar" }),
    );
    expect(state.openSignIn).toHaveBeenCalledOnce();
    expect(state.toggleSidebar).not.toHaveBeenCalled();
  });

  it("opens chat from both entry points for an authenticated visitor", async () => {
    state.signedIn = true;
    const user = userEvent.setup();
    render(
      <>
        <SidebarToggle />
        <ProfileImage
          imageUrl="https://cdn.sanity.io/example.jpg"
          firstName="Test"
          lastName="Engineer"
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Chat with AI Twin" }));
    await user.click(
      screen.getByRole("button", { name: "Toggle AI Chat Sidebar" }),
    );
    expect(state.toggleSidebar).toHaveBeenCalledTimes(2);
    expect(state.openSignIn).not.toHaveBeenCalled();
  });

  it("offers light, dark, and system theme settings", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(screen.getByRole("menuitem", { name: "Dark" }));
    expect(state.setTheme).toHaveBeenCalledWith("dark");
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(screen.getByRole("menuitem", { name: "System" }));
    expect(state.setTheme).toHaveBeenCalledWith("system");
  });
});

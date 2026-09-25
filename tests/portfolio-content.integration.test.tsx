import { render, screen } from "@testing-library/react";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioContent from "@/components/PortfolioContent";

const sanityFetchMock = vi.hoisted(() => vi.fn());

vi.mock("next-sanity", () => ({ defineQuery: (query: string) => query }));
vi.mock("@/sanity/lib/live", () => ({ sanityFetch: sanityFetchMock }));
vi.mock("@/sanity/lib/image", () => ({
  urlFor: () => ({
    width() {
      return this;
    },
    height() {
      return this;
    },
    url() {
      return "https://cdn.sanity.io/test.png";
    },
  }),
}));
vi.mock("@/app/actions/submit-contact-form", () => ({
  submitContactForm: vi.fn(),
}));
// These widgets have their own animations or layout measurements. Keep the
// actual section queries, content mapping, links, and contact form in the test.
vi.mock("@/components/ui/background-ripple-effect", () => ({
  BackgroundRippleEffect: () => null,
}));
vi.mock("@/components/ui/animated-testimonials", () => ({
  AnimatedTestimonials: ({
    testimonials,
  }: {
    testimonials: { name: string; quote: string }[];
  }) => (
    <div>
      {testimonials.map((item) => (
        <p key={item.name}>
          {item.name}: {item.quote}
        </p>
      ))}
    </div>
  ),
}));
vi.mock("@/components/sections/SkillsChart", () => ({
  SkillsChart: ({ skills }: { skills: { name: string }[] }) => (
    <div>
      {skills.map((skill) => (
        <span key={skill.name}>{skill.name}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/components/ui/comet-card", () => ({
  CometCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/world-map-demo", () => ({ default: () => null }));

const profile = {
  firstName: "Test",
  lastName: "Engineer",
  headline: "Software developer",
  shortBio: "I build useful applications.",
  fullBio: [
    {
      _type: "block",
      _key: "bio",
      style: "normal",
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: "text",
          marks: [],
          text: "A longer introduction.",
        },
      ],
    },
  ],
  stats: [{ label: "Projects", value: "12" }],
  email: "hello@example.com",
  phone: "555-0100",
  location: "Detroit, MI",
  availability: "Available",
  socialLinks: {
    github: "https://github.com/example",
    linkedin: "https://linkedin.com/in/example",
  },
};

const records: Record<string, unknown[]> = {
  testimonial: [
    {
      name: "Client A",
      position: "Founder",
      company: "Example Co",
      testimonial: "Strong collaboration.",
      featured: true,
    },
  ],
  skill: [
    {
      name: "TypeScript",
      category: "frontend",
      percentage: 90,
      color: "#000000",
    },
  ],
  experience: [
    {
      company: "Example Co",
      position: "Software Engineer",
      startDate: "2025-01-01",
      current: true,
      responsibilities: ["Shipped a product"],
      technologies: [{ name: "React" }],
    },
  ],
  education: [
    {
      institution: "Example University",
      degree: "B.S. Computer Science",
      startDate: "2015-01-01",
      endDate: "2019-01-01",
      website: "https://example.edu",
    },
  ],
  project: [
    {
      title: "Test Project",
      slug: { current: "test-project" },
      tagline: "A useful tool",
      category: "Web",
      technologies: [{ name: "React" }],
      liveUrl: "https://example.com/demo",
      githubUrl: "https://github.com/example/project",
    },
  ],
  certification: [
    {
      name: "Example Certification",
      issuer: "Certifier",
      issueDate: "2025-01-01",
      expiryDate: "2030-01-01",
      credentialUrl: "https://example.com/verify",
    },
  ],
  achievement: [
    {
      title: "Example Award",
      type: "award",
      issuer: "Awarder",
      date: "2025-01-01",
      featured: true,
      url: "https://example.com/award",
    },
  ],
  service: [
    {
      title: "Example Service",
      slug: { current: "example-service" },
      shortDescription: "Build an app",
      featured: true,
      features: ["Fast delivery"],
      pricing: { startingPrice: 1000, priceType: "project" },
    },
  ],
  blog: [
    {
      title: "Test Post",
      slug: { current: "test-post" },
      excerpt: "A short excerpt",
      publishedAt: "2025-01-01",
      tags: ["testing"],
      readTime: 3,
    },
  ],
};

async function renderPortfolio() {
  // Resolve the async Server Components before mounting their resulting tree
  // in jsdom, just as Next resolves them before sending the client its page.
  const page = await PortfolioContent();
  const sections = await Promise.all(
    Children.toArray(page.props.children).map((node) => {
      if (!isValidElement(node) || typeof node.type !== "function") {
        throw new Error("Expected an async portfolio section");
      }
      return (node.type as () => Promise<ReactNode>)();
    }),
  );
  const keyed = sections
    .filter(isValidElement)
    .map((section) =>
      cloneElement(section, { key: (section.props as { id: string }).id }),
    );
  return render(<main>{keyed}</main>);
}

describe("Sanity content through the complete portfolio page", () => {
  beforeEach(() => {
    sanityFetchMock.mockImplementation(async ({ query }: { query: string }) => {
      if (query.includes("singleton-profile")) return { data: profile };
      const type = query.match(/_type == "([^"]+)"/)?.[1];
      return { data: type ? (records[type] ?? []) : [] };
    });
  });

  it("renders all populated sections and their visitor actions", async () => {
    const { container } = await renderPortfolio();

    expect(
      screen.getByRole("heading", { level: 1, name: "Test Engineer" }),
    ).toBeInTheDocument();
    for (const heading of [
      "About Me",
      "Client Testimonials",
      "Skills & Expertise",
      "Work Experience",
      "Education",
      "Featured Projects",
      "Certifications",
      "Achievements & Awards",
      "Services",
      "Latest Blog Posts",
      "Get In Touch",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("A longer introduction.")).toBeInTheDocument();
    expect(
      screen.getByText("Client A: Strong collaboration."),
    ).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Shipped a product")).toBeInTheDocument();
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("Example Certification")).toBeInTheDocument();
    expect(screen.getByText("Example Award")).toBeInTheDocument();
    expect(screen.getByText("Fast delivery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live Demo" })).toHaveAttribute(
      "href",
      "https://example.com/demo",
    );
    expect(screen.getByRole("link", { name: /Read More/ })).toHaveAttribute(
      "href",
      "/blog/test-post",
    );
    expect(
      screen.getByRole("link", { name: "hello@example.com" }),
    ).toHaveAttribute("href", "mailto:hello@example.com");
    expect(
      screen.getByRole("button", { name: "Send Message" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("main > section")).toHaveLength(12);
  });

  it("omits absent CMS sections while keeping other content available", async () => {
    sanityFetchMock.mockImplementation(
      async ({ query }: { query: string }) => ({
        data: query.includes("singleton-profile") ? profile : [],
      }),
    );

    const { container } = await renderPortfolio();

    expect(
      screen.getByRole("heading", { level: 1, name: "Test Engineer" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Featured Projects" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Get In Touch" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("main > section")).toHaveLength(3);
  });
});

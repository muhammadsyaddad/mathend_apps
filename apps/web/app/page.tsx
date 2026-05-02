import Image from "next/image";
import styles from "./page.module.css";

const featureItems = [
  {
    title: "Math-first Editor",
    detail:
      "Write notes and formulas in one canvas, with zero context switching. Native support for LaTeX, AsciiMath, and Unicode math symbols.",
  },
  {
    title: "Live Preview",
    detail:
      "See clean output while you type. Real-time rendering with KaTeX for instant feedback on complex equations and matrices.",
  },
  {
    title: "Fast Export",
    detail:
      "Generate polished PDFs, HTML, or Markdown files when your draft is done. No manual cleanup, no formatting fights.",
  },
  {
    title: "Workspace Flow",
    detail:
      "Organize files, tabs, and revisions in a focused structure. Nested folders, search, and keyboard-driven navigation.",
  },
];

const workflowSteps = [
  {
    title: "Draft",
    detail:
      "Capture ideas in plain text and equations, then shape them into structure.",
  },
  {
    title: "Refine",
    detail:
      "Use live preview to tighten layout, notation, and final readability.",
  },
  {
    title: "Ship",
    detail:
      "Export and publish your work for class, clients, or internal docs.",
  },
];

const useCases = [
  {
    role: "Researchers",
    tasks: "Papers, theses, citations",
    quote: "Finally a tool that understands how we actually work.",
  },
  {
    role: "Students",
    tasks: "Homework, lecture notes, exams",
    quote: "My notes have never looked this clean.",
  },
  {
    role: "Educators",
    tasks: "Course materials, presentations",
    quote: "I spend less time formatting, more time teaching.",
  },
  {
    role: "Engineers",
    tasks: "Technical docs, specifications",
    quote: "The math rendering is unmatched.",
  },
];

const capabilities = [
  {
    title: "LaTeX Engine",
    detail:
      "Full LaTeX 3 support with Unicode math, custom macros, and bibliography management via BibTeX.",
    icon: "∑",
  },
  {
    title: "TikZ Graphics",
    detail:
      "Built-in TikZ preview with smart snippets, diagram templates, and inline drawing commands.",
    icon: "◈",
  },
  {
    title: "Auto-save & Versioning",
    detail:
      "Every keystroke is captured. Roll back to any point in the last 30 days with one click.",
    icon: "◷",
  },
  {
    title: "Multi-format Export",
    detail:
      "PDF with embedded fonts, HTML with MathJax, Markdown, or plain LaTeX source.",
    icon: "⇲",
  },
  {
    title: "Template System",
    detail:
      "Start from scratch or use built-in templates for research papers, homework, lecture notes.",
    icon: "◫",
  },
  {
    title: "Keyboard-first",
    detail:
      "Vim-style bindings, command palette, quick-insert for symbols, and full keyboard navigation.",
    icon: "⌘",
  },
];

const plans = [
  {
    name: "Personal",
    price: "$0",
    period: "forever",
    description: "For individuals writing math for study or personal notes.",
    features: [
      "Unlimited documents",
      "Basic LaTeX math rendering",
      "Export to PDF",
      "Local storage only",
    ],
    cta: "Get Started",
    ctaLink: "/download",
  },
  {
    name: "Pro",
    price: "$29",
    period: "one-time",
    description: "For researchers, educators, and serious writers.",
    features: [
      "Everything in Personal",
      "Advanced TikZ diagrams",
      "Version history (30 days)",
      "Priority export formats",
      "Cloud sync",
      "Email support",
    ],
    cta: "Buy Pro",
    ctaLink: "https://lemonsqueezy.com",
  },
  {
    name: "Studio",
    price: "$99",
    period: "one-time",
    description: "For teams and institutions needing collaboration.",
    features: [
      "Everything in Pro",
      "Unlimited version history",
      "Team workspaces (up to 10)",
      "Shared templates",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    ctaLink: "mailto:hello@mathend.com",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Mathend</div>
        <nav className={styles.nav}>
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#start">Start</a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.headline}>
            Your Paper
            <br />
            Changer.
          </h1>
          <p className={styles.subhead}>
            A workspace built with cold restraint. Focus on your equations and
            drafts without the noise.
          </p>
          <figure className={styles.heroVisual}>
            <video
              className={styles.heroVideo}
              src="/my-video.mp4"
              poster="/dummy-workspace.jpg"
              autoPlay
              loop
              muted
              playsInline
            />
          </figure>
        </section>

        <section className={styles.section} id="product">
          <div className={styles.grid}>
            <div className={styles.colLeft}>
              <h2 className={styles.editorialTitle}>Principles</h2>
              <p className={styles.editorialText}>
                Our tools are designed to stay out of your way. Math and text
                merged seamlessly into one structural flow. No menus to dig
                through, no mode switches, no preview windows—just your work,
                rendered as you type.
              </p>
            </div>
            <div className={styles.colRight}>
              <ul className={styles.featureList}>
                {featureItems.map((item, i) => (
                  <li key={item.title} className={styles.featureItem}>
                    <span className={styles.featureNumber}>0{i + 1}</span>
                    <h3 className={styles.featureTitle}>{item.title}</h3>
                    <p className={styles.featureDetail}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.workflow} id="workflow">
          <div className={styles.workflowHeader}>
            <p className={styles.workflowKicker}>workflow</p>
            <h2 className={styles.workflowTitle}>From draft to done.</h2>
          </div>
          <div className={styles.workflowTimeline}>
            {workflowSteps.map((step, i) => (
              <div key={step.title} className={styles.workflowItem}>
                <div className={styles.workflowStepNum}>0{i + 1}</div>
                <div className={styles.workflowContent}>
                  <h3 className={styles.workflowStepTitle}>{step.title}</h3>
                  <p className={styles.workflowStepDetail}>{step.detail}</p>
                </div>
                {i < workflowSteps.length - 1 && (
                  <div className={styles.workflowLine} />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.capabilities}>
          <div className={styles.capHeader}>
            <p className={styles.capKicker}>capabilities</p>
            <h2 className={styles.capTitle}>Built for serious work.</h2>
          </div>
          <div className={styles.capGrid}>
            {capabilities.map((cap) => (
              <article key={cap.title} className={styles.capCard}>
                <span className={styles.capIcon}>{cap.icon}</span>
                <h3 className={styles.capCardTitle}>{cap.title}</h3>
                <p className={styles.capCardDetail}>{cap.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.useCases}>
          <div className={styles.useCasesHeader}>
            <p className={styles.useCasesKicker}>who it is for</p>
            <h2 className={styles.useCasesTitle}>
              Made for math professionals.
            </h2>
          </div>
          <div className={styles.useCasesList}>
            {useCases.map((useCase) => (
              <article key={useCase.role} className={styles.useCaseCard}>
                <div className={styles.useCaseTop}>
                  <h3 className={styles.useCaseRole}>{useCase.role}</h3>
                  <p className={styles.useCaseTasks}>{useCase.tasks}</p>
                </div>
                <blockquote className={styles.useCaseQuote}>
                  {useCase.quote}
                </blockquote>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.pricing} id="pricing">
          <div className={styles.pricingHeader}>
            <p className={styles.pricingKicker}>pricing</p>
            <h2 className={styles.pricingTitle}>Simple, upfront pricing.</h2>
            <p className={styles.pricingSubtitle}>
              No subscriptions. No surprises. One payment, yours forever.
            </p>
          </div>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <article key={plan.name} className={styles.planCard}>
                <div className={styles.planHeader}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <div className={styles.planPrice}>
                    <span className={styles.priceAmount}>{plan.price}</span>
                    <span className={styles.pricePeriod}>/ {plan.period}</span>
                  </div>
                  <p className={styles.planDescription}>{plan.description}</p>
                </div>
                <ul className={styles.planFeatures}>
                  {plan.features.map((feature) => (
                    <li key={feature} className={styles.planFeature}>
                      {feature}
                    </li>
                  ))}
                </ul>
                <a href={plan.ctaLink} className={styles.planCta}>
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.cta} id="start">
          <h2 className={styles.ctaHeadline}>Begin your draft.</h2>
          <a href="/download" className={styles.button}>
            Download Studio
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Mathend Studio</p>
        <p className={styles.footerCopy}>&copy; 2026. Restrained simplicity.</p>
      </footer>
    </div>
  );
}

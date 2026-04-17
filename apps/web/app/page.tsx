import Image from "next/image";
import styles from "./page.module.css";

const featureItems = [
  {
    title: "Math-first Editor",
    detail:
      "Write notes and formulas in one canvas, with zero context switching.",
  },
  {
    title: "Live Preview",
    detail:
      "See clean output while you type, ready for reports, classes, or assignments.",
  },
  {
    title: "Fast Export",
    detail:
      "Generate polished files when your draft is done. No manual cleanup needed.",
  },
  {
    title: "Workspace Flow",
    detail:
      "Organize files, tabs, and revisions in a focused structure for deep work.",
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

const pricingPlans = [
  // {
  //   name: "Starter",
  //   price: "$0",
  //   period: "/month",
  //   target: "For personal notes",
  //   features: ["Core editor", "Basic preview", "Local workspace"],
  //   cta: "Get Started",
  // },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    target: "For students and creators",
    features: ["Everything in Starter", "Advanced export", "Priority support"],
    cta: "Start Pro",
    featured: true,
  },
  // {
  //   name: "Team",
  //   price: "$39",
  //   period: "/month",
  //   target: "For labs and teams",
  //   features: ["Shared workspace", "Admin controls", "Dedicated onboarding"],
  //   cta: "Talk to Sales",
  // },
];

const faqs = [
  {
    question: "Can I use Mathend for non-math documents?",
    answer:
      "Yes. It handles regular writing well, but its biggest advantage is formula-heavy workflows.",
  },
  {
    question: "Is this good for classes and assignments?",
    answer:
      "Yes. The editor and export flow are built for student speed, revision cycles, and submission-ready output.",
  },
  {
    question: "Do teams get a shared workflow?",
    answer:
      "Team plans are designed for shared notes, repeatable templates, and cleaner collaboration.",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <p className={styles.brand}>mathend</p>
          <nav className={styles.nav}>
            <a href="#product">product</a>
            <a href="#workflow">workflow</a>
            <a href="#pricing">pricing</a>
            <a href="#faq">faq</a>
            <a href="/download">download</a>
            <a href="#start">start</a>
          </nav>
        </header>

        <main className={styles.main}>
          <section className={styles.hero} id="product">
            <div className={styles.heroContent}>
              <figure className={styles.heroVisual}>
                <div className={styles.imageFrame}>
                  <Image
                    className={styles.heroImage}
                    src="/dummy-workspace.jpg"
                    alt="Desk with notebook and keyboard"
                    width={1600}
                    height={1200}
                    priority
                  />
                </div>
              </figure>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionKicker}>product</p>
            </div>
            <div className={styles.features}>
              {featureItems.map((item) => (
                <article className={styles.feature} key={item.title}>
                  <h3 className={styles.featureTitle}>{item.title}</h3>
                  <p className={styles.featureDetail}>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} id="workflow">
            <div className={styles.sectionHead}>
              <p className={styles.sectionKicker}>workflow</p>
            </div>
            <div className={styles.workflow}>
              {workflowSteps.map((item, index) => (
                <article className={styles.step} key={item.title}>
                  <p className={styles.stepIndex}>0{index + 1}</p>
                  <h3 className={styles.stepTitle}>{item.title}</h3>
                  <p className={styles.stepDetail}>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} id="pricing">
            <div className={styles.sectionHead}>
              <p className={styles.sectionKicker}>pricing</p>
            </div>
            <div className={styles.pricingGrid}>
              {pricingPlans.map((plan) => (
                <article
                  className={
                    plan.featured
                      ? `${styles.plan} ${styles.planFeatured}`
                      : styles.plan
                  }
                  key={plan.name}
                >
                  <p className={styles.planName}>{plan.name}</p>
                  <p className={styles.planPrice}>
                    <span>{plan.price}</span>
                    {plan.period}
                  </p>
                  <p className={styles.planTarget}>{plan.target}</p>
                  <ul className={styles.planFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <a
                    className={styles.planCta}
                    href={plan.name === "Pro" ? "/download" : "#start"}
                  >
                    {plan.cta}
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} id="faq">
            <div className={styles.sectionHead}>
              <p className={styles.sectionKicker}>faq</p>
            </div>
            <div className={styles.faqList}>
              {faqs.map((item) => (
                <article className={styles.faqItem} key={item.question}>
                  <h3 className={styles.faqQuestion}>{item.question}</h3>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.finalCta} id="start">
            <h2>Write faster. Publish cleaner. Stay focused.</h2>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <p className={styles.brand}>mathend</p>
            <p>Focused writing tools for math-heavy work.</p>
          </div>

          <div className={styles.footerLinks}>
            <div>
              <p className={styles.footerTitle}>Product</p>
              <a href="#product">Features</a>
              <a href="#workflow">Workflow</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <p className={styles.footerTitle}>Company</p>
              <a href="#faq">FAQ</a>
              <a href="#start">Get Started</a>
              <a href="#product">Contact</a>
            </div>
          </div>

          <p className={styles.footerMeta}>
            2026 Mathend. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

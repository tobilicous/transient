import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  Camera,
  ClipboardList,
  Clock,
  Lock,
  Mail,
  MapPin,
  Minus,
  Mic,
  Receipt,
  ScrollText,
  Building2,
} from "lucide-react";

import { DashboardMock } from "@/components/marketing/dashboard-mock";
import { PlanLine } from "@/components/marketing/pricing-plans";
import { ShiftLoop } from "@/components/marketing/shift-loop";
import { SiteConfigMock } from "@/components/marketing/site-config-mock";
import { TimelineMock } from "@/components/marketing/timeline-mock";
import { Logo } from "@/components/brand";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ALWAYS_INCLUDED, startingPrice, TRIAL_DAYS } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Transient — log the shift, leave on time",
  description:
    "Transient turns a night of timestamps, photos, and incidents into one clean report and one deliverable email — in minutes, with proof it arrived.",
  alternates: { canonical: "/" },
};

/**
 * Statically generated on purpose. Nothing here reads a cookie, a header, or
 * the database, so Next can render it once at build time and serve HTML — which
 * is most of how the Lighthouse floor in section 7 gets met. The only client
 * JavaScript on the page is the contact form.
 */
export const dynamic = "force-static";

// --- 2. What actually goes wrong ---------------------------------------------
// No statistics here on purpose. We have not run a study, and a made-up number
// with a hedge under it is worse than no number: anyone in this industry knows
// within one line whether you have stood on a loading dock at 2am.
const PROBLEMS = [
  {
    title: "The report gets written twice",
    body: "Once in a notebook during the shift, then again on a laptop at the end of it, from memory and a camera roll that is already out of order. The second version is the one the client reads.",
  },
  {
    title: "Nobody knows if it arrived",
    body: "The facilities contact changed jobs in March. Her address kept accepting mail until it didn't. Six weeks of reports went nowhere and nobody found out until the contract review.",
  },
  {
    title: "Six months later, it is your word against theirs",
    body: "A claim comes in about a damaged bollard on a Tuesday in February. You have the reports. You do not have anything that proves the photo was taken that night and not last week.",
  },
] as const;

// Prices are read from the billing module, never retyped here. A marketing page
// quoting a number the app has stopped charging is the classic way this drifts.
const STARTING_FROM = startingPrice();

// --- 2b. Who pays, and who it is for ------------------------------------------
// One buyer. The contractor pays, the client is who the record has to convince.
// Saying that out loud is the positioning: every competitor sells the building
// owner a way to watch their vendors, which makes the vendor the problem. Here
// the vendor is the customer and the record is the thing they sell with.
const AUDIENCES = [
  {
    title: "You, the guard company",
    who: "You cover other people's buildings and you are the one being judged at renewal.",
    body: "Your people already do the work. What is missing is the part where a client can see it without you emailing them a reassurance. Priced per active site, so covering a shift never costs you more than not covering it.",
    cta: "See pricing",
    href: "#pricing",
  },
  {
    title: "The hotel you cover",
    who: "They never pay us, and they never need an account.",
    body: "They get the same PDF every morning, at the same time, with a content hash on it, from whichever officer worked the night. That consistency is yours to point at when the contract comes up, which is the reason you are buying this and not them.",
    cta: "See a sample report",
    href: "/sample-report",
  },
] as const;

// --- 3. How it works ----------------------------------------------------------
// The four stages live in `shift-loop.tsx` alongside the diagram that draws
// them, because the copy and the geometry have to agree about how many there
// are. Importing them back here to render a second copy is how the two drift.

// --- 4. Feature grid ----------------------------------------------------------
const FEATURES = [
  {
    icon: Clock,
    title: "One-tap timestamps",
    body: "Big targets, high contrast, one thumb. The screen stays dark because your eyes are adjusted and you need them that way.",
  },
  {
    icon: Camera,
    title: "Photo capture with compression",
    body: "Resized on the phone before it ever leaves. Forty photos from a basement garage still go up.",
  },
  {
    icon: Mic,
    title: "Voice-to-note dictation",
    body: "Say it while you keep walking. It lands as text, at the minute you started talking.",
  },
  {
    icon: ClipboardList,
    title: "Site-specific templates",
    body: "A hotel cares about the loading dock and the pool gate. A school district cares about the perimeter fence at 3pm. Different forms.",
  },
  {
    icon: BellRing,
    title: "Delivery tracking and bounce alerts",
    body: "Every recipient, every send, with the state it ended in. This is the part you will quote at renewal.",
  },
  {
    icon: Receipt,
    title: "Proof-of-submission receipts",
    body: "The guard gets their own copy showing what went out and to whom. Nobody has to take anybody\u2019s word for it.",
  },
] as const;

// --- 7. Security & privacy ----------------------------------------------------
const SECURITY = [
  { icon: Lock, label: "Encrypted storage" },
  { icon: Mail, label: "Signed, expiring links" },
  { icon: ScrollText, label: "Immutable audit log" },
  { icon: Building2, label: "Per-company data isolation" },
] as const;

function Section({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`border-t border-border px-6 py-16 sm:py-20 ${className ?? ""}`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2
            id={`${id}-heading`}
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {title}
          </h2>
          {lead ? <p className="text-text-muted">{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      {/* First focusable element on the page. Without it a keyboard user tabs
          through the whole nav and hero to reach the contact form. */}
      <a
        href="#contact"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to contact
      </a>

      <header className="px-6 py-5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost">
              <Link href="#pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* --- 1. Hero ---------------------------------------------------- */}
        <section className="px-6 pt-8 pb-16 sm:pt-12 sm:pb-24">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Prove the shift happened.
              </h1>
              <p className="max-w-xl text-lg text-pretty text-text-muted">
                Guards log the night one tap at a time, on a phone, in the dark, with or
                without signal. At clock-out it becomes one PDF your client can actually
                open, sent to everyone who needs it. You get told whether it landed.
              </p>
              <p className="max-w-xl text-pretty text-text-muted">
                That last part is the whole product. Most reporting tools stop at
                &ldquo;sent&rdquo;.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/sign-up">Start {TRIAL_DAYS} days free</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/sample-report" target="_blank" rel="noopener">
                    See a sample report
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <TimelineMock />
            </div>
          </div>
        </section>

        {/* --- 2. The 4 AM problem ---------------------------------------- */}
        <Section
          id="problem"
          title="Three ways a good shift becomes a bad record"
          lead="None of these are failures of effort. They are failures of paperwork, which is the part nobody was hired to be good at."
        >
          <ul className="grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((problem) => (
              <li key={problem.title}>
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-2 py-6">
                    <h3 className="font-medium text-accent">{problem.title}</h3>
                    <p className="text-sm text-text-muted">{problem.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* --- 2b. Two buyers --------------------------------------------- */}
        <Section
          id="audiences"
          title="Two people care about that record"
          lead="Only one of them pays. You are being judged on the work, and your client is trying to find out whether it happened. We sell to you, because you are the one who has to prove it."
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {AUDIENCES.map((audience) => (
              <li key={audience.title}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 py-6">
                    <h3 className="font-medium text-accent">{audience.title}</h3>
                    <p className="text-sm text-text-muted">{audience.who}</p>
                    <p className="text-sm text-text-muted">{audience.body}</p>
                    <p className="mt-auto pt-2 text-sm font-medium">
                      <Link
                        href={audience.href}
                        className="underline underline-offset-4"
                      >
                        {audience.cta}
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* --- 3. How it works -------------------------------------------- */}
        <Section
          id="how"
          title="How it works"
          lead="A shift is a loop, not a checklist. It ends where the next one starts, and the record it leaves behind is the only part that outlasts the night."
        >
          <ShiftLoop />
        </Section>

        {/* --- 4. Feature grid -------------------------------------------- */}
        <Section id="features" title="What it does">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <Card className="h-full">
                  <CardHeader className="gap-3">
                    <feature.icon className="size-5 text-accent" aria-hidden="true" />
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-muted">{feature.body}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        {/* --- 5. Sites differ -------------------------------------------- */}
        <Section
          id="sites"
          title="Built for how sites actually differ"
          lead="A hotel emails four people every morning. A school two miles away files nothing and hands off verbally at 6am. Same company, same rotation, different rules, so the rules live on the site rather than in the app. Which also means a district can set one standard and have three different vendors meet it."
        >
          <SiteConfigMock />
        </Section>

        {/* --- 6. Operations ---------------------------------------------- */}
        <Section
          id="operations"
          title="The 7am question"
          lead="Whether you run the guards or hired them, the morning question is the same: did every site report, and did it land? An operations manager sees their own sites. A facilities director sees every vendor covering theirs."
        >
          <DashboardMock />
        </Section>

        {/* --- 7. Security strip ------------------------------------------ */}
        <Section id="security" title="Security & privacy">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4"
              >
                <item.icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium">{item.label}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* --- 8. Pricing -------------------------------------------------- */}
        <Section
          id="pricing"
          title="Priced per site, not per guard"
          lead="One line, four steps, sold to the company doing the guarding. Start on thirty days free with no card. The two top tiers are partly sold on work that is not built yet, and the cards say exactly which parts those are."
        >
          <div className="flex flex-col gap-16">
            <PlanLine headingLevel="h3" />
          </div>
          <div className="flex flex-col gap-4 border-t border-border pt-8">
            <h3 className="text-lg font-medium">What no plan will ever withhold</h3>
            <p className="max-w-3xl text-text-muted">
              If a card expires on the night a building floods, the flood still gets
              logged, the photos still upload, the report still generates and it still
              sends. We chase the bill in the app, loudly. Billing status is never part
              of a legal record.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ALWAYS_INCLUDED.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-text-muted">
                  <Minus
                    className="mt-0.5 size-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-sm">
              <Link href="/pricing" className="underline underline-offset-4">
                The longer version: what we will never put behind a plan, and what
                happens to your data if you leave
              </Link>
            </p>
          </div>
        </Section>

        {/* --- 9. Contact -------------------------------------------------- */}
        <Section
          id="contact"
          title="Tell us what you cover"
          lead="The fastest answer comes from telling us the shape of the work: how many sites you cover, how many sit dark in a given month, and what your clients ask for at renewal. No deck, no discovery call before a straight answer on price."
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="flex flex-col gap-3 text-sm text-text-muted">
              <li className="flex gap-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                {`From $${STARTING_FROM.price} an ${STARTING_FROM.unit} a month, unlimited guards on it. Thirty days free before that, no card.`}
              </li>
              <li className="flex gap-2">
                <Mail
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Unlimited report recipients. They never need an account.
              </li>
              <li className="flex gap-2">
                <ScrollText
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Your reports and photos stay yours. Export any time, including after you
                cancel.
              </li>
            </ul>
            <ContactForm />
          </div>
        </Section>
      </main>

      {/* --- 9. Footer ---------------------------------------------------- */}
      <SiteFooter width="wide" status omit={["/"]} />
    </>
  );
}

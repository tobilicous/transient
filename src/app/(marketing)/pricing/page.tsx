import type { Metadata } from "next";
import Link from "next/link";
import { Minus } from "lucide-react";

import { Logo } from "@/components/brand";
import { PlanLine } from "@/components/marketing/pricing-plans";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { ALWAYS_INCLUDED, TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing — Transient",
  description:
    "One line, four steps, sold to guard companies. Priced per active site with unlimited guards on it. Thirty days free, no card.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-static";

/**
 * The plan line and the rules around it, on one static page.
 *
 * No toggle and no tabs. Both would need client JavaScript and would hide
 * part of the page from search and from anyone who lands here from a link in
 * a proposal, which is a real entry path: a buyer forwards this to whoever
 * signs. Every number comes from `PLANS`, so this page cannot drift from what
 * the app actually enforces.
 */

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-surface text-text">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" aria-label="Transient home">
          <Logo />
        </Link>
        <Button asChild variant="secondary">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-24">
        <section className="flex flex-col gap-4 pt-6 pb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Priced per site, not per guard
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-text-muted">
            One line, four steps, sold to the company doing the guarding. Start free
            for {TRIAL_DAYS} days with no card. Two of the tiers are partly sold on
            work we have not built yet, and every one of those lines says so on the
            card rather than in a footnote.
          </p>
        </section>

        <div className="border-t border-border pt-12 pb-16 first:border-t-0">
          <PlanLine />
        </div>

        <section
          aria-labelledby="overlap-heading"
          className="flex flex-col gap-3 border-t border-border pt-12"
        >
          <h2 id="overlap-heading" className="text-2xl font-semibold tracking-tight">
            Why sell to the guard company and not the building?
          </h2>
          <p className="max-w-3xl text-pretty text-text-muted">
            Because you are the one who has to prove it. Every other tool in this
            category is sold to the property owner as a way of watching their vendors,
            which makes the vendor the problem to be solved and gives them every
            reason to do the minimum. Here the vendor is the customer, and the record
            is the thing you sell with at renewal.
          </p>
          <p className="max-w-3xl text-pretty text-text-muted">
            Your client never pays us and never needs an account. They get the PDF,
            every morning, with a content hash on it. If they want to come looking
            through history themselves you can invite them, on any plan, at no cost.
          </p>
        </section>

        <section
          aria-labelledby="never-heading"
          className="mt-16 flex flex-col gap-6 border-t border-border pt-12"
        >
          <div className="flex flex-col gap-3">
            <h2 id="never-heading" className="text-2xl font-semibold tracking-tight">
              Never gated, on any plan, including a lapsed one
            </h2>
            <p className="max-w-3xl text-pretty text-text-muted">
              If a card expires on the night a building floods, the flood still gets
              logged, the photos still upload, the report still generates and it still
              sends. We will chase the bill in the app, loudly. We will not make billing
              status part of a legal record.
            </p>
            <p className="max-w-3xl text-pretty text-text-muted">
              Plainly:{" "}
              <em>
                the pricing system must never be the reason the record is incomplete.
              </em>
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ALWAYS_INCLUDED.map((line) => (
              <li key={line} className="flex gap-2 text-sm">
                <Minus
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 flex flex-col gap-5 border-t border-border pt-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Three things people ask first
          </h2>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">
                Does our client have to pay before we can report to them?
              </h3>
              <p className="max-w-3xl text-sm text-pretty text-text-muted">
                No. Reports go to them as email with a PDF attached, and that costs
                them nothing on any plan. If they want a login to go looking through
                history themselves, you can invite them, also at no cost. We bill you
                per active site and nobody else.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">Do report recipients need an account?</h3>
              <p className="max-w-3xl text-sm text-pretty text-text-muted">
                Never, on any plan. A report arrives as email with a PDF. The portal is
                for people who want to go looking through history themselves rather than
                dig through an inbox.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">What happens to our data if we leave?</h3>
              <p className="max-w-3xl text-sm text-pretty text-text-muted">
                You export it, including after you cancel. Reports are PDFs with a
                content hash printed on them, so they stay verifiable somewhere else
                without us. Holding a company&rsquo;s own evidence hostage is a business
                model we are not interested in.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter width="page" omit={["/pricing"]} />
    </div>
  );
}

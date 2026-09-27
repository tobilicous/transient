import Link from "next/link";
import { Check, Clock, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ENTITLEMENT_LABELS,
  type Entitlement,
  type Plan,
  PLANS,
  planBelow,
  RECOMMENDED,
  TRIAL_DAYS,
} from "@/lib/billing/plans";

/**
 * The pricing block, rendered identically on the landing page and on
 * `/pricing`.
 *
 * It lives here rather than in either page because the two used to disagree:
 * the landing page quoted "from $N" in hand-written copy while `/pricing`
 * rendered the real cards, so a price change had to be made twice and the
 * cheaper of the two numbers was whichever page you happened to land on.
 * Everything below reads `PLANS`, so the marketing surface cannot quote a
 * price the app does not charge.
 *
 * Server-rendered, no client JavaScript. A monthly/annual toggle is the
 * obvious next thing to add and is deliberately absent: we bill one way, and
 * a toggle with one setting is a control that lies about having a choice.
 * There used to be a second set of cards for the organizations that hire
 * guard companies. Same reasoning: one buyer, so one line.
 */

export const PLAN_LINE = {
  id: "for-guard-companies",
  heading: "For guard companies",
  who: "You cover other people's buildings, and you are being judged at renewal.",
  lead: "Charging per guard would mean charging you more every time you cover a shift, which is a good way to end up with one login shared across a crew. A shared login wrecks attribution, and attribution is what your client is actually buying. So we bill the site.",
  meter:
    "A site counts for a month if at least one shift was clocked in on it. Seasonal work and event sites cost nothing in the months they sit dark, down to a one-site minimum on the account.",
};

/**
 * One plan, as a card.
 *
 * `includes` and `planned` are rendered by two different blocks on purpose.
 * They carry different icons, different headings and different words, so a
 * buyer skimming the card cannot read something we have not built as
 * something they are about to get. The word "Planned" is in the text rather
 * than only in the icon, because an icon is not readable to a screen reader
 * user or to anyone who does not already know what a clock means here.
 */
export function PlanCard({ plan }: { plan: Plan }) {
  const free = plan.pricePerUnitMonth === 0;
  const recommended = RECOMMENDED === plan.id;
  const below = planBelow(plan);
  return (
    <Card
      data-plan={plan.id}
      className={`flex h-full flex-col ${
        recommended ? "border-primary ring-1 ring-primary/25" : ""
      }`}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{plan.name}</CardTitle>
          {recommended ? (
            <span className="rounded-[var(--radius-control)] bg-primary px-2 py-0.5 text-xs font-medium text-on-primary">
              Start here
            </span>
          ) : null}
        </div>
        <p className="flex items-baseline gap-1">
          {free ? (
            <>
              <span className="text-3xl font-semibold">Free</span>
              <span className="text-sm text-text-muted">
                for {plan.trialDays ?? TRIAL_DAYS} days
              </span>
            </>
          ) : (
            <>
              <span className="text-3xl font-semibold tabular-nums">
                ${plan.pricePerUnitMonth}
              </span>
              <span className="text-sm text-text-muted">/ {plan.unit} / month</span>
            </>
          )}
        </p>
        <p className="text-sm text-text-muted">
          {free
            ? "No card to start"
            : plan.minUnits === 1
              ? `From one ${plan.unit}`
              : `${plan.minUnits} ${plan.unit} minimum`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-text-muted">{plan.fit}</p>
        <div className="pt-1">
          <Button
            asChild
            variant={recommended ? "primary" : "secondary"}
            className="w-full"
          >
            <Link href={`/sign-up?plan=${plan.id}`}>Start {TRIAL_DAYS} days free</Link>
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {below ? (
            <li className="flex gap-2 text-sm">
              <Check
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="text-text-muted">
                Everything in {below.name}
              </span>
            </li>
          ) : null}
          {plan.includes.map((line) => (
            <li key={line} className="flex gap-2 text-sm">
              <Check
                className="mt-0.5 size-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="text-text-muted">{line}</span>
            </li>
          ))}
        </ul>
        {plan.planned.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium">
              Planned, not built yet
            </p>
            <ul className="flex flex-col gap-2">
              {plan.planned.map((line) => (
                <li key={line} className="flex gap-2 text-sm">
                  <Clock
                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                  <span className="text-text-muted">
                    <span className="sr-only">Planned: </span>
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Every capability the plans actually differ on, in plan order.
 *
 * Derived from the plans rather than hand-listed, so a capability added to a
 * plan shows up in the table without anyone remembering to add a row, and a
 * capability every plan shares is left out instead of rendering a row of
 * identical ticks that tells a buyer nothing.
 *
 * Only reads `entitlements`, never `planned`, so the table can only ever
 * describe things the app enforces.
 */
function comparisonRows(plans: readonly Plan[]): Entitlement[] {
  const seen: Entitlement[] = [];
  for (const plan of plans) {
    for (const entitlement of plan.entitlements) {
      if (!seen.includes(entitlement)) seen.push(entitlement);
    }
  }
  return seen.filter((e) => !plans.every((p) => p.entitlements.includes(e)));
}

export function PlanComparison() {
  const plans = PLANS;
  const rows = comparisonRows(plans);
  const unit = plans[0].unit;
  const caption = "Plan comparison for guard companies";
  return (
    // The comparison table is wider than a phone, so this scrolls sideways.
    // A bare overflow div is unreachable without a mouse: the region needs to
    // be focusable and named, or a keyboard user simply cannot see the columns
    // that are off-screen.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-2/5 py-3 pr-4 text-left font-medium">
              <span className="text-text-muted">Per {unit}</span>
            </th>
            {plans.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className="px-3 py-3 text-center font-medium"
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-text-muted">
              Monthly price
            </th>
            {plans.map((plan) => (
              <td key={plan.id} className="px-3 py-3 text-center tabular-nums">
                {plan.pricePerUnitMonth === 0
                  ? "Free"
                  : `$${plan.pricePerUnitMonth}`}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-text-muted">
              Report history
            </th>
            {plans.map((plan) => (
              <td key={plan.id} className="px-3 py-3 text-center tabular-nums">
                {plan.retentionMonths >= 24
                  ? `${plan.retentionMonths / 12} years`
                  : `${plan.retentionMonths} months`}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-text-muted">
              Guards on a site
            </th>
            {plans.map((plan) => (
              <td key={plan.id} className="px-3 py-3 text-center">
                Unlimited
              </td>
            ))}
          </tr>
          {rows.map((entitlement) => (
            <tr key={entitlement} className="border-b border-border">
              <th
                scope="row"
                className="py-3 pr-4 text-left font-normal text-text-muted"
              >
                {ENTITLEMENT_LABELS[entitlement]}
              </th>
              {plans.map((plan) => {
                const has = plan.entitlements.includes(entitlement);
                return (
                  <td key={plan.id} className="px-3 py-3 text-center">
                    {has ? (
                      <Check
                        className="mx-auto size-4 text-accent"
                        aria-label="Included"
                      />
                    ) : (
                      <Minus
                        className="mx-auto size-4 text-text-muted"
                        aria-label="Not included"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The whole pitch: why this meter, the cards, then the table. */
export function PlanLine({
  headingLevel = "h2",
}: {
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const line = PLAN_LINE;
  return (
    <section
      id={line.id}
      aria-labelledby={`${line.id}-heading`}
      className="flex scroll-mt-6 flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <Heading
          id={`${line.id}-heading`}
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {line.heading}
        </Heading>
        <p className="font-medium">{line.who}</p>
        <p className="max-w-3xl text-pretty text-text-muted">{line.lead}</p>
        <p className="max-w-3xl text-sm text-pretty text-text-muted">{line.meter}</p>
      </div>
      <ul
        className={
          PLANS.length >= 4
            ? "grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            : "grid gap-4 md:grid-cols-3"
        }
      >
        {PLANS.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} />
          </li>
        ))}
      </ul>
      <PlanComparison />
    </section>
  );
}

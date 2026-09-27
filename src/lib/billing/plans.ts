/**
 * Plans for contract guard companies, and the rules about what a plan may
 * never withhold.
 *
 * ## Who buys this
 *
 * Contractors. Guard companies who cover other people's buildings, mostly
 * hotels, and who are judged at renewal on whether they can show the work was
 * done. They are the buyer even when the hotel is the one who feels the pain,
 * because the contractor is the one holding the reporting obligation.
 *
 * There used to be a second line here, sold to the organizations that hire
 * those contractors, priced per covered property. It is gone. One buyer, one
 * meter, one page.
 *
 * ## The meter: active site-month
 *
 * Every obvious competitor prices per guard, which is wrong here specifically.
 * Guard rotations turn over constantly and a per-seat bill is a standing
 * incentive to share one login across a crew. A shared login destroys
 * attribution, and attribution is the entire thing a hotel is paying for when
 * it asks who walked the dock at 02:40. Per-guard pricing would charge for the
 * audit trail while paying operators to corrupt it.
 *
 * So: per active site, unlimited guards on it. A site is active in a month if
 * at least one shift was clocked in against it. A dark site is not billed,
 * which makes seasonal and event work honest rather than something to hide by
 * deleting the site.
 *
 * Officer Reports is the public precedent that a per-site meter sells in this
 * category at all (per-site, unlimited officers, monthly, no contract), at
 * roughly $40/site/mo mobile and $60-70/site/mo static. Those anchor the line
 * below. See ASSUMPTIONS.md for what is anchored and what is a guess.
 *
 * ## `includes` is what exists. `planned` is what does not.
 *
 * Two tiers here are sold partly on work that is not built yet. That is a
 * normal thing to sell and a dangerous thing to describe, so the two live in
 * separate fields and render differently, and a test asserts no string appears
 * in both. A buyer reading the page can tell which is which without reading
 * our roadmap, and nobody can promote a planned line to a delivered one by
 * editing copy alone.
 *
 * The same rule decides entitlements: a plan is only granted an `Entitlement`
 * when code actually implements it. Granting one for an unbuilt feature would
 * make the type system agree with the marketing page and both be wrong.
 *
 * ## What no plan may withhold
 *
 * The rule that decided every row of `ALWAYS_INCLUDED`:
 *
 *   The pricing system must never be the reason the record is incomplete.
 *
 * A guard on a lapsed subscription still clocks in, still logs, still captures
 * an incident with photos, and the report still generates and still sends. If
 * money is owed we restrict who can pull history out, and we say so loudly in
 * the app. We do not quietly drop the night a building actually burned.
 * Anything else makes billing state a variable in a legal record, and "their
 * card expired" is not a defensible answer to why February is missing.
 */

export type PlanId = "pilot" | "report" | "response" | "portfolio";

/**
 * A capability the app actually gates.
 *
 * The union is short on purpose. An `Entitlement` exists here only when code
 * somewhere reads it, so the type cannot be used to imply a feature we have
 * not written. Things we intend to build live in a plan's `planned` list,
 * which is prose and gates nothing.
 */
export type Entitlement = "push_alerts" | "audit_export";

/** How an entitlement is described to a buyer. */
export const ENTITLEMENT_LABELS: Record<Entitlement, string> = {
  push_alerts: "Urgent alerts to supervisors on a high-severity incident",
  audit_export: "Bulk export of the audit log",
};

export type Plan = {
  id: PlanId;
  name: string;
  /** USD per active site per month. Zero only for the time-boxed trial. */
  pricePerUnitMonth: number;
  /** What one billable unit is. One meter, so one value. */
  unit: "active site";
  /** Smallest number of sites this plan can be bought for. */
  minUnits: number;
  /** Set when the plan expires rather than renewing. Null means ongoing. */
  trialDays: number | null;
  /** One line on who this is actually for. */
  fit: string;
  /** How long a completed report stays retrievable in the product. */
  retentionMonths: number;
  /** Shipped. Every line here is something the product does today. */
  includes: readonly string[];
  /**
   * Sold but not built.
   *
   * Separate from `includes` so the two can never be rendered the same way by
   * accident, and so a test can assert nothing appears in both lists.
   */
  planned: readonly string[];
  /** Capabilities this plan unlocks, checked by `hasEntitlement`. */
  entitlements: readonly Entitlement[];
};

/**
 * The plan the page leads with.
 *
 * Deliberately *not* labelled "most popular". Nobody has bought anything yet,
 * so a popularity claim would be fabricated social proof on the one page a
 * buyer is most likely to check us on. A recommendation is ours to make and
 * true by construction, so the badge says that instead.
 *
 * Report, not a higher tier: it is the cheapest plan that replaces the thing
 * these companies do today, which is notes in a phone and a PDF typed up
 * afterwards. Pointing a first-time buyer at a tier sold mostly on unbuilt
 * work would be pointing them at the part we cannot yet deliver.
 *
 * Typed as `PlanId`, so deleting or renaming a plan breaks the build rather
 * than silently un-highlighting the line.
 */
export const RECOMMENDED: PlanId = "report";

/**
 * Never gated, on any plan, including a lapsed one.
 *
 * Not decoration: a test asserts every one of these stays reachable while
 * `hasEntitlement` returns false for everything, so an entitlement that tried
 * to fence off one of these concepts fails the suite rather than quietly
 * shipping a paywall in front of an incident report.
 */
export const ALWAYS_INCLUDED = [
  "Clocking in and out, including the site's blind-spot checks",
  "Every kind of entry: notes, photos, patrols, packages, property checks",
  "Incident capture with photos, at any severity",
  "Logging with no signal, syncing when there is some",
  "Report generation at end of shift",
  "Email delivery, and the delivery receipt that comes back",
  "The content hash printed on every report",
  "Inviting a vendor, or being invited as one",
  "Twelve months of incident evidence, on every plan",
  "Exporting your own data, at any time, including after you cancel",
] as const;

/** Retention floor that applies even when a subscription has lapsed. */
export const EVIDENCE_FLOOR_MONTHS = 12;

/** How long the free plan runs before it has to become a paid one. */
export const TRIAL_DAYS = 30;

/**
 * One line, four steps, cheapest first.
 *
 * Each tier says "everything in the one below" rather than restating it, so
 * `includes` holds only what that tier adds. The card renders the carry-over
 * line itself from the previous plan's name, which means reordering this array
 * cannot leave a stale "everything in X" string behind.
 */
export const PLANS: readonly Plan[] = [
  {
    id: "pilot",
    name: "Pilot",
    pricePerUnitMonth: 0,
    unit: "active site",
    minUnits: 1,
    trialDays: TRIAL_DAYS,
    fit: "A hotel testing the workflow",
    retentionMonths: 12,
    includes: [
      "One site, unlimited guards",
      "Incident and photo logging",
      "Shift reports",
      "Email delivery, and the delivery status that comes back",
      "Assisted setup",
      "A review of reporting time and manager feedback at the end",
    ],
    planned: [],
    entitlements: [],
  },
  {
    id: "report",
    name: "Report",
    pricePerUnitMonth: 59,
    unit: "active site",
    minUnits: 1,
    trialDays: null,
    fit: "A hotel replacing manual notes and PDFs",
    retentionMonths: 12,
    includes: [
      "Unlimited shifts, incidents, guards and routine report recipients",
      "Site-specific checklists",
      "Report history",
      "Monthly cancellation",
    ],
    planned: [],
    entitlements: [],
  },
  {
    id: "response",
    name: "Response",
    pricePerUnitMonth: 99,
    unit: "active site",
    minUnits: 1,
    trialDays: null,
    fit: "Teams that need managers to act on incidents",
    retentionMonths: 12,
    includes: ["Urgent incident alerts to the supervisors on that site"],
    planned: [
      "Manager acknowledgment on an alert",
      "Requests back to the guard for missing details",
      "Configurable hotel report templates",
      "A dashboard of incidents awaiting review",
    ],
    entitlements: ["push_alerts"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    pricePerUnitMonth: 149,
    unit: "active site",
    minUnits: 1,
    trialDays: null,
    fit: "Guard companies or hotel groups managing several properties",
    retentionMonths: 12,
    includes: ["Bulk export of the audit log"],
    planned: [
      "One dashboard across properties",
      "Property-level access for each manager",
      "Standardized reports across the portfolio",
      "Reporting performance by site",
      "Coverage and delivery export for contract reviews",
    ],
    entitlements: ["push_alerts", "audit_export"],
  },
];

/** The plan directly below `plan` in the line, or null for the cheapest. */
export function planBelow(plan: Plan): Plan | null {
  const index = PLANS.findIndex((candidate) => candidate.id === plan.id);
  return index > 0 ? PLANS[index - 1] : null;
}

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) {
    // Unreachable through `PlanId`, but reachable from a stored string that
    // predates a rename. Throwing beats returning a wrong price.
    throw new Error(`Unknown plan: ${id}`);
  }
  return plan;
}

export function isPlanId(value: string): value is PlanId {
  return PLANS.some((plan) => plan.id === value);
}

/**
 * The cheapest number we can honestly put next to the word "from".
 *
 * Skips free plans. A trial that ends in thirty days is not a price, and
 * "from $0" on the landing page would be true of the sentence and false of
 * the offer.
 */
export function startingPrice(): { price: number; unit: string } {
  const paid = PLANS.filter((plan) => plan.pricePerUnitMonth > 0);
  const cheapest = paid.reduce((low, plan) =>
    plan.pricePerUnitMonth < low.pricePerUnitMonth ? plan : low,
  );
  return { price: cheapest.pricePerUnitMonth, unit: cheapest.unit };
}

/**
 * Whether a company on `plan` may use `want`.
 *
 * Fails closed on no plan at all, which is also what a lapsed or unrecognized
 * subscription resolves to. Everything in `ALWAYS_INCLUDED` is deliberately
 * not an entitlement, so this returning false can never take away the ability
 * to record or send the night's work.
 */
export function hasEntitlement(plan: PlanId | null, want: Entitlement): boolean {
  if (!plan) return false;
  return planById(plan).entitlements.includes(want);
}

/**
 * The cheapest plan that grants `want`, or null if nothing does.
 *
 * Exists so an error message can name the plan a buyer needs without
 * hardcoding it. The previous hardcoded string outlived the plan it named by
 * a whole rename, and told people to buy something that no longer existed.
 */
export function cheapestPlanWith(want: Entitlement): Plan | null {
  const granting = PLANS.filter((plan) => plan.entitlements.includes(want));
  if (granting.length === 0) return null;
  return granting.reduce((low, plan) =>
    plan.pricePerUnitMonth < low.pricePerUnitMonth ? plan : low,
  );
}

/** What `units` sites cost per month on this plan. */
export function monthlyTotal(plan: Plan, units: number): number {
  return plan.pricePerUnitMonth * Math.max(units, plan.minUnits);
}

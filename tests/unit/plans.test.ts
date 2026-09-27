import { describe, expect, it } from "vitest";

import {
  ALWAYS_INCLUDED,
  ENTITLEMENT_LABELS,
  EVIDENCE_FLOOR_MONTHS,
  PLANS,
  RECOMMENDED,
  TRIAL_DAYS,
  type Entitlement,
  cheapestPlanWith,
  hasEntitlement,
  monthlyTotal,
  planBelow,
  planById,
  startingPrice,
} from "@/lib/billing/plans";

const EVERY_ENTITLEMENT: Entitlement[] = ["push_alerts", "audit_export"];

/**
 * These are not "does the object have the right keys" tests. Each pins a
 * decision that is cheap to reverse by accident and expensive to discover in
 * production or, worse, in a deposition.
 */
describe("plans", () => {
  it("never gates anything on the recording path", () => {
    // With no subscription at all, every entitlement is false -- and none of
    // them corresponds to an act of recording. If somebody later adds
    // `Entitlement = "incident_capture"`, this test is the thing they have to
    // deliberately delete in order to ship it.
    for (const want of EVERY_ENTITLEMENT) {
      expect(hasEntitlement(null, want)).toBe(false);
    }

    const promised = ALWAYS_INCLUDED.join(" ").toLowerCase();
    expect(promised).toContain("clocking in");
    expect(promised).toContain("incident capture");
    expect(promised).toContain("email delivery");
  });

  it("never charges to invite a vendor", () => {
    // Strategic and ethical at once: the client a guard company invites is
    // the person the whole record exists to convince, and every invited
    // vendor is an operator now using Transient nightly. Charging for it
    // would be putting a turnstile on our own funnel.
    expect(ALWAYS_INCLUDED.join(" ").toLowerCase()).toContain("inviting a vendor");
    for (const e of EVERY_ENTITLEMENT) {
      expect(e).not.toMatch(/invite/);
    }
  });

  it("sells one line, on one meter", () => {
    // There used to be a second line priced per covered property, sold to the
    // organisations that hire guard companies. It is gone, and this is the
    // test that fails if half of it grows back: two meters on one page is the
    // state where a buyer cannot tell which number applies to them.
    expect(PLANS.length).toBeGreaterThan(0);
    for (const plan of PLANS) expect(plan.unit).toBe("active site");
  });

  it("holds every plan at or above the evidence retention floor", () => {
    for (const plan of PLANS) {
      expect(plan.retentionMonths).toBeGreaterThanOrEqual(EVIDENCE_FLOOR_MONTHS);
    }
  });

  it("orders the line so each plan is a superset of the last", () => {
    // Catches the packaging mistake where a mid tier quietly loses something
    // the cheaper tier had. Customers notice immediately and trust does not
    // come back.
    for (let i = 1; i < PLANS.length; i += 1) {
      const lower = new Set(PLANS[i - 1]!.entitlements);
      const higher = new Set(PLANS[i]!.entitlements);
      for (const e of lower) expect(higher.has(e)).toBe(true);
      expect(PLANS[i]!.retentionMonths).toBeGreaterThanOrEqual(
        PLANS[i - 1]!.retentionMonths,
      );
      expect(PLANS[i]!.pricePerUnitMonth).toBeGreaterThan(
        PLANS[i - 1]!.pricePerUnitMonth,
      );
    }
  });

  it("points each tier at the real plan below it", () => {
    // The card renders "Everything in X" from this rather than from a string
    // somebody typed, so reordering the line cannot leave a card promising
    // everything in a plan that is now above it.
    expect(planBelow(planById("pilot"))).toBeNull();
    expect(planBelow(planById("report"))?.id).toBe("pilot");
    expect(planBelow(planById("response"))?.id).toBe("report");
    expect(planBelow(planById("portfolio"))?.id).toBe("response");
  });

  it("quotes a real number for every tier", () => {
    // No "contact us" tier. A guard company with eleven sites should not have
    // to sit through a discovery call to find out what eleven sites cost.
    for (const plan of PLANS) {
      expect(typeof plan.pricePerUnitMonth, `${plan.id}`).toBe("number");
      expect(monthlyTotal(plan, 4)).toBe(plan.pricePerUnitMonth * 4);
    }
    expect(monthlyTotal(planById("report"), 10)).toBe(590);
    expect(monthlyTotal(planById("portfolio"), 3)).toBe(447);
  });

  it("bills at least the plan minimum", () => {
    // A month where every site sat dark still bills the account floor. Worth
    // pinning because the meter copy leans hard on dark sites being free, and
    // the floor is the one place that is not literally true.
    for (const plan of PLANS) {
      expect(monthlyTotal(plan, 0)).toBe(plan.pricePerUnitMonth * plan.minUnits);
    }
  });

  it("has exactly one free plan, and it is the time-boxed trial", () => {
    // The rule is not "no free tier", it is that nothing holds a legal record
    // for free indefinitely. A $0 plan that renewed forever would end exactly
    // one way: we eventually need the money back and the only leverage is the
    // evidence. A trial expires instead, which never puts a record behind a
    // card. So: at most one zero-priced plan, and it must carry an expiry.
    const free = PLANS.filter((plan) => plan.pricePerUnitMonth === 0);
    expect(free.length).toBe(1);
    expect(free[0]!.trialDays).toBe(TRIAL_DAYS);

    for (const plan of PLANS) {
      if (plan.pricePerUnitMonth > 0) {
        expect(plan.trialDays, `${plan.id} is paid but time-boxed`).toBeNull();
      }
    }
  });

  it("never quotes the free plan as a starting price", () => {
    // "From $0" would be true of the sentence and false of the offer. The
    // landing page and the contact section both render this number.
    const from = startingPrice();
    expect(from.price).toBeGreaterThan(0);
    expect(from.price).toBe(59);
    expect(from.unit).toBe("active site");
  });

  it("keeps what is built apart from what is only planned", () => {
    // The whole point of the two fields. A line may not sit in both, because
    // the card renders `includes` as a tick and `planned` as "not built yet",
    // and one string appearing in both would render as both at once.
    for (const plan of PLANS) {
      const built = new Set(plan.includes);
      for (const line of plan.planned) {
        expect(built.has(line), `${plan.id}: "${line}" is in both lists`).toBe(false);
      }
      for (const line of [...plan.includes, ...plan.planned]) {
        expect(line.trim().length, `${plan.id} has an empty line`).toBeGreaterThan(3);
      }
    }
  });

  it("grants an entitlement only where the code implements one", () => {
    // An `Entitlement` is a gate something in the app reads. Adding one for a
    // feature that does not exist yet would make the type system agree with
    // the marketing page and both be wrong, so unbuilt work goes in `planned`,
    // which gates nothing. This asserts the other direction: every entitlement
    // in the union is granted by some plan, so a gate can never be unreachable
    // for every customer at once, which is what a silent feature outage looks
    // like from the inside.
    for (const want of EVERY_ENTITLEMENT) {
      const granting = PLANS.filter((plan) => plan.entitlements.includes(want));
      expect(granting.length, `nothing grants ${want}`).toBeGreaterThan(0);
    }
  });

  it("keeps the two shipped gates on the tiers that sell them", () => {
    // Push alerts and audit export are real code paths today, not roadmap.
    // Deleting a grant here silently turns the feature off for every customer
    // on that plan, which is exactly what renaming the old plans nearly did.
    expect(hasEntitlement("pilot", "push_alerts")).toBe(false);
    expect(hasEntitlement("report", "push_alerts")).toBe(false);
    expect(hasEntitlement("response", "push_alerts")).toBe(true);
    expect(hasEntitlement("portfolio", "push_alerts")).toBe(true);

    expect(hasEntitlement("response", "audit_export")).toBe(false);
    expect(hasEntitlement("portfolio", "audit_export")).toBe(true);
  });

  it("names the plan a buyer needs without hardcoding it", () => {
    // The 402 from the audit export route used to name a plan by hand, and
    // outlived it by a rename, telling people to buy something gone.
    expect(cheapestPlanWith("audit_export")?.id).toBe("portfolio");
    expect(cheapestPlanWith("push_alerts")?.id).toBe("response");
  });

  it("names every entitlement it can render in a comparison table", () => {
    // The table is generated from each plan's entitlements, so an unlabelled
    // one renders a blank row: a capability a buyer is paying for, shown as
    // nothing. `Record<Entitlement, string>` makes tsc catch it, and this
    // catches the empty-string version tsc cannot see.
    for (const entitlement of EVERY_ENTITLEMENT) {
      const label = ENTITLEMENT_LABELS[entitlement];
      expect(label, `${entitlement} has no label`).toBeTruthy();
      expect(label.trim().length, `${entitlement} label`).toBeGreaterThan(3);
    }
  });

  it("recommends a plan that is buyable and actually delivered", () => {
    // The badge is the only plan we actively point people at. Pointing it at
    // a tier sold mostly on unbuilt work would be pointing a first-time buyer
    // at the part we cannot yet deliver.
    const plan = planById(RECOMMENDED);
    expect(plan.pricePerUnitMonth).toBeGreaterThan(0);
    expect(plan.planned.length, "recommended plan sells unbuilt work").toBe(0);
    expect(plan.includes.length).toBeGreaterThan(0);
  });

  it("throws on an unknown plan instead of silently granting nothing", () => {
    // Failing closed but loudly. A typo'd plan id that quietly returned false
    // would look exactly like a downgrade to the user.
    expect(() => planById("pro" as never)).toThrow(/unknown plan/i);
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanCard } from "@/components/marketing/pricing-plans";
import { PLANS, planById } from "@/lib/billing/plans";

/**
 * Two tiers are sold partly on work that does not exist yet. That is a normal
 * thing to sell and a dangerous thing to render, because "urgent incident
 * alerts" next to a tick is a promise and next to a clock is a roadmap, and
 * the difference is one className away.
 *
 * `plans.test.ts` pins the data: `includes` and `planned` never hold the same
 * string. These pin what a buyer actually sees, which is the part the data
 * test cannot reach.
 */
describe("a plan card", () => {
  it("marks every planned line as planned, in text", () => {
    const response = planById("response");
    render(<PlanCard plan={response} />);

    // Not just styling: the word is in the accessible name, so somebody using
    // a screen reader hears the same caveat a sighted reader sees. An icon
    // alone would carry none of this.
    for (const line of response.planned) {
      const item = screen.getByText(line).closest("li");
      expect(item, `no list item for "${line}"`).not.toBeNull();
      expect(item!.textContent).toContain("Planned: ");
    }

    expect(screen.getByText(/planned, not built yet/i)).toBeTruthy();
  });

  it("never marks a shipped line as planned", () => {
    // The control for the test above, and the failure that would actually
    // cost us: if the two lists were rendered by the same block, this passes
    // nothing and the card says everything is planned.
    const response = planById("response");
    render(<PlanCard plan={response} />);

    for (const line of response.includes) {
      const item = screen.getByText(line).closest("li");
      expect(item!.textContent, `"${line}" rendered as planned`).not.toContain(
        "Planned: ",
      );
    }
  });

  it("says nothing about planning on a tier that is fully built", () => {
    const report = planById("report");
    expect(report.planned.length).toBe(0);
    render(<PlanCard plan={report} />);
    expect(screen.queryByText(/planned, not built yet/i)).toBeNull();
  });

  it("prices the trial as free for a fixed number of days, not as $0", () => {
    // "$0 / active site / month" reads as a permanent free tier, which is the
    // one thing the pricing rule says we do not sell.
    const pilot = planById("pilot");
    const { container } = render(<PlanCard plan={pilot} />);
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText(/for 30 days/i)).toBeTruthy();
    expect(container.textContent).not.toContain("$0");
  });

  it("carries the previous tier by name rather than by a typed string", () => {
    const portfolio = render(<PlanCard plan={planById("portfolio")} />);
    expect(screen.getByText("Everything in Response")).toBeTruthy();
    portfolio.unmount();

    // The cheapest plan has nothing below it, so it must not claim to include
    // anything else.
    render(<PlanCard plan={planById("pilot")} />);
    expect(screen.queryByText(/^Everything in /)).toBeNull();
  });

  it("sends every plan to sign-up carrying its own id", () => {
    // `trialPlanId()` validates this against `isPlanId`, so a card linking to
    // a renamed id silently drops the buyer onto the default plan.
    for (const plan of PLANS) {
      const { container, unmount } = render(<PlanCard plan={plan} />);
      const link = within(container).getByRole("link");
      expect(link.getAttribute("href")).toBe(`/sign-up?plan=${plan.id}`);
      unmount();
    }
  });
});

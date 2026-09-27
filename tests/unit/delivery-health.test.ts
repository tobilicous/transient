import { describe, expect, it } from "vitest";
import { summariseDeliveries } from "@/lib/reports/delivery-health";

/**
 * The grouping the company dashboard reports delivery health through.
 *
 * Worth its own test because the interesting decision is not arithmetic, it is
 * which statuses count as success. Eight provider outcomes collapse to four
 * answers, and two of those choices are ones a reader would reasonably get
 * wrong.
 */
describe("summariseDeliveries", () => {
  it("counts SENT apart from DELIVERED", () => {
    // The one that matters. SENT means the mail provider accepted the
    // message, not that the client received it. Folding it into `delivered`
    // would report a silent delivery failure as a green number.
    const health = summariseDeliveries([
      { status: "DELIVERED", count: 3 },
      { status: "SENT", count: 5 },
    ]);

    expect(health.delivered).toBe(3);
    expect(health.sent).toBe(5);
    expect(health.failed).toBe(0);
    expect(health.total).toBe(8);
  });

  it("treats a spam complaint as a failure even though it arrived", () => {
    // A client marking the nightly report as spam is a contract problem, and
    // it is the outcome nobody thinks to go looking for. Counting it as a
    // success because it technically landed is how it stays invisible.
    const health = summariseDeliveries([{ status: "COMPLAINED", count: 2 }]);

    expect(health.failed).toBe(2);
    expect(health.delivered).toBe(0);
    expect(health.failures).toEqual([{ status: "COMPLAINED", count: 2 }]);
  });

  it("groups bounced, failed and complained together and names each", () => {
    const health = summariseDeliveries([
      { status: "BOUNCED", count: 1 },
      { status: "FAILED", count: 4 },
      { status: "COMPLAINED", count: 2 },
      { status: "DELIVERED", count: 10 },
    ]);

    expect(health.failed).toBe(7);
    // Largest first, so the panel leads with the biggest problem.
    expect(health.failures.map((f) => f.status)).toEqual([
      "FAILED",
      "COMPLAINED",
      "BOUNCED",
    ]);
  });

  it("puts queued and delayed under pending, not failed", () => {
    // A queued report has not gone wrong yet. Counting it as a failure would
    // make every dashboard red for the minute between generating and sending.
    const health = summariseDeliveries([
      { status: "QUEUED", count: 2 },
      { status: "DELAYED", count: 1 },
    ]);

    expect(health.pending).toBe(3);
    expect(health.failed).toBe(0);
    expect(health.failures).toEqual([]);
  });

  it("counts UNCONFIRMED as sent rather than delivered", () => {
    const health = summariseDeliveries([{ status: "UNCONFIRMED", count: 4 }]);

    expect(health.sent).toBe(4);
    expect(health.delivered).toBe(0);
  });

  it("returns all zeroes for an empty window", () => {
    expect(summariseDeliveries([])).toEqual({
      delivered: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      total: 0,
      failures: [],
    });
  });
});

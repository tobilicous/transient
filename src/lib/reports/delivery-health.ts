import type { DeliveryStatus } from "@/generated/prisma/enums";

/**
 * Eight delivery statuses collapsed into the four answers a firm owner
 * actually acts on. Kept pure and out of the component so the grouping can be
 * asserted directly, and kept in one place so the dashboard and any later
 * client-facing view cannot disagree about what "failed" means.
 *
 * The split that matters is `delivered` versus `sent`. A provider accepting a
 * message is not the recipient receiving it, and reading SENT as success is
 * how a silent delivery failure gets reported as a green number for a month.
 * They are counted apart and labelled apart.
 *
 * COMPLAINED sits under `failed` deliberately. Technically it arrived, but a
 * client marking the nightly report as spam is a contract problem, and it is
 * the one outcome nobody would ever think to go looking for.
 */
export type DeliveryBucket = "delivered" | "sent" | "pending" | "failed";

const BUCKETS: Record<DeliveryStatus, DeliveryBucket> = {
  DELIVERED: "delivered",
  SENT: "sent",
  UNCONFIRMED: "sent",
  QUEUED: "pending",
  DELAYED: "pending",
  BOUNCED: "failed",
  FAILED: "failed",
  COMPLAINED: "failed",
};

export type DeliveryCount = { status: DeliveryStatus; count: number };

export type DeliveryHealth = {
  delivered: number;
  sent: number;
  pending: number;
  failed: number;
  total: number;
  /** Only the failing statuses, largest first, for naming the actual problem. */
  failures: DeliveryCount[];
};

export function summariseDeliveries(rows: readonly DeliveryCount[]): DeliveryHealth {
  const health: DeliveryHealth = {
    delivered: 0,
    sent: 0,
    pending: 0,
    failed: 0,
    total: 0,
    failures: [],
  };

  for (const row of rows) {
    health[BUCKETS[row.status]] += row.count;
    health.total += row.count;
    if (BUCKETS[row.status] === "failed" && row.count > 0) health.failures.push(row);
  }

  health.failures.sort((a, b) => b.count - a.count);
  return health;
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  DELIVERED: "Delivered",
  SENT: "Sent",
  UNCONFIRMED: "Unconfirmed",
  QUEUED: "Queued",
  DELAYED: "Delayed",
  BOUNCED: "Bounced",
  FAILED: "Failed",
  COMPLAINED: "Marked as spam",
};

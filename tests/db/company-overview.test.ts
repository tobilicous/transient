import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DeliveryStatus,
  EntryType,
  IncidentStatus,
  Role,
  Severity,
  ShiftStatus,
} from "@/generated/prisma/enums";
import { db, type Actor } from "@/lib/db/scoped";
import { createTenant, raw, resetDatabase } from "./helpers";

/**
 * The company dashboard's three reads, against a real Postgres.
 *
 * These are the first accessors that deliberately answer across every site at
 * once, so they are also the first that would leak a whole tenant rather than
 * a single row if the company filter were dropped. Each read is tested with a
 * second company's matching row sitting right next to it, and each block
 * starts with a control proving that row is really there and really visible to
 * an unscoped query. Without the control an assertion of "B's rows are absent"
 * passes just as happily when nothing was ever written.
 *
 * Not covered here: the `can.viewCompany` rank boundary that decides who is
 * offered the screen. `lib/auth/guards` cannot be imported under vitest in
 * either project — NextAuth's `lib/env.js` does a bare `next/server` import
 * that fails to resolve — so no test in this repo imports it. The scoping
 * below is asserted at SUPERVISOR, ADMIN and OWNER instead, which is the
 * property that actually protects a tenant; the rank check only decides which
 * screen is rendered.
 */

let a: Awaited<ReturnType<typeof createTenant>>;
let b: Awaited<ReturnType<typeof createTenant>>;

const NOW = new Date("2026-03-10T12:00:00.000Z");
const RECENT = new Date("2026-03-09T12:00:00.000Z");
const OLD = new Date("2026-02-01T12:00:00.000Z");
const WINDOW = new Date("2026-03-03T12:00:00.000Z");

/**
 * `Report` is unique on (shiftId, version) and every tenant here has exactly
 * one shift, so each report needs its own version number or the second create
 * fails on the constraint rather than on anything this test is about.
 */
let nextVersion = 1;

async function addDelivery(
  tenant: typeof a,
  status: DeliveryStatus,
  statusAt: Date,
): Promise<void> {
  const report = await raw.report.create({
    data: {
      shiftId: tenant.shift.id,
      generatedById: tenant.owner.id,
      version: nextVersion++,
      storageKey: `reports/${tenant.company.slug}-${status}-${statusAt.getTime()}.pdf`,
    },
  });
  await raw.reportDelivery.create({
    data: {
      reportId: report.id,
      email: `client@${tenant.company.slug}.test`,
      status,
      statusAt,
    },
  });
}

async function addIncident(
  tenant: typeof a,
  code: string,
  status: IncidentStatus,
): Promise<void> {
  const entry = await raw.entry.create({
    data: {
      shiftId: tenant.shift.id,
      type: EntryType.INCIDENT,
      occurredAt: RECENT,
      clientId: `${tenant.company.slug}-${code}`,
      text: `${code} body`,
    },
  });
  await raw.incident.create({
    data: {
      entryId: entry.id,
      code,
      categoryKey: "trespass",
      severity: Severity.MEDIUM,
      status,
    },
  });
}

beforeAll(async () => {
  await resetDatabase();
  a = await createTenant("alpha");
  b = await createTenant("bravo");

  // Deliveries: both companies get an identical spread, so "A sees 3" can only
  // be right if B's three were filtered out rather than simply missing.
  for (const tenant of [a, b]) {
    await addDelivery(tenant, DeliveryStatus.DELIVERED, RECENT);
    await addDelivery(tenant, DeliveryStatus.SENT, RECENT);
    await addDelivery(tenant, DeliveryStatus.BOUNCED, RECENT);
    await addDelivery(tenant, DeliveryStatus.DELIVERED, OLD);
  }

  // Incidents: one open and one resolved each.
  for (const tenant of [a, b]) {
    await addIncident(tenant, `${tenant.company.slug}-OPEN`, IncidentStatus.OPEN);
    await addIncident(
      tenant,
      `${tenant.company.slug}-DONE`,
      IncidentStatus.RESOLVED,
    );
  }

  // A second open incident for A, on the *same* shift as the first. This is
  // what tells a count of incidents apart from a count of nights that had
  // one: both are 1 with a single incident, and only a real incident count
  // reaches 2 here.
  await addIncident(a, "alpha-OPEN-2", IncidentStatus.OPEN);

  // One soft-deleted incident entry in A. A deleted log line is struck
  // through, not erased, so the row is still there to be wrongly counted.
  const deleted = await raw.entry.create({
    data: {
      shiftId: a.shift.id,
      type: EntryType.INCIDENT,
      occurredAt: RECENT,
      clientId: "alpha-deleted",
      text: "retracted",
      deletedAt: NOW,
      deleteReason: "logged against the wrong site",
    },
  });
  await raw.incident.create({
    data: {
      entryId: deleted.id,
      code: "ALPHA-DELETED",
      categoryKey: "trespass",
      severity: Severity.HIGH,
      status: IncidentStatus.OPEN,
    },
  });

  // Put A's guard on duty so the roster has something live to report.
  await raw.shift.update({
    where: { id: a.shift.id },
    data: { status: ShiftStatus.ACTIVE, clockInAt: RECENT },
  });
});

afterAll(async () => {
  await raw.$disconnect();
});

const actorFor = (tenant: typeof a, role: Role): Actor => ({
  userId: tenant.owner.id,
  companyId: tenant.company.id,
  role,
});

describe("company.deliveryHealth", () => {
  it("is set up so an unscoped read would see both companies", async () => {
    // The control. If this ever returns only A's rows the scoping assertions
    // below prove nothing, because there was never anything to filter out.
    const all = await raw.reportDelivery.count({
      where: { statusAt: { gte: WINDOW } },
    });
    expect(all).toBe(6);
    expect(a.company.id).not.toBe(b.company.id);
  });

  it("counts only the caller's own company", async () => {
    const rows = await db(actorFor(a, Role.OWNER)).company.deliveryHealth(WINDOW);
    const total = rows.reduce((sum, row) => sum + row.count, 0);

    expect(total).toBe(3);
    expect(rows.find((r) => r.status === DeliveryStatus.DELIVERED)?.count).toBe(1);
    expect(rows.find((r) => r.status === DeliveryStatus.SENT)?.count).toBe(1);
    expect(rows.find((r) => r.status === DeliveryStatus.BOUNCED)?.count).toBe(1);
  });

  it("honours the window rather than returning all history", async () => {
    const windowed = await db(actorFor(a, Role.OWNER)).company.deliveryHealth(
      WINDOW,
    );
    const everything = await db(actorFor(a, Role.OWNER)).company.deliveryHealth(
      OLD,
    );

    // The old DELIVERED row is outside the seven-day window and inside the
    // wider one. If the `since` filter were dropped both totals would be 4.
    expect(windowed.reduce((s, r) => s + r.count, 0)).toBe(3);
    expect(everything.reduce((s, r) => s + r.count, 0)).toBe(4);
  });
});

describe("company.openIncidents", () => {
  it("is set up so an unscoped read would see both companies", async () => {
    const all = await raw.incident.count({
      where: { status: { in: [IncidentStatus.OPEN, IncidentStatus.ONGOING] } },
    });
    // Two open for A plus one for B, plus A's soft-deleted one.
    expect(all).toBe(4);
  });

  it("returns only the caller's own company's open incidents", async () => {
    const rows = await db(actorFor(a, Role.OWNER)).company.openIncidents();

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.code).sort()).toEqual(["alpha-OPEN", "alpha-OPEN-2"]);
  });

  it("excludes resolved incidents", async () => {
    const rows = await db(actorFor(a, Role.OWNER)).company.openIncidents();
    expect(rows.map((r) => r.code)).not.toContain("alpha-DONE");
  });

  it("excludes incidents whose entry was retracted", async () => {
    // A struck-through log line is still a row. Counting it would show the
    // owner an open incident that the report itself says never happened.
    const rows = await db(actorFor(a, Role.OWNER)).company.openIncidents();
    expect(rows.map((r) => r.code)).not.toContain("ALPHA-DELETED");
  });

  it("carries the site name so the owner knows where to look", async () => {
    const rows = await db(actorFor(a, Role.OWNER)).company.openIncidents();
    expect(rows[0]?.entry.shift.site.name).toBe("alpha site");
  });
});

describe("site.findManyWithDuty", () => {
  it("counts unresolved incidents, not nights that had one", async () => {
    // Both of A's open incidents sit on the same shift. Counting shifts that
    // contain one — which is the shape Prisma's `_count` can express in a
    // single query, and what this did originally — reports 1 and reads as a
    // site with one problem. The table says "Open" and its caption says
    // "unresolved incidents", so 2 is the only answer that matches the label.
    const sites = await db(actorFor(a, Role.OWNER)).site.findManyWithDuty();
    const alpha = sites.find((s) => s.name === "alpha site");

    expect(alpha?.openIncidents).toBe(2);
  });

  it("does not count another company's incidents", async () => {
    const sites = await db(actorFor(a, Role.OWNER)).site.findManyWithDuty();

    expect(sites).toHaveLength(1);
    expect(sites[0]?.name).toBe("alpha site");
    // B has an open incident of its own; a leak would show up as 3 here.
    expect(sites[0]?.openIncidents).toBe(2);
  });

  it("does not count retracted incidents", async () => {
    // A's soft-deleted entry carries an OPEN incident. It is excluded from
    // the list panel, so counting it in the table would put a number beside a
    // site with nothing to show.
    const sites = await db(actorFor(a, Role.OWNER)).site.findManyWithDuty();
    const listed = await db(actorFor(a, Role.OWNER)).company.openIncidents();

    expect(sites[0]?.openIncidents).toBe(listed.length);
  });
});

describe("company.roster", () => {
  it("is set up so an unscoped read would see both companies", async () => {
    expect(await raw.user.count()).toBe(4);
  });

  it("lists only the caller's own company", async () => {
    const { members, total } = await db(actorFor(a, Role.OWNER)).company.roster();

    expect(total).toBe(2);
    expect(members.map((m) => m.email).sort()).toEqual([
      "guard@alpha.test",
      "owner@alpha.test",
    ]);
  });

  it("reports who is currently on duty", async () => {
    const { members } = await db(actorFor(a, Role.OWNER)).company.roster();
    const guard = members.find((m) => m.email === "guard@alpha.test");
    const owner = members.find((m) => m.email === "owner@alpha.test");

    expect(guard?.shifts).toHaveLength(1);
    expect(guard?.shifts[0]?.site.name).toBe("alpha site");
    expect(owner?.shifts).toHaveLength(0);
  });

  it("reports the total separately from the truncated page", async () => {
    // `total` drives "showing 1 of 2", so it has to be counted rather than
    // taken from the length of the truncated list.
    const { members, total } = await db(
      actorFor(a, Role.OWNER),
    ).company.roster(1);

    expect(members).toHaveLength(1);
    expect(total).toBe(2);
  });

  it("stays scoped at every privilege level", async () => {
    // Tenancy is not a permission, so a higher rank must not widen it.
    for (const role of [Role.SUPERVISOR, Role.ADMIN, Role.OWNER]) {
      const { members } = await db(actorFor(a, role)).company.roster();
      expect(members.every((m) => m.email.endsWith("@alpha.test"))).toBe(true);
    }
  });
});

describe("company scope narrows per read, not per role", () => {
  // The `company` doc comment claims these reads narrow differently below
  // ADMIN, because each goes through a different `visible.*` helper. That is
  // a claim about behaviour, so it is asserted here rather than left in prose.
  //
  // SUPERVISOR is not in COMPANY_WIDE, so `visible.site` narrows to sites the
  // actor is assigned to, and the fixture assigns only the guard. The same
  // supervisor therefore sees none of A's incidents while still seeing all of
  // A's staff, because `visible.user` is tenancy alone.
  it("hides incidents at unassigned sites but still lists the whole roster", async () => {
    const supervisor = actorFor(a, Role.SUPERVISOR);

    // Control: A really does have open incidents, so a later zero can only
    // mean they were filtered out rather than never created.
    const asOwner = await db(actorFor(a, Role.OWNER)).company.openIncidents();
    expect(asOwner.length).toBeGreaterThan(0);

    const asSupervisor = await db(supervisor).company.openIncidents();
    expect(asSupervisor).toHaveLength(0);

    // Same actor, same company, different helper: the roster does not narrow.
    const { members, total } = await db(supervisor).company.roster();
    expect(total).toBe(2);
    expect(members.map((m) => m.email).sort()).toEqual([
      "guard@alpha.test",
      "owner@alpha.test",
    ]);
  });
});

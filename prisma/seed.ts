import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  LoggingMode,
  RecipientStatus,
  Role,
  ShiftStatus,
  SubscriptionStatus,
} from "../src/generated/prisma/enums";

/**
 * Seed — section 20. Users, sites and configuration only.
 *
 * The sample shift with its entries, incidents, media and report belongs to
 * milestone 12: it depends on the media pipeline and the PDF renderer, neither
 * of which exists yet, and a seed that half-creates a report is worse than one
 * that does not try.
 *
 * Idempotent, as section 20 requires. Every write is an upsert keyed on a real
 * unique constraint, never on a generated id, so re-running is a no-op rather
 * than a duplicate. That is also why `code` and `email` carry `@unique` in the
 * schema — the seed leans on the same constraints the app does.
 */

import { queueSampleReport, seedSampleShift } from "./sample-shift";
import { DEFAULT_ENTRY_TYPES } from "../src/lib/sites/defaults";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Section 11's PDF layout, one entry per section, in render order. */
const REPORT_SECTIONS = [
  { key: "cover", label: "Cover summary", enabled: true },
  { key: "clockInChecks", label: "Clock-in checks", enabled: true },
  { key: "timeline", label: "Timeline", enabled: true },
  { key: "incidents", label: "Incidents detail", enabled: true },
  { key: "packages", label: "Packages", enabled: true },
  { key: "gallery", label: "Gallery link", enabled: true },
];

async function main() {
  // Meridian sits on a real plan so the billing screen, the gated push alert
  // and the audit export are all exercised by the demo rather than being
  // dead code nobody clicks. TRIALING with a future end date is also the
  // state a real new customer is in on day one, which is the state most
  // worth having a screenshot of.
  const trialEndsAt = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000);
  const subscription = {
    planId: "portfolio",
    subscriptionStatus: SubscriptionStatus.TRIALING,
    trialEndsAt,
    currentPeriodEnd: trialEndsAt,
  } as const;

  const company = await prisma.company.upsert({
    where: { slug: "meridian" },
    update: { name: "Meridian Protective Services", ...subscription },
    create: {
      name: "Meridian Protective Services",
      slug: "meridian",
      ...subscription,
    },
  });

  const users = await Promise.all(
    (
      [
        { email: "owner@meridian.test", name: "Dana Okafor", role: Role.OWNER },
        {
          email: "admin@meridian.test",
          name: "Ana Castellanos",
          role: Role.ADMIN,
        },
        {
          email: "sup.westside@meridian.test",
          name: "Marisol Rivera",
          role: Role.SUPERVISOR,
        },
        {
          email: "sup.east@meridian.test",
          name: "Noor Haddad",
          role: Role.SUPERVISOR,
        },
        {
          email: "guard.night@meridian.test",
          name: "Terrence Boyd",
          role: Role.GUARD,
        },
        {
          email: "guard.swing@meridian.test",
          name: "Priya Raman",
          role: Role.GUARD,
        },
        {
          email: "guard.depot@meridian.test",
          name: "Ike Osei",
          role: Role.GUARD,
        },
        {
          email: "guard.plaza@meridian.test",
          name: "Lena Fischer",
          role: Role.GUARD,
        },
      ] as const
    ).map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, role: u.role, companyId: company.id },
        create: { ...u, companyId: company.id },
      }),
    ),
  );

  const byEmail = new Map(users.map((u) => [u.email, u]));
  const userId = (email: string) => {
    const user = byEmail.get(email);
    if (!user) throw new Error(`seed: user ${email} was not created`);
    return user.id;
  };

  // ---- Site 1: Westside Hotel ----------------------------------------------

  const hotel = await prisma.site.upsert({
    where: { companyId_code: { companyId: company.id, code: "WH" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Westside Hotel — Sunset Strip",
      code: "WH",
      address: "8400 Sunset Boulevard, West Hollywood, CA 90069",
      timezone: "America/Los_Angeles",
      loggingMode: LoggingMode.FULL,
      footerDisclaimer:
        "This report is a contemporaneous record of observations by on-site security personnel. It is not a legal determination.",
      sendIndividually: true,
    },
  });

  await upsertAreas(hotel.id, [
    "Lobby",
    "Front entrance",
    "Pool deck",
    "Garage P1",
    "Garage P2",
    "Loading dock",
    "Rooftop bar (after hours)",
    "Stairwell A",
    "Stairwell B",
  ]);

  await upsertBlindSpots(hotel.id, [
    [
      "Garage P2 southwest corner",
      "Behind the support column, out of camera 14's arc.",
    ],
    ["Loading dock alcove", "Recessed doorway left of the roll-up door."],
    ["Stairwell A landing 3", "Landing between floors 3 and 4; no camera coverage."],
    ["Stairwell B roof door", "Alarmed door at the top of Stairwell B."],
    ["Pool equipment room", "Check the door is latched, not just closed."],
    ["Trash enclosure", "Gate on the alley side; a common overnight entry point."],
    ["East side gate", "Pedestrian gate; confirm the latch has re-seated."],
    ["Rooftop bar back hall", "Service corridor behind the bar, dark after close."],
    ["Employee entrance vestibule", "Between the two doors; badge reader side."],
  ]);

  await upsertShiftTemplates(hotel.id, [
    ["Graveyard 10 PM", "22:00", "08:00"],
    ["Graveyard 11:30 PM", "23:30", "08:00"],
    ["Swing", "15:00", "03:00"],
  ]);

  await upsertEntryTypes(hotel.id, [
    ...DEFAULT_ENTRY_TYPES,
    {
      key: "camera-room-call",
      label: "Camera room call",
      icon: "radio",
      color: "lime",
    },
  ]);

  await prisma.reportTemplate.upsert({
    where: { siteId: hotel.id },
    update: {},
    create: {
      siteId: hotel.id,
      sections: REPORT_SECTIONS,
      headerText: "Meridian Protective Services — nightly shift report",
      embedPhotos: true,
      coverPage: true,
    },
  });

  const verifiedAt = new Date("2026-01-08T17:00:00.000Z");
  await upsertRecipients(hotel.id, [
    {
      name: "Alice Nwosu",
      email: "ops@westsidehotel.test",
      roleLabel: "Ops manager",
      required: true,
      status: RecipientStatus.VERIFIED,
      verifiedAt,
    },
    {
      name: "Grant Mbeki",
      email: "security.director@westsidehotel.test",
      roleLabel: "Hotel security director",
      required: true,
      status: RecipientStatus.VERIFIED,
      verifiedAt,
    },
    {
      name: "Sofia Lindqvist",
      email: "accounts@meridian.test",
      roleLabel: "Account manager",
      required: true,
      status: RecipientStatus.VERIFIED,
      verifiedAt,
    },
    {
      // Deliberately bad so the bounce alert has something to show on a fresh
      // database. A feature whose failure state is only reachable in production
      // does not get looked at.
      name: "Rowan Alderete",
      email: "regional.lead@meridian-regional.test",
      roleLabel: "Regional lead",
      required: false,
      status: RecipientStatus.BOUNCED,
      lastBounceAt: new Date("2026-01-19T09:14:00.000Z"),
      lastBounceReason: "550 5.1.1 mailbox does not exist",
    },
  ]);

  // ---- Sites 2 and 3: the rest of the portfolio ----------------------------
  //
  // One company with one property cannot demonstrate the company view at all.
  // The question that screen answers is "which of my contracts has nobody on
  // it right now", and a single site has no answer worth reading — the panel
  // renders one row and proves nothing.
  //
  // These two are deliberately thinner than Westside. A firm's newest
  // contracts always are, and a seed where every site is equally polished
  // hides the fact that an under-configured site still has to work.

  const depot = await upsertSite({
    companyId: company.id,
    code: "RD",
    name: "Riverside Depot",
    address: "1420 East Washington Boulevard, Los Angeles, CA 90021",
    timezone: "America/Los_Angeles",
    loggingMode: LoggingMode.FULL,
    headerText: "Meridian Protective Services — depot patrol report",
    areas: [
      "Main gate",
      "Yard north",
      "Yard south",
      "Loading bays 1-6",
      "Fuel island",
      "Office trailer",
    ],
    blindSpots: [
      ["Fence line behind bay 6", "No camera arc past the last bay door."],
      ["Fuel island canopy", "Cameras see the pumps, not the shadow under it."],
      ["Container row C", "Gap between stacks; walk it, do not glass it."],
    ],
    shiftTemplates: [
      ["Overnight", "19:00", "07:00"],
      ["Day patrol", "07:00", "19:00"],
    ],
    recipients: [
      {
        name: "Devon Pryce",
        email: "operations@riversidedepot.test",
        roleLabel: "Depot manager",
        required: true,
        status: RecipientStatus.VERIFIED,
        verifiedAt,
      },
      {
        // Unverified on purpose: a site whose reports are going nowhere yet
        // is the most common real state, and the alert for it needs a row.
        name: "Hollis Vance",
        email: "nightops@riversidedepot.test",
        roleLabel: "Night operations",
        required: false,
        status: RecipientStatus.UNVERIFIED,
      },
    ],
  });

  const plaza = await upsertSite({
    companyId: company.id,
    code: "HP",
    name: "Harbor Point Plaza",
    address: "300 Oceangate, Long Beach, CA 90802",
    timezone: "America/Los_Angeles",
    loggingMode: LoggingMode.LIGHT,
    headerText: "Meridian Protective Services — plaza shift report",
    areas: [
      "Plaza level",
      "Tower lobby",
      "Parking P1",
      "Service corridor",
      "Waterfront steps",
    ],
    blindSpots: [
      ["Service corridor bend", "Blind past the second fire door."],
      ["Waterfront steps, lower landing", "Below the camera's tilt limit."],
    ],
    shiftTemplates: [
      ["Evening", "16:00", "00:00"],
      ["Overnight", "00:00", "08:00"],
    ],
    recipients: [
      {
        name: "Imani Clarke",
        email: "property@harborpointplaza.test",
        roleLabel: "Property manager",
        required: true,
        status: RecipientStatus.VERIFIED,
        verifiedAt,
      },
    ],
  });

  // ---- Assignments ---------------------------------------------------------

  const assignments: Array<[string, string]> = [
    ["sup.westside@meridian.test", hotel.id],
    ["guard.night@meridian.test", hotel.id],
    ["guard.swing@meridian.test", hotel.id],
    ["sup.east@meridian.test", depot.id],
    ["sup.east@meridian.test", plaza.id],
    ["guard.depot@meridian.test", depot.id],
    ["guard.plaza@meridian.test", plaza.id],
  ];

  for (const [email, siteId] of assignments) {
    const id = userId(email);
    await prisma.siteAssignment.upsert({
      where: { userId_siteId: { userId: id, siteId } },
      update: {},
      create: { userId: id, siteId },
    });
  }

  // OWNER and ADMIN see every site in the company by rule, not by row, so they
  // deliberately get no assignments — see `visible.site()` in lib/db/scoped.ts.

  // ---- Who is on duty right now --------------------------------------------
  //
  // Coverage is the company screen's first question, and it can only be
  // answered by shifts that are open *now*. The sample night below is finished
  // by design, so without these the answer is always "nobody, anywhere" and
  // the panel's healthy state is unreachable on a fresh database.
  //
  // Two of three sites are covered, not three. A demo where nothing is ever
  // wrong is a demo of a screen nobody needs.
  await upsertOpenShift({
    clientId: "seed-onduty-depot",
    siteId: depot.id,
    guardId: userId("guard.depot@meridian.test"),
    startedHoursAgo: 3,
    lengthHours: 12,
  });
  await upsertOpenShift({
    clientId: "seed-onduty-plaza",
    siteId: plaza.id,
    guardId: userId("guard.plaza@meridian.test"),
    startedHoursAgo: 1,
    lengthHours: 8,
  });

  // ---- The sample shift ----------------------------------------------------
  // Everything above is configuration. This is the part that makes the seeded
  // app worth opening: a finished night, a real PDF, and one bounced delivery.
  const shiftId = await seedSampleShift({
    prisma,
    siteId: hotel.id,
    companyId: company.id,
    guardId: userId("guard.night@meridian.test"),
    supervisorId: userId("sup.westside@meridian.test"),
  });

  let reportLine = "no sample shift";
  if (shiftId) {
    const state = await queueSampleReport(
      {
        prisma,
        siteId: hotel.id,
        companyId: company.id,
        guardId: userId("guard.night@meridian.test"),
        supervisorId: userId("sup.westside@meridian.test"),
      },
      shiftId,
    );
    reportLine = {
      queued: "report queued — run `pnpm jobs:sweep` with the app running",
      "send-queued": "report built; delivery queued — run `pnpm jobs:sweep` again",
      "already-built": "report built and delivered",
    }[state];
  }

  const siteCount = await prisma.site.count({ where: { companyId: company.id } });

  console.log(
    `Seeded ${company.name}: ${users.length} users, ${siteCount} ${siteCount === 1 ? "site" : "sites"}, ${assignments.length} assignments.`,
  );
  console.log(`Sample shift: ${reportLine}.`);
}

/**
 * A site plus the configuration a site is useless without. Westside is written
 * out longhand above because it is the showcase; these are the ordinary ones,
 * and three copies of the same six calls is how one of them quietly loses its
 * report template.
 *
 * Entry types come from `DEFAULT_ENTRY_TYPES` with no additions. Westside's
 * extra "camera room call" is a real per-site customisation, and having sites
 * that do not share it is what proves the customisation is per-site.
 */
async function upsertSite(input: {
  companyId: string;
  name: string;
  code: string;
  address: string;
  timezone: string;
  loggingMode: LoggingMode;
  headerText: string;
  areas: readonly string[];
  blindSpots: ReadonlyArray<readonly [string, string]>;
  shiftTemplates: ReadonlyArray<readonly [string, string, string]>;
  recipients: Parameters<typeof upsertRecipients>[1];
}) {
  const site = await prisma.site.upsert({
    where: { companyId_code: { companyId: input.companyId, code: input.code } },
    update: {},
    create: {
      companyId: input.companyId,
      name: input.name,
      code: input.code,
      address: input.address,
      timezone: input.timezone,
      loggingMode: input.loggingMode,
      footerDisclaimer:
        "This report is a contemporaneous record of observations by on-site security personnel. It is not a legal determination.",
      sendIndividually: true,
    },
  });

  await upsertAreas(site.id, input.areas);
  await upsertBlindSpots(site.id, input.blindSpots);
  await upsertShiftTemplates(site.id, input.shiftTemplates);
  await upsertEntryTypes(site.id, DEFAULT_ENTRY_TYPES);
  await prisma.reportTemplate.upsert({
    where: { siteId: site.id },
    update: {},
    create: {
      siteId: site.id,
      sections: REPORT_SECTIONS,
      headerText: input.headerText,
      embedPhotos: true,
      coverPage: true,
    },
  });
  await upsertRecipients(site.id, input.recipients);

  return site;
}

/**
 * A shift that is open right now, keyed on `clientId` like every other shift
 * so re-seeding cannot leave two guards on one post.
 *
 * The clock-in is rewritten on every run rather than left alone. A fixed
 * timestamp would drift into "on duty since three days ago", which reads as a
 * bug in the clock-out flow rather than as a live shift.
 */
async function upsertOpenShift(input: {
  clientId: string;
  siteId: string;
  guardId: string;
  startedHoursAgo: number;
  lengthHours: number;
}) {
  const clockInAt = new Date(Date.now() - input.startedHoursAgo * 60 * 60 * 1000);
  const scheduledEnd = new Date(
    clockInAt.getTime() + input.lengthHours * 60 * 60 * 1000,
  );
  return prisma.shift.upsert({
    where: { clientId: input.clientId },
    update: {
      clockInAt,
      clockOutAt: null,
      scheduledStart: clockInAt,
      scheduledEnd,
      status: ShiftStatus.ACTIVE,
    },
    create: {
      siteId: input.siteId,
      guardId: input.guardId,
      clientId: input.clientId,
      scheduledStart: clockInAt,
      scheduledEnd,
      clockInAt,
      status: ShiftStatus.ACTIVE,
    },
  });
}

async function upsertAreas(siteId: string, names: readonly string[]) {  for (const [order, name] of names.entries()) {
    const existing = await prisma.area.findFirst({ where: { siteId, name } });
    if (existing) {
      await prisma.area.update({ where: { id: existing.id }, data: { order } });
    } else {
      await prisma.area.create({ data: { siteId, name, order } });
    }
  }
}

async function upsertBlindSpots(
  siteId: string,
  spots: ReadonlyArray<readonly [string, string]>,
) {
  for (const [order, [name, description]] of spots.entries()) {
    const existing = await prisma.blindSpot.findFirst({
      where: { siteId, name },
    });
    if (existing) {
      await prisma.blindSpot.update({
        where: { id: existing.id },
        data: { description, order },
      });
    } else {
      await prisma.blindSpot.create({
        data: { siteId, name, description, order, requiredAtClockIn: true },
      });
    }
  }
}

async function upsertShiftTemplates(
  siteId: string,
  templates: ReadonlyArray<readonly [string, string, string]>,
) {
  for (const [order, [name, startTime, endTime]] of templates.entries()) {
    const existing = await prisma.shiftTemplate.findFirst({
      where: { siteId, name },
    });
    if (existing) {
      await prisma.shiftTemplate.update({
        where: { id: existing.id },
        data: { startTime, endTime, order },
      });
    } else {
      await prisma.shiftTemplate.create({
        data: { siteId, name, startTime, endTime, order },
      });
    }
  }
}

async function upsertEntryTypes(
  siteId: string,
  types: ReadonlyArray<{
    key: string;
    label: string;
    icon: string;
    color: string;
  }>,
) {
  for (const [order, type] of types.entries()) {
    await prisma.siteEntryType.upsert({
      where: { siteId_key: { siteId, key: type.key } },
      update: { ...type, order },
      create: { siteId, ...type, order },
    });
  }
}

async function upsertRecipients(
  siteId: string,
  recipients: ReadonlyArray<{
    name: string;
    email: string;
    roleLabel: string;
    required: boolean;
    status: RecipientStatus;
    verifiedAt?: Date;
    lastBounceAt?: Date;
    lastBounceReason?: string;
  }>,
) {
  for (const recipient of recipients) {
    await prisma.recipient.upsert({
      where: { siteId_email: { siteId, email: recipient.email } },
      update: recipient,
      create: { siteId, ...recipient },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

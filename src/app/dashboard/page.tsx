import type { Metadata } from "next";
import Link from "next/link";

import { AppChrome } from "@/components/app-chrome";
import {
  CompanyDashboardView,
  SiteDutyTable,
} from "@/components/dashboard/company-dashboard";
import {
  GuardDashboardView,
  RecentReports,
} from "@/components/dashboard/guard-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requireUnlockedActor } from "@/lib/auth/guards";
import { db, type Actor } from "@/lib/db/scoped";
import { averageEndFlowMs } from "@/lib/db/shift-end";
import { summariseDeliveries } from "@/lib/reports/delivery-health";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Section 9.1. Three genuinely different screens behind one route, because the
 * three roles arrive with different questions.
 *
 * A guard opens this on a phone, outside, about to start work. The only
 * question is "which shift, and start it" — so that is one large target and
 * everything else is secondary.
 *
 * A supervisor opens it to find out what is wrong right now. That is a scan
 * across sites, so it is a table, and anything needing action is lifted above
 * the table rather than left to be spotted inside it.
 *
 * An admin or owner is running the firm, not a shift. Their questions are
 * whether every contract is actually being covered, whether the reports
 * reached the clients, and who is working — so the table is still there, but
 * it is no longer the headline.
 */
export default async function DashboardPage() {
  const actor = await requireUnlockedActor();
  const me = await db(actor).user.findById(actor.userId);

  const heading = can.viewCompany(actor)
    ? "Company overview"
    : can.viewAllShiftsAtSite(actor)
      ? "Site overview"
      : "Your shifts";

  return (
    <>
      <AppChrome />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-4 pb-28 sm:px-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-text">{heading}</h1>
          <p className="text-sm text-text-muted capitalize">
            {me?.name ?? "Signed in"} · {actor.role.toLowerCase().replace("_", " ")}
          </p>
        </header>

        {can.viewCompany(actor) ? (
          <CompanyView actor={actor} />
        ) : can.viewAllShiftsAtSite(actor) ? (
          <SupervisorView actor={actor} />
        ) : (
          <GuardView actor={actor} />
        )}
      </main>
    </>
  );
}

async function GuardView({ actor }: { actor: Actor }) {
  const scoped = db(actor);
  const [active, startable, recent, pace, assignedSites] = await Promise.all([
    scoped.shift.findActiveForActor(),
    scoped.shift.findStartableForActor(),
    scoped.shift.recentReportsForActor(3),
    averageEndFlowMs(actor.userId, startOfMonth()),
    scoped.shift.assignedSitesForActor(),
  ]);

  return (
    <GuardDashboardView
      active={active}
      startable={startable}
      recent={recent}
      pace={pace}
      assignedSites={assignedSites}
    />
  );
}

/** Midnight on the 1st, in the viewer's own clock. */
function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function SupervisorView({ actor }: { actor: Actor }) {
  const scoped = db(actor);
  const [sites, recent] = await Promise.all([
    scoped.site.findManyWithDuty(),
    scoped.shift.recentReportsForActor(3),
  ]);

  const attention = sites
    .map((site) => ({
      site,
      bounced: site.recipients.filter((r) => r.status === "BOUNCED").length,
      unverified: site.recipients.filter((r) => r.status === "UNVERIFIED").length,
    }))
    .filter((row) => row.bounced > 0 || row.unverified > 0);

  return (
    <div className="space-y-6">
      {attention.length > 0 ? (
        <Card className="border-attention">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-text">
              {attention.map(({ site, bounced, unverified }) => (
                <li key={site.id}>
                  <Link
                    href={`/sites/${site.id}/recipients`}
                    className="font-medium underline decoration-border underline-offset-4"
                  >
                    {site.name}
                  </Link>
                  {": "}
                  {[
                    bounced > 0 ? `${bounced} bounced` : null,
                    unverified > 0 ? `${unverified} unverified` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-0">
          <SiteDutyTable sites={sites} />
        </CardContent>
      </Card>

      <RecentReports reports={recent} />
    </div>
  );
}

/** How far back the delivery panel looks. A week covers a full rota. */
const DELIVERY_WINDOW_DAYS = 7;

/**
 * The start of the delivery window. A plain function with a defaulted `now`
 * rather than a `Date.now()` in the render body, which the purity rule
 * rightly rejects: a value that changes on every re-render is not a value the
 * component can be reasoned about. Same shape as `startOfMonth` above.
 */
function deliveryWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - DELIVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * The firm's screen. Everything here is already company-scoped by
 * `visible.*`, so this reads the same way the supervisor view does — the
 * difference is which rows come back and what order they are shown in.
 */
async function CompanyView({ actor }: { actor: Actor }) {
  const scoped = db(actor);
  const since = deliveryWindowStart();

  const [sites, deliveries, incidents, roster] = await Promise.all([
    scoped.site.findManyWithDuty(),
    scoped.company.deliveryHealth(since),
    scoped.company.openIncidents(),
    scoped.company.roster(),
  ]);

  return (
    <CompanyDashboardView
      sites={sites}
      delivery={summariseDeliveries(deliveries)}
      incidents={incidents}
      roster={roster}
      windowDays={DELIVERY_WINDOW_DAYS}
    />
  );
}

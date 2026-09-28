import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DELIVERY_STATUS_LABEL,
  type DeliveryHealth,
} from "@/lib/reports/delivery-health";
import { formatClock, formatDateTime } from "@/lib/time";

/**
 * Section 9.1, the third screen. A supervisor asks "what is wrong at my sites
 * right now". The firm running the contracts asks a wider question, and the
 * difference is not the amount of data, it is the order.
 *
 * An uncovered property is a client paying for nobody, and a report that never
 * arrived is the product silently not being delivered. Both are invisible in
 * the supervisor table — the first reads as an empty cell, the second is not
 * there at all — so both are lifted above it and named.
 *
 * The site table itself is shared with the supervisor view rather than
 * reimplemented, because two copies of one table is how two screens start
 * disagreeing about what "on duty" means.
 */

export type DutySite = {
  id: string;
  name: string;
  timezone: string;
  recipients: readonly { id: string; name: string; status: string }[];
  shifts: readonly { clockInAt: Date | null; guard: { id: string; name: string } }[];
  /** Unresolved incidents at this site. Counted in `findManyWithDuty`. */
  openIncidents: number;
};

export type OpenIncident = {
  id: string;
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | null;
  status: "OPEN" | "ONGOING" | "RESOLVED";
  entry: {
    occurredAt: Date;
    shift: { site: { name: string; timezone: string } };
  };
};

export type RosterMember = {
  id: string;
  name: string;
  email: string;
  role: "GUARD" | "SUPERVISOR" | "ADMIN" | "OWNER";
  shifts: readonly {
    id: string;
    clockInAt: Date | null;
    site: { name: string; timezone: string };
  }[];
  _count: { assignments: number };
};

const ROLE_LABEL: Record<RosterMember["role"], string> = {
  GUARD: "Guard",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
  OWNER: "Owner",
};

/** Severity carries a glyph as well as a tone; colour alone is not a signal. */
const SEVERITY: Record<"LOW" | "MEDIUM" | "HIGH", { tone: BadgeTone; mark: string }> = {
  HIGH: { tone: "danger", mark: "!!" },
  MEDIUM: { tone: "attention", mark: "!" },
  LOW: { tone: "neutral", mark: "·" },
};

export function CompanyDashboardView({
  sites,
  delivery,
  incidents,
  roster,
  windowDays,
}: {
  sites: readonly DutySite[];
  delivery: DeliveryHealth;
  incidents: readonly OpenIncident[];
  roster: { members: readonly RosterMember[]; total: number };
  windowDays: number;
}) {
  const uncovered = sites.filter((site) => !site.shifts[0]);
  const covered = sites.length - uncovered.length;

  return (
    <div className="space-y-6">
      <Card className={uncovered.length > 0 ? "border-danger" : undefined}>
        <CardHeader>
          <CardTitle>Coverage right now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sites.length === 0 ? (
            <p className="text-sm text-text-muted">
              No properties yet. Add a site to start scheduling shifts.
            </p>
          ) : (
            <>
              <p className="text-sm text-text">
                <span className="font-mono tabular-nums">
                  {covered} of {sites.length}
                </span>{" "}
                {sites.length === 1 ? "property" : "properties"} covered.
              </p>
              {uncovered.length > 0 ? (
                <div className="rounded-[var(--radius-md)] border border-danger p-3">
                  <p className="text-sm font-medium text-text">
                    <span aria-hidden="true">× </span>
                    Nobody on duty at{" "}
                    {uncovered.map((site) => site.name).join(", ")}.
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    A property with no guard clocked in is a contract the client
                    is paying for and nobody is working.
                  </p>
                </div>
              ) : null}
              <SiteDutyTable sites={sites} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className={delivery.failed > 0 ? "border-danger" : undefined}>
        <CardHeader>
          <CardTitle>Report delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-muted">
            Last {windowDays} days, every recipient at every site.
          </p>
          {delivery.total === 0 ? (
            <p className="text-sm text-text-muted">
              No reports have been sent in this window.
            </p>
          ) : (
            <>
              {delivery.failures.length > 0 ? (
                <div className="rounded-[var(--radius-md)] border border-danger p-3">
                  <p className="text-sm font-medium text-text">
                    <span aria-hidden="true">× </span>
                    {delivery.failed}{" "}
                    {delivery.failed === 1 ? "report" : "reports"} did not reach
                    the client.
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-text-muted">
                    {delivery.failures.map((failure) => (
                      <li key={failure.status}>
                        {failure.count} ×{" "}
                        {DELIVERY_STATUS_LABEL[failure.status].toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tally label="Delivered" value={delivery.delivered} />
                <Tally label="Sent, unconfirmed" value={delivery.sent} />
                <Tally label="Pending" value={delivery.pending} />
                <Tally label="Failed" value={delivery.failed} />
              </dl>
              {delivery.sent > 0 ? (
                <p className="text-sm text-text-muted">
                  &ldquo;Sent&rdquo; means the mail provider accepted it, which is
                  not the same as the client receiving it.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nothing open across your properties.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {incidents.map((incident) => {
                const severity = incident.severity
                  ? SEVERITY[incident.severity]
                  : null;
                return (
                  <li
                    key={incident.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                  >
                    <span className="font-mono text-text">{incident.code}</span>
                    {severity ? (
                      <Badge tone={severity.tone}>
                        <span aria-hidden="true">{severity.mark}</span>
                        {incident.severity === "HIGH"
                          ? "High"
                          : incident.severity === "MEDIUM"
                            ? "Medium"
                            : "Low"}
                      </Badge>
                    ) : null}
                    {incident.status === "ONGOING" ? (
                      <Badge tone="attention">Ongoing</Badge>
                    ) : null}
                    <span className="text-text-muted">
                      {incident.entry.shift.site.name} ·{" "}
                      {formatDateTime(
                        incident.entry.occurredAt,
                        incident.entry.shift.site.timezone,
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Everyone at the company, their role, and whether they are on
                duty right now.
              </caption>
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Right now
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Sites
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.members.map((member) => {
                  const onDuty = member.shifts[0];
                  return (
                    <tr key={member.id}>
                      <th scope="row" className="px-4 py-3 font-normal text-text">
                        {member.name}
                      </th>
                      <td className="px-4 py-3 text-text-muted">
                        {ROLE_LABEL[member.role]}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {onDuty ? (
                          <>
                            <span aria-hidden="true">• </span>
                            {onDuty.site.name} from{" "}
                            <span className="font-mono tabular-nums">
                              {formatClock(onDuty.clockInAt, onDuty.site.timezone)}
                            </span>
                          </>
                        ) : (
                          "Off duty"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted tabular-nums">
                        {member._count.assignments}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {roster.total > roster.members.length ? (
            <p className="border-t border-border px-4 py-3 text-sm text-text-muted">
              Showing {roster.members.length} of {roster.total}.{" "}
              <Link
                href="/settings/team"
                className="underline decoration-border underline-offset-4"
              >
                See the whole team
              </Link>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Tally({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border p-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums text-text">{value}</dd>
    </div>
  );
}

/**
 * Who is on duty where, and what is unresolved. Shared by the supervisor and
 * company screens: the rows differ because `visible.site()` differs, the table
 * does not.
 */
export function SiteDutyTable({ sites }: { sites: readonly DutySite[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Sites you can see, with the guard currently on duty and the number of
          unresolved incidents.
        </caption>
        <thead className="border-b border-border text-text-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">
              Site
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              On duty
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Started
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Open
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sites.map((site) => {
            const onDuty = site.shifts[0];
            return (
              <tr key={site.id}>
                <th scope="row" className="py-3 pr-4 font-normal text-text">
                  {site.name}
                </th>
                <td className="px-4 py-3 text-text-muted">
                  {onDuty?.guard.name ?? "Nobody"}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-text-muted">
                  {onDuty ? formatClock(onDuty.clockInAt, site.timezone) : "—"}
                </td>
                <td className="px-4 py-3">
                  {site.openIncidents > 0 ? (
                    <Badge tone="danger">{site.openIncidents}</Badge>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

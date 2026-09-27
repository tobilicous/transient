import * as React from "react";
import { Camera, Clock, FileText, Send } from "lucide-react";

import { Mark } from "@/components/brand";
import { StatusChip } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import styles from "./shift-loop.module.css";

/**
 * Section 3: how it works, as the loop it actually is.
 *
 * A shift is a cycle, not a funnel — it ends where the next one starts — so it
 * is drawn as a closed circuit with a pulse running round it and each stage
 * lighting as the pulse reaches it. The motion is decoration on top of an
 * ordinary numbered list; see `shift-loop.module.css` for why it is CSS rather
 * than JavaScript, and for the reduced-motion branch.
 *
 * Three rules from ASSUMPTIONS.md constrain this and are worth restating,
 * because the reference design we were shown breaks all three:
 *
 *   1. No client JavaScript on a marketing route. This is a server component.
 *   2. No control that lies. The reference has an "Accept" button in its
 *      diagram that is not a button. Nothing here is shaped like a control.
 *   3. Only claims the code already makes. The reference's summary card reads
 *      "incident 4,471 of 12,840 this quarter across 50+ countries". We have
 *      no customers yet, so there is no number here at all. The one status
 *      that does appear is a real `StatusChip`, in the product's own
 *      vocabulary, so the picture cannot advertise a state we cannot produce.
 *
 * Geometry. The SVG and the card positions are two views of the same rounded
 * rect, so they are derived from one table rather than two sets of literals: a
 * card sits at the centre of each corner arc. `CORNERS` below is that table.
 */

export interface LoopStage {
  icon: React.ElementType;
  title: string;
  body: string;
}

/**
 * The path, as a rounded rect from (216,120) to (744,440), r=76, in the 960x560
 * viewBox. It starts at the *top-left arc's midpoint* rather than at a corner,
 * because that is where the first stage's card sits: starting the pulse
 * anywhere else would mean stage 1 lights up part-way through a lap.
 */
const LOOP_PATH =
  "M 238.26 142.26 A 76 76 0 0 1 292 120 L 668 120 A 76 76 0 0 1 744 196 L 744 364 A 76 76 0 0 1 668 440 L 292 440 A 76 76 0 0 1 216 364 L 216 196 A 76 76 0 0 1 238.26 142.26";

/**
 * Where each card sits, as a percentage of the viewBox, clockwise from the top
 * left: (216,120), (744,120), (744,440), (216,440) over 960x560. Percentages
 * rather than pixels so the cards track the SVG when the frame is scaled.
 */
const CORNERS = [
  { left: "22.5%", top: "21.43%" },
  { left: "77.5%", top: "21.43%" },
  { left: "77.5%", top: "78.57%" },
  { left: "22.5%", top: "78.57%" },
] as const;

/**
 * The stages. Copy is the same claim set the page made before this was a
 * diagram — the shape changed, the promises did not.
 */
export const LOOP_STAGES: readonly LoopStage[] = [
  {
    icon: Clock,
    title: "Clock in, walk the blind spots",
    body: "The list is the site\u2019s, not the guard\u2019s. Whoever covers the shift walks the same stairwell landing, the same loading dock camera, in the same order.",
  },
  {
    icon: Camera,
    title: "Log it where it happens",
    body: "Tap, photo, or dictate. The time recorded is the time you opened the note, not the time you got around to saving it.",
  },
  {
    icon: FileText,
    title: "Clock out builds the report",
    body: "Incidents first, then the timeline, then the photos. It fits in an inbox.",
  },
  {
    icon: Send,
    title: "It gets delivered, and you find out",
    body: "Sent, delivered, opened, bounced. A bad address wakes someone up that night instead of surfacing at renewal.",
  },
];

/**
 * The hub. Decorative: the mark is already named in the page header, and the
 * caption underneath repeats nothing the stages do not say, so the whole node
 * leaves the accessibility tree rather than interrupting the list with an
 * unlabelled image.
 */
function Hub() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 lg:flex"
    >
      <span className="flex size-20 items-center justify-center rounded-full border border-border bg-surface">
        <Mark className="size-9" title="" />
      </span>
      <span className="text-center text-xs leading-tight font-medium text-text-muted">
        One shift,
        <br />
        one record
      </span>
    </div>
  );
}

function Stage({ stage, index }: { stage: LoopStage; index: number }) {
  const corner = CORNERS[index];

  return (
    <li
      // The absolute placement and the -50% centring live on the wrapper so
      // that the card's own `transform` is free for the animation's 2px lift.
      // Below `lg` these become inert: a static element ignores left/top.
      className="lg:absolute lg:w-[28%] lg:-translate-x-1/2 lg:-translate-y-1/2"
      style={
        {
          "--stage": index,
          left: corner.left,
          top: corner.top,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4",
          "transition-colors duration-200",
          styles.stage,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border border-border",
              "text-xs font-semibold text-text-muted tabular-nums",
              styles.stageNumber,
            )}
          >
            {index + 1}
          </span>
          <stage.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-medium text-balance">{stage.title}</h3>
        <p className="text-sm text-pretty text-text-muted">{stage.body}</p>
        {/* The one status in the picture, from the product's own union. */}
        {index === 3 ? (
          <StatusChip status="OPENED" className="mt-1 self-start" />
        ) : null}
      </div>
    </li>
  );
}

export function ShiftLoop() {
  return (
    <div className="relative mx-auto w-full max-w-5xl lg:aspect-[960/560]">
      {/* Decoration. Every word of the diagram is in the list below it, so the
          circuit carries nothing a screen reader would miss. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 960 560"
        className="absolute inset-0 hidden size-full lg:block"
      >
        {/* The track: where the loop goes when nothing is on it. */}
        <path
          d={LOOP_PATH}
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
          strokeDasharray="3 9"
          strokeLinecap="round"
        />
        {/* The trail, and its head. Same path, three strokes: a wide soft glow,
            the trail itself, then the dot welded to its leading edge. */}
        <path
          d={LOOP_PATH}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="9"
          opacity="0.14"
          strokeLinecap="round"
          className={styles.trail}
        />
        <path
          d={LOOP_PATH}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.trail}
        />
        <path
          d={LOOP_PATH}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="9"
          className={styles.pulse}
        />
      </svg>

      <Hub />

      {/* Below lg the corners collapse to an ordinary stacked list. The
          sequential highlight still runs; the circuit does not, because a
          racetrack 320px wide is illegible and a vertical stripe pretending to
          be one is decoration for its own sake.

          At lg the list is stretched over the frame so that the cards' `top`
          percentages resolve against the same box the viewBox does. Without
          `inset-0` it is a zero-height flow element and every card lands at
          top: 0. */}
      <ol className="grid gap-4 sm:grid-cols-2 lg:absolute lg:inset-0 lg:block lg:gap-0">
        {LOOP_STAGES.map((stage, index) => (
          <Stage key={stage.title} stage={stage} index={index} />
        ))}
      </ol>
    </div>
  );
}

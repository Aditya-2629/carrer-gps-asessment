// Hairline UI · streak-chain · MIT License
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";;
import * as React from "react";
import { Snowflake } from "lucide-react";
import { NumberRoll } from "./number-roll";
import { TextMorph } from "./text-morph";
import { createSpring } from "./ui-interaction-motion";

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const DEFAULT_COLORS = ["var(--chart-5, var(--primary))", "var(--chart-2, var(--primary))"];
const MILESTONES = [7, 14, 30, 60, 100, 365];
const OPEN_ANGLE = 26;
const OPEN_GAP = 30;
const MS = 86_400_000;
const TICKS = "repeating-linear-gradient(to right, #000 0 2px, transparent 2px 4px)";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedMotion = () =>
  React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

const mix = (color, amount, into = "transparent") => `color-mix(in oklab, ${color} ${amount}%, ${into})`;

/** A stadium traced clockwise from its rightmost point, so a gap there opens the ring away from the chain. */
function stadium(cx, cy, w, h) {
  const r = h / 2;
  const x1 = cx - w / 2;
  const x2 = cx + w / 2;
  return `M ${x2} ${cy} A ${r} ${r} 0 0 1 ${x2 - r} ${cy + r} L ${x1 + r} ${cy + r} A ${r} ${r} 0 0 1 ${x1} ${cy} A ${r} ${r} 0 0 1 ${x1 + r} ${cy - r} L ${x2 - r} ${cy - r} A ${r} ${r} 0 0 1 ${x2} ${cy}`;
}

export function StreakChain({
  history,
  today: todayProp,
  defaultToday = false,
  onCompleteToday,
  deadline,
  freezes,
  best,
  milestones = MILESTONES,
  date,
  title = "Daily streak",
  actionLabel = "Complete today",
  colors = DEFAULT_COLORS,
  locale = "en-US",
  className = "",
  ...props
}) {
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState(defaultToday);
  const [optimistic, setOptimistic] = React.useState(null);
  const done = optimistic ?? todayProp ?? own;
  // The chain grows a ring once the forge has played; already done on arrival, it has grown.
  const [grown, setGrown] = React.useState(done);
  if (!done && grown) setGrown(false);
  const [width, setWidth] = React.useState(0);
  const [now, setNow] = React.useState(null);
  const [said, setSaid] = React.useState("");
  const [colorA, colorB] = colors;

  const rootRef = React.useRef(null);
  const boxRef = React.useRef(null);
  const chainRef = React.useRef(null);
  const todayRef = React.useRef(null);
  const todayPath = React.useRef(null);
  const pourPath = React.useRef(null);
  const sparkRef = React.useRef(null);
  const ringRefs = React.useRef([]);
  const springs = React.useRef({ angle: null, gap: null });
  const geo = React.useRef({ pivotX: 0, pivotY: 0, sway: 0, frame: 0, onScreen: false });
  const timer = React.useRef(0);

  // Done days back from today; a frozen day keeps the streak alive without adding to it.
  let streak = done ? 1 : 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === "missed") break;
    if (history[i] === "done") streak++;
  }
  const next = milestones.find((m) => m > streak) ?? null;
  const prevMilestone = [...milestones].reverse().find((m) => m <= streak) ?? 0;

  React.useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setWidth((w) => (w === box.offsetWidth ? w : box.offsetWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // The clock for "left today": a minute is plenty.
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const every = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  // As many rings as fit at a size you can see, today (and tomorrow, once grown) at the end.
  const slots = Math.max(5, Math.min(9, Math.round((width || 320) / 46)));
  const days = grown ? [...history.slice(-(slots - 2)), "today", "tomorrow"] : [...history.slice(-(slots - 1)), "today"];
  const n = days.length;
  const P = (width || 320) / n;
  const ringW = P * 0.74;
  const ringH = Math.min(P * 0.52, 30);
  const stroke = Math.max(3, Math.min(5, P * 0.1));
  const H = Math.ceil(ringH * 2.4 + 8);
  const cy = ringH * 0.9 + 4;
  const todayIndex = days.indexOf("today");
  const colorAt = (i) => mix(colorA, Math.round(100 - (n > 1 ? i / (n - 1) : 1) * 100), colorB);
  const cxOf = (i) => (i + 0.5) * P;

  // Today's ring: an angle and a gap on springs, plus a small sway while it waits, written straight to the SVG.
  const paintToday = React.useCallback(() => {
    const g = todayRef.current;
    const p = todayPath.current;
    const { angle, gap } = springs.current;
    if (!g || !p || !angle || !gap) return;
    const a = angle.get() + geo.current.sway;
    const open = Math.max(0, gap.get());
    g.setAttribute("transform", `rotate(${a} ${geo.current.pivotX} ${geo.current.pivotY})`);
    p.style.strokeDasharray = `${100 - open} ${open}`;
    p.style.strokeDashoffset = `${-open / 2}`;
  }, []);

  const startDone = React.useRef(done);
  React.useLayoutEffect(() => {
    const s = springs.current;
    s.angle = createSpring(startDone.current ? 0 : OPEN_ANGLE, { stiffness: 300, damping: 12 }, paintToday, 0.02);
    s.gap = createSpring(startDone.current ? 0 : OPEN_GAP, { stiffness: 340, damping: 26 }, paintToday, 0.02);
    paintToday();
    return () => {
      s.angle?.stop();
      s.gap?.stop();
      s.angle = s.gap = null;
    };
  }, [paintToday]);

  React.useLayoutEffect(() => {
    // Today's ring hangs from where it hooks into yesterday's: its left end.
    geo.current.pivotX = cxOf(todayIndex) - ringW / 2 + stroke;
    geo.current.pivotY = cy;
    paintToday();
  });

  React.useEffect(() => {
    const { angle, gap } = springs.current;
    if (!angle || !gap) return;
    if (reduced) {
      angle.jump(done ? 0 : OPEN_ANGLE);
      gap.jump(done ? 0 : OPEN_GAP);
    } else {
      angle.set(done ? 0 : OPEN_ANGLE);
      gap.set(done ? 0 : OPEN_GAP);
    }
  }, [done, reduced]);

  // While today waits, the open ring sways a little, on screen only.
  React.useEffect(() => {
    const g = geo.current;
    const el = rootRef.current;
    if (done || reduced || !el) {
      g.sway = 0;
      paintToday();
      return;
    }
    const loop = (t) => {
      g.sway = Math.sin(t / 620) * 3.2;
      paintToday();
      g.frame = g.onScreen ? requestAnimationFrame(loop) : 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      g.onScreen = entry.isIntersecting;
      if (g.onScreen && !g.frame) g.frame = requestAnimationFrame(loop);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(g.frame);
      g.frame = 0;
      g.sway = 0;
    };
  }, [done, reduced, paintToday]);

  // The chain grows: everything moves along one ring as tomorrow's slides in.
  const grewFrom = React.useRef(grown);
  React.useLayoutEffect(() => {
    if (grewFrom.current === grown) return;
    grewFrom.current = grown;
    if (!grown || reduced) return;
    chainRef.current?.animate([{ transform: `translateX(${P}px)` }, { transform: "translateX(0)" }], { duration: 680, easing: "cubic-bezier(0.65,0,0.35,1)" });
    ringRefs.current[n - 1]?.animate(
      [
        { opacity: 0, transform: "translateX(18px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 620, delay: 120, easing: EASE, fill: "backwards" },
    );
    if (streak === prevMilestone && prevMilestone > 0)
      ringRefs.current.forEach((el, i) =>
        el?.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.5)" }, { filter: "brightness(1)" }], { duration: 520, delay: 700 + i * 50, easing: "ease-in-out" }),
      );
  }, [grown, reduced, P, n, streak, prevMilestone]);

  const forge = () => {
    if (reduced) return;
    // The snap: a kick past closed, colour poured round from the joint, sparks off it.
    springs.current.angle?.push(-150);
    pourPath.current?.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 560, delay: 120, easing: "cubic-bezier(0.4,0,0.2,1)", fill: "backwards" });
    sparkRef.current?.querySelectorAll("line").forEach((l, i) =>
      l.animate(
        [
          { opacity: 0, transform: "scale(0.3)" },
          { opacity: 1, transform: "scale(1)", offset: 0.3 },
          { opacity: 0, transform: "scale(1.7)" },
        ],
        { duration: 520, delay: 140 + i * 22, easing: EASE, fill: "backwards" },
      ),
    );
  };

  const complete = () => {
    if (done) return;
    setOptimistic(true);
    forge();
    setSaid(`Today is done. ${streak + 1}-day streak.`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setGrown(true), reduced ? 0 : 760);
    const settle = () => {
      if (todayProp === undefined) setOwn(true);
      setOptimistic(null);
    };
    const refuse = () => {
      window.clearTimeout(timer.current);
      setOptimistic(false);
      setGrown(false);
      window.setTimeout(() => setOptimistic(null), 0);
      setSaid("Couldn’t save today. Try again.");
    };
    let result;
    try {
      result = onCompleteToday?.();
    } catch {
      refuse();
      return;
    }
    if (result && typeof (result).then === "function") (result).then(settle, refuse);
    else settle();
  };

  const letter = (i) => {
    if (!date) return "";
    const [y, m, d] = date.split("-").map(Number);
    const day = Date.UTC(y, m - 1, d) + (i - todayIndex) * MS;
    return new Date(day).toLocaleDateString(locale, { weekday: "narrow", timeZone: "UTC" });
  };

  const end = deadline !== undefined ? new Date(deadline).getTime() : null;
  const left = end !== null && now !== null ? Math.max(0, end - now) : null;
  const leftText = left === null ? "" : left < 3_600_000 ? `${Math.max(1, Math.round(left / 60_000))}m left today` : `${Math.floor(left / 3_600_000)}h ${Math.round((left % 3_600_000) / 60_000)}m left today`;
  const urgent = left !== null && left < 3 * 3_600_000 && !done;
  const toNext = next ? next - streak : 0;
  const nextFill = next ? (streak - prevMilestone) / (next - prevMilestone) : 1;
  const ink = mix("var(--foreground)", 26, "var(--border)");

  return (
    <div ref={rootRef} className={`w-full rounded-[22px] bg-background shadow-[0_0_0_1px_var(--border)] ${className}`} {...props}>
      <div aria-hidden="true" data-natural-width className="grid h-0" style={{ gridTemplateColumns: "minmax(0, 400px)" }} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12.5px] text-muted-foreground">{title}</p>
            <p className="mt-1 flex items-baseline gap-1.5 text-foreground">
              <span className="text-[40px] font-medium leading-none tracking-[-0.045em] tabular-nums">
                <NumberRoll value={streak} duration={900} />
              </span>
              <span className="text-[14px] text-muted-foreground">{streak === 1 ? "day" : "days"}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 pt-0.5 text-[12px] text-muted-foreground tabular-nums">
            {best !== undefined && (
              <span>
                Best <span className="font-medium text-foreground">{Math.max(best, streak)}</span>
              </span>
            )}
            {freezes !== undefined && (
              <span className="inline-flex items-center gap-1" title="Streak freezes">
                <Snowflake aria-hidden="true" className="size-3.5" style={{ color: "var(--chart-1, var(--primary))" }} />
                <span className="font-medium text-foreground">{freezes}</span> {freezes === 1 ? "freeze" : "freezes"}
              </span>
            )}
          </div>
        </div>

        <div ref={boxRef} className="mt-4 w-full overflow-x-clip">
          {width > 0 && (
            <svg width={width} height={H + (date ? 16 : 0)} viewBox={`0 0 ${width} ${H + (date ? 16 : 0)}`} aria-hidden="true" className="block overflow-visible">
              <g ref={chainRef}>
                {/* The joints between rings: a short bar hooked through each pair, missing where the chain broke. */}
                {days.map((d, i) => {
                  if (i === 0 || d === "tomorrow" || d === "missed" || days[i - 1] === "missed" || (d === "today" && !done)) return null;
                  const x1 = cxOf(i - 1) + ringW / 2 - stroke * 1.4;
                  const x2 = cxOf(i) - ringW / 2 + stroke * 1.4;
                  const frozen = d === "frozen" || days[i - 1] === "frozen";
                  return (
                    <rect
                      key={`j${i}`}
                      x={x1}
                      y={cy - stroke * 0.7}
                      width={Math.max(2, x2 - x1)}
                      height={stroke * 1.4}
                      rx={stroke * 0.7}
                      fill={frozen ? mix("var(--chart-1, var(--primary))", 40, "var(--background)") : colorAt(i)}
                    />
                  );
                })}
                {days.map((d, i) => {
                  if (d === "today") return null;
                  const cx = cxOf(i);
                  const missed = d === "missed";
                  const frozen = d === "frozen";
                  const ghost = d === "tomorrow";
                  const color = missed ? ink : frozen ? mix("var(--chart-1, var(--primary))", 42, "var(--background)") : ghost ? mix("var(--foreground)", 22, "var(--border)") : colorAt(i);
                  return (
                    <g
                      key={`r${i}`}
                      ref={(el) => {
                        ringRefs.current[i] = el;
                      }}
                      transform={missed ? `translate(0 ${ringH * 0.55}) rotate(14 ${cx} ${cy})` : undefined}
                    >
                      <path
                        d={stadium(cx, cy, ringW, ringH)}
                        pathLength={100}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        style={missed ? { strokeDasharray: "72 28", strokeDashoffset: 10 } : ghost ? { strokeDasharray: "5 5" } : undefined}
                      />
                      {frozen && <Snow cx={cx} cy={cy} r={ringH * 0.24} />}
                    </g>
                  );
                })}

                {/* Today: hanging open off the end, or forged shut. */}
                <g
                  ref={(el) => {
                    todayRef.current = el;
                    ringRefs.current[todayIndex] = el;
                  }}
                >
                  <path
                    ref={todayPath}
                    d={stadium(cxOf(todayIndex), cy, ringW, ringH)}
                    pathLength={100}
                    fill="none"
                    stroke={done ? colorAt(todayIndex) : ink}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    style={{ transition: reduced ? "none" : `stroke 300ms ${EASE} 500ms` }}
                  />
                  <path
                    ref={pourPath}
                    d={stadium(cxOf(todayIndex), cy, ringW, ringH)}
                    pathLength={100}
                    fill="none"
                    stroke={`url(#streak-pour)`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    style={{ strokeDasharray: 100, strokeDashoffset: done ? 0 : 100, opacity: done ? 1 : 0, transition: `opacity 1ms linear ${done ? 0 : 300}ms` }}
                  />
                </g>
                <defs>
                  <linearGradient id="streak-pour" x1="0" x2="1">
                    <stop offset="0" stopColor={colorA} />
                    <stop offset="1" stopColor={colorB} />
                  </linearGradient>
                </defs>
              </g>

              <g ref={sparkRef} stroke={colorB} strokeWidth={1.6} strokeLinecap="round">
                {[-80, -45, -12, 20, 55].map((deg) => {
                  const a = (deg * Math.PI) / 180;
                  const x = cxOf(todayIndex) - ringW / 2 + stroke;
                  return (
                    <line
                      key={deg}
                      x1={x - Math.cos(a) * ringH * 0.7}
                      y1={cy + Math.sin(a) * ringH * 0.7}
                      x2={x - Math.cos(a) * ringH * 1.15}
                      y2={cy + Math.sin(a) * ringH * 1.15}
                      style={{ opacity: 0, transformBox: "view-box", transformOrigin: `${x}px ${cy}px` }}
                    />
                  );
                })}
              </g>

              {date &&
                days.map((d, i) => (
                  <text
                    key={`l${i}`}
                    x={cxOf(i)}
                    y={H + 11}
                    textAnchor="middle"
                    className={`text-[10px] ${d === "today" ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}
                  >
                    {d === "today" ? "Today" : letter(i)}
                  </text>
                ))}
            </svg>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] tabular-nums">
          <span className={urgent ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
            <TextMorph>{done ? "Saved for today" : leftText || "Today is still open"}</TextMorph>
          </span>
          {next && (
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">
                <NumberRoll value={toNext} duration={700} direction="down" />
              </span>{" "}
              {toNext === 1 ? "day" : "days"} to {next}
            </span>
          )}
        </div>
        {next && (
          <div aria-hidden="true" className="relative mt-1.5 h-2">
            <div className="absolute inset-0" style={{ background: mix("var(--foreground)", 14), maskImage: TICKS, WebkitMaskImage: TICKS }} />
            <div
              className="absolute inset-0 origin-left"
              style={{
                background: `linear-gradient(90deg, ${colorA}, ${colorB})`,
                maskImage: TICKS,
                WebkitMaskImage: TICKS,
                transform: `scaleX(${Math.max(0.02, nextFill)})`,
                transition: reduced ? "none" : `transform 700ms ${EASE} 600ms`,
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={complete}
          disabled={done}
          className={`mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-[13.5px] font-medium transition-[background-color,color,box-shadow,scale] duration-300 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100 ${FOCUS}`}
          style={{
            background: done ? "var(--muted)" : `linear-gradient(100deg, ${colorA}, ${colorB})`,
            color: done ? "var(--muted-foreground)" : `oklch(from ${colorA} clamp(0.2, (0.72 - l) * 100, 0.99) 0 h)`,
            transitionTimingFunction: EASE,
          }}
        >
          <TextMorph>{done ? "Done for today" : actionLabel}</TextMorph>
        </button>
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
        <div className="sr-only">
          <ul aria-label="Recent days">
            {days
              .filter((d) => d !== "tomorrow")
              .map((d, i) => (
                <li key={i}>
                  {date ? letter(i) : `Day ${i + 1}`}: {d === "today" ? (done ? "today, done" : "today, not done yet") : d}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Snow({
  cx,
  cy,
  r
}) {
  return (
    <g stroke="var(--chart-1, var(--primary))" strokeWidth={1.2} strokeLinecap="round" opacity={0.8}>
      {[0, 60, 120].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <line key={deg} x1={cx - Math.cos(a) * r} y1={cy - Math.sin(a) * r} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} />;
      })}
    </g>
  );
}

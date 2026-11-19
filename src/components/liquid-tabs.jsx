// Hairline UI · liquid-tabs · MIT License
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";;
import * as React from "react";
import {
  INTERACTION_FOCUS,
  MATERIAL_RECESS,
  createSpring,
  rubberBand,
  useInteractionReducedMotion,
} from "./ui-interaction-motion";

const SIZES = {
  sm: { row: "h-8 p-[3px]", tab: "px-3 text-[12.5px] gap-1.5 [&_svg]:size-3.5" },
  md: { row: "h-10 p-1", tab: "px-4 text-[13.5px] gap-2 [&_svg]:size-4" },
  lg: { row: "h-12 p-[5px]", tab: "px-5 text-[15px] gap-2 [&_svg]:size-[18px]" }
};

// Both critically damped, so nothing overshoots. The front is a touch quicker, and the difference is the whole effect.
const FRONT = { stiffness: 620, damping: 49.8 };
const BEHIND = { stiffness: 380, damping: 39 };
const WIDTH = { stiffness: 450, damping: 42.4 };

/** How far the highlight can draw out past its width, in heights, however far it's going. */
const REACH = 0.45;
/** The most the waist pinches, as a share of the height. */
const PINCH = 0.2;

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const n1 = (n) => Math.round(n * 100) / 100;

/** One half's outline, end cap to waist: `tip` is the middle of the waist. */
function half(capX, tipX, top, bottom, thin, side) {
  const cy = (top + bottom) / 2;
  const r = Math.min((bottom - top) / 2, Math.abs(tipX - capX));
  const start = capX + side * r;
  const pull = (tipX - start) * 0.56;
  const edge = (y, tipY) => `${n1(start + pull)} ${n1(y)} ${n1(tipX - pull)} ${n1(tipY)} ${n1(tipX)} ${n1(tipY)}`;
  const sweep = side === 1 ? 1 : 0;
  return {
    start: { x: n1(start), top: n1(cy - r), bottom: n1(cy + r) },
    r: n1(r),
    sweep,
    toTip: { top: edge(cy - r, cy - thin), bottom: edge(cy + r, cy + thin) },
    tipTop: n1(cy - thin),
    tipBottom: n1(cy + thin),
    backTop: `${n1(tipX - pull)} ${n1(cy - thin)} ${n1(start + pull)} ${n1(cy - r)} ${n1(start)} ${n1(cy - r)}`,
    backBottom: `${n1(tipX - pull)} ${n1(cy + thin)} ${n1(start + pull)} ${n1(cy + r)} ${n1(start)} ${n1(cy + r)}`,
  };
}

/**
 * The outline from its left and right edges, its resting width, and its top and bottom. A pure function: any interruption
 * is just another pair of edges, so it never has to restart anything.
 */
export function liquidPath(left, right, rest, top, bottom) {
  const height = bottom - top;
  const width = right - left;
  const mid = (left + right) / 2;
  const drawn = clamp((width - rest) / (height * REACH), 0, 1);
  const thin = (height / 2) * (1 - PINCH * drawn * (2 - drawn));
  const a = half(left, mid, top, bottom, thin, 1);
  const c = half(right, mid, top, bottom, thin, -1);
  return (
    `M${a.start.x} ${a.start.top}C${a.toTip.top}C${c.backTop}` +
    `A${c.r} ${c.r} 0 0 1 ${c.start.x} ${c.start.bottom}` +
    `C${c.toTip.bottom}C${a.backBottom}` +
    `A${a.r} ${a.r} 0 0 1 ${a.start.x} ${a.start.top}Z`
  );
}

const colorOf = (tab) => tab?.color ?? "var(--primary)";

export function LiquidTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  label,
  size = "md",
  block,
  className = ""
}) {
  const reduced = useInteractionReducedMotion();
  const [own, setOwn] = React.useState(defaultValue ?? tabs[0]?.value);
  const current = value !== undefined ? value : own;
  const [measured, setMeasured] = React.useState(false);
  const [hovered, setHovered] = React.useState(null);

  const rowRef = React.useRef(null);
  const pathRef = React.useRef(null);
  const sheenRef = React.useRef(null);
  const lightRef = React.useRef(null);
  const flowRef = React.useRef(null);
  const fromStopRef = React.useRef(null);
  const toStopRef = React.useRef(null);
  const flowId = React.useId();
  const sheenId = React.useId();
  const springs = React.useRef(null);
  const motion = React.useRef({ top: 0, bottom: 0, heading: 1, target: 0, flowing: false, frontFrom: 0, tailFrom: 0, tailTo: 0 });
  const marks = React.useRef(new Map());

  const paint = React.useCallback(() => {
    const s = springs.current;
    if (!s) return;
    const m = motion.current;
    const rest = s.rest.get();
    const height = m.bottom - m.top;
    const most = rest + height * REACH;
    let left = s.left.get();
    let right = s.right.get();
    // On a long jump the tail is carried along behind the front, so the distance never makes the shape any bigger.
    const over = right - left - most;
    if (over > 0) {
      const kept = rubberBand(over, height * 0.3);
      if (m.heading > 0) left = right - most - kept;
      else right = left + most + kept;
    }
    const d = liquidPath(left, right, rest, m.top, m.bottom);
    pathRef.current?.setAttribute("d", d);
    sheenRef.current?.setAttribute("d", d);
    if (lightRef.current) lightRef.current.style.clipPath = `path("${d}")`;

    // The new colour starts at the front of the drop and the old one leaves with its tail: where the two meet follows how
    // far both edges have got. Before the first frame of a flight the drop is all old colour, and after the last all new.
    const flow = flowRef.current;
    if (m.flowing && flow) {
      const front = m.heading > 0 ? right : left;
      const tail = m.heading > 0 ? left : right;
      const done = (now, from, to) => clamp((now - from) / (Math.abs(to - from) < 1 ? 1 : to - from), 0, 1);
      const through = (done(front, m.frontFrom, m.target) + done(tail, m.tailFrom, m.tailTo)) / 2;
      const soft = Math.min(20, Math.abs(front - tail) * 0.25);
      const a = front + m.heading * soft;
      const seam = a + (tail - m.heading * soft - a) * through;
      flow.setAttribute("x1", `${n1(seam - m.heading * soft)}`);
      flow.setAttribute("x2", `${n1(seam + m.heading * soft)}`);
      if (through > 0.995) m.flowing = false;
    } else if (flow) {
      flow.setAttribute("x1", "0");
      flow.setAttribute("x2", "0");
    }
  }, []);

  const measure = React.useCallback(() => {
    const row = rowRef.current;
    if (!row) return false;
    marks.current.clear();
    row.querySelectorAll("[data-liquid-tab]").forEach((el) => {
      // Offsets count from the controls' own layer, which sits inside the row's padding.
      const layer = el.offsetParent;
      marks.current.set(el.dataset.liquidTab, { x: layer.offsetLeft + el.offsetLeft, w: el.offsetWidth });
      motion.current.top = layer.offsetTop + el.offsetTop;
      motion.current.bottom = motion.current.top + el.offsetHeight;
    });
    return true;
  }, []);

  const aim = React.useCallback(
    (next, instant) => {
      const s = springs.current;
      const mark = next ? marks.current.get(next) : undefined;
      if (!s || !mark) return;
      const m = motion.current;
      const end = mark.x + mark.w;
      if (instant) {
        m.flowing = false;
        s.left.jump(mark.x);
        s.right.jump(end);
        s.rest.jump(mark.w);
        return;
      }
      const heading = mark.x + mark.w / 2 >= (s.left.get() + s.right.get()) / 2 ? 1 : -1;
      m.heading = heading;
      m.target = heading > 0 ? end : mark.x;
      m.frontFrom = heading > 0 ? s.right.get() : s.left.get();
      m.tailFrom = heading > 0 ? s.left.get() : s.right.get();
      m.tailTo = heading > 0 ? mark.x : end;
      m.flowing = true;
      (heading > 0 ? s.right : s.left).configure(FRONT);
      (heading > 0 ? s.left : s.right).configure(BEHIND);
      s.left.set(mark.x);
      s.right.set(end);
      s.rest.set(mark.w);
      // Now, not next frame: the stops have already changed, and the drop must still be all old colour when it next paints.
      paint();
    },
    [paint],
  );

  // The first placement, and again whenever the row changes size: fonts arriving, a label changing, a narrower parent.
  React.useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !measure()) return;
    const start = current ? marks.current.get(current) : undefined;
    const s = {
      left: createSpring(start?.x ?? 0, FRONT, paint),
      right: createSpring(start ? start.x + start.w : 0, BEHIND, paint),
      rest: createSpring(start?.w ?? 0, WIDTH, paint),
    };
    springs.current = s;
    paint();
    setMeasured(true);
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) return void (first = false);
      measure();
      aim(row.dataset.current, true);
    });
    observer.observe(row);
    document.fonts?.ready.then(() => {
      if (springs.current !== s) return;
      measure();
      aim(row.dataset.current, true);
    });
    return () => {
      observer.disconnect();
      s.left.stop();
      s.right.stop();
      s.rest.stop();
      springs.current = null;
    };
    // Mount only: `current` is read from the row's data attribute from then on, and changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, aim, paint, tabs.length]);

  // A new choice: the colour first, so its stops are right from the first frame of the flight.
  const shownRef = React.useRef(current);
  React.useLayoutEffect(() => {
    if (shownRef.current === current) return;
    const before = tabs.find((t) => t.value === shownRef.current);
    const after = tabs.find((t) => t.value === current);
    shownRef.current = current;
    fromStopRef.current?.setAttribute("stop-color", colorOf(before));
    toStopRef.current?.setAttribute("stop-color", colorOf(after));
    aim(current, reduced);
    const row = rowRef.current;
    const el = row?.querySelector(`[data-liquid-tab="${CSS.escape(current ?? "")}"]`);
    const scroller = row?.parentElement;
    if (el && scroller && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollTo({ left: el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    }
  }, [current, tabs, aim, reduced]);

  const pick = (next) => {
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };

  const onKeyDown = (event) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const index = enabled.findIndex((t) => t.value === current);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const tab = enabled[next];
    pick(tab.value);
    rowRef.current?.querySelector(`[data-liquid-tab="${CSS.escape(tab.value)}"]`)?.focus();
  };

  const sizes = SIZES[size];
  const isNav = tabs.some((t) => t.href);
  const row = `flex items-stretch ${block ? "w-full" : "w-max"}`;
  const cell = `flex min-w-0 items-center justify-center whitespace-nowrap rounded-full font-medium ${sizes.tab} ${block ? "flex-1 basis-0" : ""}`;
  const activeTab = tabs.find((t) => t.value === current);

  return (
    <div className={`relative isolate rounded-full bg-background outline outline-1 -outline-offset-1 outline-border ${MATERIAL_RECESS} ${block ? "w-full" : "w-fit max-w-full"} ${className}`}>
      <div className="overflow-x-auto overflow-y-clip rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          ref={rowRef}
          data-current={current}
          role={isNav ? undefined : "tablist"}
          aria-label={isNav ? undefined : label}
          onKeyDown={isNav ? undefined : onKeyDown}
          className={`relative grid select-none ${sizes.row} ${block ? "w-full grid-cols-[minmax(0,1fr)]" : "w-max"}`}
        >
          {/* What's under the highlight: the dark copy of the labels. Before the first measure the chosen tab paints its own drop. */}
          <div aria-hidden="true" className={`${row} [grid-area:1/1]`}>
            {tabs.map((tab) => {
              const on = tab.value === current;
              const lit = on && !measured;
              return (
                <span
                  key={tab.value}
                  className={`${cell} transition-colors duration-200 motion-reduce:transition-none ${tab.disabled ? "opacity-40" : ""} ${hovered === tab.value && !on ? "text-foreground" : "text-muted-foreground"}`}
                  style={lit ? { background: colorOf(tab), color: tab.foreground ?? "var(--primary-foreground)" } : undefined}
                >
                  {tab.icon}
                  {tab.label}
                </span>
              );
            })}
          </div>

          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible [contain:layout]" style={{ opacity: measured ? 1 : 0 }}>
            <defs>
              <linearGradient ref={flowRef} id={flowId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="0">
                <stop ref={fromStopRef} offset="0" stopColor={colorOf(activeTab)} />
                <stop ref={toStopRef} offset="1" stopColor={colorOf(activeTab)} />
              </linearGradient>
              <linearGradient id={sheenId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="white" stopOpacity="0.12" />
                <stop offset="0.5" stopColor="white" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path ref={pathRef} fill={`url(#${flowId})`} />
            <path ref={sheenRef} fill={`url(#${sheenId})`} />
          </svg>

          {/* The same labels in the drop's text colour, cut to the drop's outline, so a letter turns exactly where the highlight reaches it. */}
          <div ref={lightRef} aria-hidden="true" className={`${row} pointer-events-none absolute inset-0 ${sizes.row}`} style={{ visibility: measured ? "visible" : "hidden" }}>
            {tabs.map((tab) => (
              <span key={tab.value} className={cell} style={{ color: tab.foreground ?? "var(--primary-foreground)" }}>
                {tab.icon}
                {tab.label}
              </span>
            ))}
          </div>

          {/* The real controls, on top, invisible: their own text keeps the sizes and the names, and their focus ring shows over the highlight. */}
          <div className={`${row} relative [grid-area:1/1]`}>
            {tabs.map((tab) => {
              const on = tab.value === current;
              const shared = {
                "data-liquid-tab": tab.value,
                onPointerMove: (event) => {
                  if (event.pointerType === "mouse" && !tab.disabled && hovered !== tab.value) setHovered(tab.value);
                },
                onPointerLeave: () => setHovered(null),
                className: `${cell} cursor-pointer text-transparent aria-disabled:cursor-default ${INTERACTION_FOCUS} [&_svg]:opacity-0`,
              };
              return tab.href ? (
                <a key={tab.value} {...shared} href={tab.disabled ? undefined : tab.href} aria-current={on ? "page" : undefined} aria-label={tab.ariaLabel} aria-disabled={tab.disabled || undefined} onClick={() => !tab.disabled && pick(tab.value)}>
                  {tab.icon}
                  {tab.label}
                </a>
              ) : (
                <button
                  key={tab.value}
                  {...shared}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={tab.ariaLabel}
                  aria-controls={tab.panelId}
                  aria-disabled={tab.disabled || undefined}
                  tabIndex={on ? 0 : -1}
                  onClick={() => !tab.disabled && pick(tab.value)}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiquidTabs;

// Hairline UI · threshold-line · MIT License
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";;
import * as React from "react";
import { NumberRoll } from "./number-roll";
import { TextMorph } from "./text-morph";
import { createSpring, projectInertia, releaseVelocity, rubberBand, samplePointer } from "./ui-interaction-motion";

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const THROW = "cubic-bezier(0.34,1.36,0.64,1)";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
const HIT = 28; // the grab band around the line, in px
/** The mark: 2px hairlines every 4px, counted up from the baseline. */
const RULE = "repeating-linear-gradient(to top, #000 0 2px, transparent 2px 4px)";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedMotion = () =>
  React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

// Formatting waits for hydration: the server and the hydrating render share one fixed locale, then the visitor's takes over.
const subscribeNothing = () => () => {};
const useHydrated = () => React.useSyncExternalStore(subscribeNothing, () => true, () => false);

function niceMax(value) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= value) return m * step;
  return 10 * step;
}

function niceStep(range) {
  const raw = range / 40;
  const base = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= raw) return m * base;
  return 10 * base;
}

const snap = (v, step, min, max) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

export function ThresholdLine({
  data,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  direction = "above",
  min = 0,
  max,
  step,
  title = "Alert when above the line",
  period = "would have fired in this period",
  label = "Threshold",
  format,
  locales,
  className = "",
  ...props
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const locale = locales ?? (hydrated ? undefined : "en-US");
  const dataMax = Math.max(0, ...data.map((d) => d.value));
  const [own, setOwn] = React.useState(() => defaultValue ?? Math.round(dataMax * 0.7));
  const current = value ?? own;
  const top = max ?? niceMax(Math.max(dataMax, current) * 1.08);
  const unit = step ?? niceStep(top - min);
  const above = direction === "above";

  const [visible, setVisible] = React.useState(false);
  const [firing, setFiring] = React.useState(() => data.map((d) => (above ? d.value > current : d.value < current)));
  const [plotH, setPlotH] = React.useState(160);
  const [dragging, setDragging] = React.useState(false);
  const count = firing.filter(Boolean).length;

  const rootRef = React.useRef(null);
  const plotRef = React.useRef(null);
  const lineRef = React.useRef(null);
  const tagTextRef = React.useRef(null);
  const fillRefs = React.useRef([]);
  const ghostRefs = React.useRef([]);
  const springRef = React.useRef(null);
  const live = React.useRef({ data, top, min, unit, plotH, above, shown: current, firingKey: "", format, locales: locale });
  const callbacks = React.useRef({ onValueChange, onValueCommit, setOwn: (v) => setOwn(v), controlled: value !== undefined });
  // Layout effect, declared first: the paints below must see this render's sizes.
  React.useLayoutEffect(() => {
    live.current = { ...live.current, data, top, min, unit, plotH, above, format, locales: locale };
    callbacks.current = { onValueChange, onValueCommit, setOwn: (v) => setOwn(v), controlled: value !== undefined };
  });

  const fmt = React.useCallback((v) => new Intl.NumberFormat(locale, format).format(v), [format, locale]);

  // One frame: the line, every bar's red part, and the count when the set of firing days changes.
  const paint = React.useCallback(() => {
    const s = springRef.current;
    const L = live.current;
    if (!s) return;
    const v = s.get();
    const h = L.plotH;
    const px = ((v - L.min) / (L.top - L.min)) * h; // the line's height over the baseline
    if (lineRef.current) lineRef.current.style.transform = `translate3d(0,${h - px}px,0)`;
    let key = "";
    for (let i = 0; i < L.data.length; i++) {
      const fill = fillRefs.current[i];
      if (fill) fill.style.transform = L.above ? `translate3d(0,${-px}px,0)` : "none";
      const ghost = ghostRefs.current[i];
      // The shortfall block hangs in a box from the plot's top down to the bar; its top edge rides the line.
      if (ghost) ghost.style.transform = `translate3d(0,${Math.max(0, h - px)}px,0)`;
      key += (L.above ? L.data[i].value > v : L.data[i].value < v) ? "1" : "0";
    }
    if (key !== L.firingKey) {
      L.firingKey = key;
      setFiring(Array.from(key, (c) => c === "1"));
    }
    const shown = snap(v, L.unit, L.min, L.top);
    if (shown !== L.shown) {
      L.shown = shown;
      if (tagTextRef.current) tagTextRef.current.textContent = new Intl.NumberFormat(L.locales, L.format).format(shown);
    }
  }, []);

  React.useEffect(() => {
    const s = createSpring(live.current.shown, { stiffness: 520, damping: 44 }, paint, 0.0005 * (live.current.top - live.current.min));
    springRef.current = s;
    paint();
    return () => {
      s.stop();
      springRef.current = null;
    };
  }, [paint]);

  // A value from outside (controlled, or a key press) moves the line on its spring.
  React.useEffect(() => {
    const s = springRef.current;
    if (!s || dragging) return;
    if (reduced) s.jump(current);
    else s.set(current);
  }, [current, dragging, reduced]);

  React.useLayoutEffect(() => paint(), [paint, plotH, top, data, direction]);

  React.useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setPlotH((p) => (el.offsetHeight === p || !el.offsetHeight ? p : el.offsetHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const settle = React.useCallback((next, commit) => {
    const C = callbacks.current;
    if (!C.controlled) C.setOwn(next);
    C.onValueChange?.(next);
    if (commit) C.onValueCommit?.(next);
  }, []);

  // Dragging: the line follows the hand 1:1, rubber-bands past the ends, and is thrown onto a step when let go.
  const drag = React.useRef(null);
  const toValue = (dy) => {
    const L = live.current;
    return (dy / L.plotH) * (L.top - L.min);
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const s = springRef.current;
    if (!s) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startY: e.clientY, startV: s.get(), samples: [], lastStep: snap(s.get(), unit, min, top) };
    samplePointer(drag.current.samples, e.clientY, e.timeStamp);
    s.jump(s.get());
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    const s = springRef.current;
    if (!d || d.id !== e.pointerId || !s) return;
    samplePointer(d.samples, e.clientY, e.timeStamp);
    const L = live.current;
    let v = d.startV + toValue(d.startY - e.clientY);
    // Past either end the line gives less and less, in pixels so it feels the same at any scale.
    const span = L.top - L.min;
    if (v > L.top) v = L.top + toValue(rubberBand(((v - L.top) / span) * L.plotH, L.plotH));
    if (v < L.min) v = L.min - toValue(rubberBand(((L.min - v) / span) * L.plotH, L.plotH));
    s.jump(v);
    const stepped = snap(v, L.unit, L.min, L.top);
    if (stepped !== d.lastStep) {
      d.lastStep = stepped;
      callbacks.current.onValueChange?.(stepped);
    }
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    const s = springRef.current;
    if (!d || d.id !== e.pointerId || !s) return;
    drag.current = null;
    const L = live.current;
    const vy = -releaseVelocity(d.samples, e.timeStamp); // px per ms, up is positive
    const speed = toValue(vy * 1000); // value per second
    const projected = projectInertia(s.get(), toValue(vy), 0.12);
    const next = snap(projected, L.unit, L.min, L.top);
    if (!reduced) {
      // Keep the throw's speed, but never so much that it slams past the step it is headed for.
      const room = Math.abs(next - s.get()) * 10;
      s.push(Math.sign(speed) * Math.min(Math.abs(speed), room));
      s.set(next);
    } else s.jump(next);
    setDragging(false);
    settle(next, true);
  };

  const onKeyDown = (e) => {
    const moves = {
      ArrowUp: current + unit,
      ArrowRight: current + unit,
      ArrowDown: current - unit,
      ArrowLeft: current - unit,
      PageUp: current + unit * 10,
      PageDown: current - unit * 10,
      Home: min,
      End: top,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = snap(moves[e.key], unit, min, top);
    if (next !== current) settle(next, true);
  };

  const slot = data.length ? 100 / data.length : 100;
  const every = data.length > 16 ? Math.ceil(data.length / 7) : 1;
  const compact = { ...format, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 };

  return (
    <div ref={rootRef} className={`w-full rounded-[22px] bg-background shadow-[0_0_0_1px_var(--border)] ${className}`} {...props}>
      {/* Its natural width where the parent sizes to its content (a centred flex column), without forcing it on narrow screens. */}
      <div aria-hidden="true" data-natural-width className="grid h-0" style={{ gridTemplateColumns: "minmax(0, 600px)" }} />
      <div className="@container w-full">
      <div className="p-4 @md:p-5 [--plot:150px] @md:[--plot:180px] [--gutter:30px] @md:[--gutter:38px]">
        <p className="text-[12px] text-muted-foreground @md:text-[13px]">{title}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5 text-foreground">
          <span className="text-[22px] font-medium leading-tight tracking-[-0.03em] tabular-nums @md:text-[26px]">
            <NumberRoll value={count} duration={700} />
          </span>
          <span className="text-[13px] text-muted-foreground @md:text-[14px]">
            <TextMorph>{count === 1 ? "alert" : "alerts"}</TextMorph>
          </span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground @md:text-[12.5px]">{period}</p>

        <div className="relative mt-4 select-none @md:mt-5" style={{ paddingLeft: "var(--gutter)" }}>
          {/* The scale: top and middle as hairlines with rolling labels. */}
          {[1, 0.5].map((f) => (
            <div key={f} aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: (1 - f) * plotH }}>
              <span
                className="absolute left-0 top-0 -translate-y-1/2 text-right text-[10.5px] tabular-nums leading-none text-muted-foreground/80"
                style={{ width: "calc(var(--gutter) - 8px)" }}
              >
                <NumberRoll value={min + (top - min) * f} format={compact} locales={locale} duration={700} />
              </span>
              <div className="border-t border-dashed border-border" style={{ marginLeft: "var(--gutter)" }} />
            </div>
          ))}

          <div ref={plotRef} className="relative" style={{ height: "var(--plot)" }}>
            {data.map((d, i) => {
              const barH = (Math.max(0, d.value - min) / (top - min)) * plotH;
              const fires = firing[i];
              return (
                <div key={d.key} aria-hidden="true" className="absolute inset-y-0" style={{ left: `${i * slot}%`, width: `${slot}%` }}>
                  {/* The mark: one column of 2px hairlines (a mask counted up from the baseline). Its empty part is the
                      same lines, faint; the bar lights the lines it reaches, and the alert colour lights the lines past the line. */}
                  <div className="absolute inset-y-0 left-1/2 w-[min(18px,64%)] -translate-x-1/2" style={{ maskImage: RULE, WebkitMaskImage: RULE }}>
                    <div className="absolute inset-0 bg-foreground/[0.07]" />
                    {/* Below mode: the shortfall from the bar's top up to the line. */}
                    {!above && (
                      <div className="absolute inset-x-0 top-0 overflow-clip" style={{ bottom: barH, opacity: visible ? 1 : 0, transition: reduced ? "none" : `opacity 300ms ${EASE}` }}>
                        <div
                          ref={(el) => {
                            ghostRefs.current[i] = el;
                          }}
                          className="absolute inset-x-0 top-0 bg-red-500/40 dark:bg-red-400/45"
                          style={{ height: plotH, willChange: "transform" }}
                        />
                      </div>
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0 overflow-clip bg-foreground/[0.3]"
                      style={{
                        height: visible ? Math.max(2, barH) : 0,
                        transition: reduced ? "none" : `height 640ms ${EASE} ${Math.min(i, 30) * 18}ms`,
                      }}
                    >
                      <div
                        ref={(el) => {
                          fillRefs.current[i] = el;
                        }}
                        className="absolute inset-x-0 bottom-0 bg-red-500 dark:bg-red-400"
                        style={{
                          height: above ? plotH : "100%",
                          opacity: above || fires ? 1 : 0,
                          willChange: above ? "transform" : undefined,
                          transition: reduced || above ? "none" : `opacity 220ms ${EASE}`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* The line and its tag: a wide grab band with a 1px line through it. */}
            <div
              ref={lineRef}
              className="absolute inset-x-0 top-0 z-10"
              style={{ height: 0, willChange: "transform", marginLeft: "calc(var(--gutter) * -1)" }}
            >
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="group absolute inset-x-0 flex cursor-ns-resize touch-none items-center"
                style={{ top: -HIT / 2, height: HIT }}
              >
                <div
                  className={`h-px flex-1 transition-colors duration-300 ${count ? "bg-red-500 dark:bg-red-400" : "bg-foreground/55"}`}
                  style={{ marginLeft: "var(--gutter)" }}
                />
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label={label}
                  aria-valuemin={min}
                  aria-valuemax={top}
                  aria-valuenow={current}
                  aria-valuetext={`${fmt(current)}, ${count} ${count === 1 ? "alert" : "alerts"} ${period}`}
                  aria-orientation="vertical"
                  onKeyDown={onKeyDown}
                  className={`flex h-[24px] shrink-0 cursor-ns-resize items-center gap-1.5 rounded-full bg-background pl-2 pr-2.5 text-[11.5px] font-medium tabular-nums text-foreground shadow-[0_0_0_1px_var(--border)] transition-[scale,box-shadow] duration-200 ${FOCUS} ${
                    dragging ? "scale-[1.04]" : "group-hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_30%,var(--border))]"
                  }`}
                  style={{ transitionTimingFunction: EASE }}
                >
                  <svg viewBox="0 0 8 10" aria-hidden="true" className="h-2.5 w-2 text-muted-foreground">
                    <path d="M1 3.5 4 1l3 2.5M1 6.5 4 9l3-2.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span ref={tagTextRef}>{fmt(snap(current, unit, min, top))}</span>
                </div>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="border-t border-border" />
          {/* One dot under each day that would have fired. */}
          <div aria-hidden="true" className="relative h-3">
            {data.map((d, i) => (
              <span
                key={d.key}
                className="absolute top-[5px] size-[5px] -translate-x-1/2 rounded-full bg-red-500 dark:bg-red-400"
                style={{
                  left: `${(i + 0.5) * slot}%`,
                  scale: firing[i] ? "1" : "0",
                  opacity: firing[i] ? 1 : 0,
                  transition: reduced ? "none" : `scale 320ms ${firing[i] ? THROW : EASE}, opacity 200ms ${EASE}`,
                }}
              />
            ))}
          </div>
          <div aria-hidden="true" className="relative h-4">
            {data.map((d, i) =>
              d.tick && (data.length - 1 - i) % every === 0 ? (
                <span
                  key={d.key}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10.5px] leading-4 text-muted-foreground"
                  style={{ left: `clamp(14px, ${(i + 0.5) * slot}%, calc(100% - 14px))` }}
                >
                  {d.tick}
                </span>
              ) : null,
            )}
          </div>
        </div>

        <div className="sr-only"><table>
          <caption>
            {label} at {fmt(current)}: {count} {count === 1 ? "alert" : "alerts"} {period}
          </caption>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>
                  {fmt(d.value)}
                  {firing[i] ? ", would fire" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      </div>
    </div>
  );
}

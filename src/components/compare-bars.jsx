// Hairline UI · compare-bars · MIT License
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";;
import * as React from "react";
import { NumberRoll } from "./number-roll";
import { TextMorph } from "./text-morph";

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const THROW = "cubic-bezier(0.34,1.36,0.64,1)";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
/** The mark: 2px hairlines every 4px, counted up from the baseline. */
const RULE = "repeating-linear-gradient(to top, #000 0 2px, transparent 2px 4px)";
const SPREAD = 0.55; // how much of the move the stagger takes
const HEADROOM = 34;

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

/**
 * Progress that moves at an even pace toward its target (0 or 1) and turns round from wherever it is, so a second
 * press mid-way reverses the move without a jump. Each piece eases its own phase of it; a spring would front-load it.
 */
function createPacer(initial, duration, onFrame) {
  let value = initial;
  let target = initial;
  let frame = 0;
  let last = 0;
  const tick = (now) => {
    const dt = last ? (now - last) / duration : 0;
    last = now;
    value = target > value ? Math.min(target, value + dt) : Math.max(target, value - dt);
    onFrame();
    if (value !== target) frame = requestAnimationFrame(tick);
    else frame = last = 0;
  };
  return {
    get: () => value,
    set(next) {
      target = next;
      if (!frame && value !== target) frame = requestAnimationFrame(tick);
    },
    jump(next) {
      value = target = next;
      if (frame) cancelAnimationFrame(frame);
      frame = last = 0;
      onFrame();
    },
    stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = last = 0;
    },
  };
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function CompareBars({
  data,
  title = "Revenue",
  currentLabel = "This week",
  previousLabel = "Last week",
  compared,
  defaultCompared = false,
  onComparedChange,
  format,
  locales,
  className = "",
  ...props
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const locale = locales ?? (hydrated ? undefined : "en-US");
  const [own, setOwn] = React.useState(defaultCompared);
  const on = compared ?? own;
  const n = data.length;
  const max = niceMax(Math.max(0, ...data.map((d) => Math.max(d.current, d.previous))));
  const total = data.reduce((s, d) => s + d.current, 0);
  const before = data.reduce((s, d) => s + d.previous, 0);
  const change = before ? (total - before) / before : 0;
  const up = change >= 0;

  const [visible, setVisible] = React.useState(false);
  const [active, setActive] = React.useState(null);
  const [keyboard, setKeyboard] = React.useState(false);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  const plotH = Math.max(0, box.height - HEADROOM);

  const rootRef = React.useRef(null);
  const plotRef = React.useRef(null);
  const prevRefs = React.useRef([]);
  const curRefs = React.useRef([]);
  const gainRefs = React.useRef([]);
  const lossRefs = React.useRef([]);
  const springRef = React.useRef(null);
  const origin = React.useRef(n - 1);
  const live = React.useRef({ n, slot: 0, origin: n - 1 });

  // One frame: every pair at its own point of the split, staggered out from where you were.
  const paint = React.useCallback(() => {
    const s = springRef.current;
    if (!s) return;
    const { n: count, slot, origin: from } = live.current;
    if (!slot) return;
    const p = s.get();
    const single = Math.min(22, slot * 0.6);
    const half = Math.min(14, slot * 0.36);
    const gap = 2;
    const far = Math.max(from, count - 1 - from, 1);
    for (let i = 0; i < count; i++) {
      const delay = (Math.abs(i - from) / far) * SPREAD;
      const t = clamp01(p * (1 + SPREAD) - delay);
      const split = ease(clamp01(t / 0.7));
      const fill = ease(clamp01((t - 0.5) / 0.5));
      const width = single + (half - single) * split;
      const sx = width / single;
      const dx = (split * (half + gap)) / 2;
      const prev = prevRefs.current[i];
      const cur = curRefs.current[i];
      if (prev) {
        prev.style.transform = `translate3d(${-dx}px,0,0) scaleX(${sx})`;
        prev.style.opacity = String(clamp01(split * 1.6));
      }
      if (cur) cur.style.transform = `translate3d(${dx}px,0,0) scaleX(${sx})`;
      const gain = gainRefs.current[i];
      if (gain) gain.style.opacity = String(fill);
      const loss = lossRefs.current[i];
      if (loss) loss.style.opacity = String(fill);
    }
  }, []);

  // The spring is made once, where the chart starts; changes are aimed below.
  const startOn = React.useRef(on);
  React.useLayoutEffect(() => {
    const s = createPacer(startOn.current ? 1 : 0, 950, paint);
    springRef.current = s;
    paint();
    return () => {
      s.stop();
      springRef.current = null;
    };
  }, [paint]);

  React.useLayoutEffect(() => {
    live.current = { n, slot: n ? box.width / n : 0, origin: origin.current };
    paint();
  }, [n, box.width, paint, data]);

  React.useEffect(() => {
    const s = springRef.current;
    if (!s) return;
    live.current.origin = origin.current;
    if (reduced) s.jump(on ? 1 : 0);
    else s.set(on ? 1 : 0);
  }, [on, reduced]);

  React.useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setBox((b) => (b.width === el.offsetWidth && b.height === el.offsetHeight ? b : { width: el.offsetWidth, height: el.offsetHeight }));
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

  const toggle = () => {
    // The split starts from the bar you last read, or from the chip's end of the chart.
    origin.current = active ?? n - 1;
    const next = !on;
    if (compared === undefined) setOwn(next);
    onComparedChange?.(next);
  };

  const pointAt = (clientX) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || !n) return null;
    return Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n)));
  };

  const onKeyDown = (e) => {
    if (!n) return;
    const from = active ?? n - 1;
    const moves = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: n - 1 };
    if (e.key === "Escape") return setActive(null);
    if (!(e.key in moves)) return;
    e.preventDefault();
    setKeyboard(true);
    setActive(Math.min(n - 1, Math.max(0, active === null ? from : moves[e.key])));
  };

  const fmt = (v) => new Intl.NumberFormat(locale, format).format(v);
  const pct = (v) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(v);
  const shown = active !== null ? data[active] : null;
  const shownChange = shown && shown.previous ? (shown.current - shown.previous) / shown.previous : 0;
  const slotPct = n ? 100 / n : 100;
  const single = Math.min(22, (box.width / Math.max(1, n)) * 0.6);
  const every = box.width && n ? Math.max(1, Math.ceil(34 / (box.width / n))) : 1;

  return (
    <div ref={rootRef} className={`w-full rounded-[22px] bg-background shadow-[0_0_0_1px_var(--border)] ${className}`} {...props}>
      {/* Its natural width where the parent sizes to its content (a centred flex column), without forcing it on narrow screens. */}
      <div aria-hidden="true" data-natural-width className="grid h-0" style={{ gridTemplateColumns: "minmax(0, 600px)" }} />
      <div className="@container w-full">
      <div className="p-4 @md:p-5 [--plot:150px] @md:[--plot:180px]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground @md:text-[13px]">{title}</p>
          <button
            type="button"
            aria-pressed={on}
            onClick={toggle}
            className={`-my-1 inline-flex h-7 shrink-0 cursor-pointer items-center gap-2 rounded-full pl-2.5 pr-3 text-[12px] font-medium transition-[background-color,color,box-shadow,scale] duration-200 active:scale-[0.97] @md:text-[12.5px] ${FOCUS} ${
              on
                ? "bg-foreground/[0.06] text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_18%,var(--border))]"
                : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:text-foreground"
            }`}
            style={{ transitionTimingFunction: EASE }}
          >
            {/* Two bars that split when it's on: the chip is a small picture of what it does. */}
            <span aria-hidden="true" className="relative h-3 w-3">
              <span
                className="absolute bottom-0 left-1/2 h-2 w-[5px] rounded-t-[1.5px] bg-foreground/30"
                style={{ transform: on ? "translateX(-5px)" : "translateX(-50%)", opacity: on ? 1 : 0, transition: reduced ? "none" : `transform 380ms ${THROW}, opacity 200ms ${EASE}` }}
              />
              <span
                className="absolute bottom-0 left-1/2 h-3 w-[5px] rounded-t-[1.5px]"
                style={{
                  background: "var(--chart-1, var(--primary))",
                  transform: on ? "translateX(0px)" : "translateX(-50%)",
                  transition: reduced ? "none" : `transform 380ms ${THROW}`,
                }}
              />
            </span>
            vs {previousLabel.toLowerCase()}
          </button>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <p className="text-[22px] font-medium leading-tight tracking-[-0.03em] text-foreground tabular-nums @md:text-[26px]">
            <NumberRoll value={visible ? total : 0} format={format} locales={locale} duration={1000} />
          </p>
          {/* The change folds open beside the total while comparing. */}
          <span
            className="grid self-center"
            style={{ gridTemplateColumns: on ? "1fr" : "0fr", opacity: on ? 1 : 0, transition: reduced ? "none" : `grid-template-columns 460ms ${EASE} ${on ? 120 : 0}ms, opacity 260ms ${EASE} ${on ? 200 : 0}ms` }}
          >
            <span className="min-w-0 [clip-path:inset(-4px_-2px)]">
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-[11.5px] font-medium tabular-nums @md:text-[12.5px] ${
                  up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3" style={{ transform: up ? "none" : "rotate(180deg)" }}>
                  <path d="M6 9.5V2.5M2.8 5.6 6 2.5l3.2 3.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <NumberRoll value={on ? Math.abs(change) : 0} format={{ style: "percent", maximumFractionDigits: 1 }} locales={locale} duration={900} />
              </span>
            </span>
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground @md:text-[12.5px]">
          <TextMorph>{on ? `${currentLabel} against ${previousLabel.toLowerCase()}` : currentLabel}</TextMorph>
        </p>

        <div
          ref={plotRef}
          role="group"
          tabIndex={0}
          aria-label={`${title}, ${currentLabel}${on ? ` against ${previousLabel}` : ""}. Use the arrow keys to read each bar.`}
          onKeyDown={onKeyDown}
          onBlur={() => keyboard && (setActive(null), setKeyboard(false))}
          onPointerMove={(e) => {
            if (e.pointerType === "touch" && e.buttons === 0) return;
            setKeyboard(false);
            setActive(pointAt(e.clientX));
          }}
          onPointerDown={(e) => setActive(pointAt(e.clientX))}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          className={`relative mt-4 touch-pan-y select-none rounded-lg @md:mt-5 ${FOCUS}`}
          style={{ height: `calc(var(--plot) + ${HEADROOM}px)` }}
        >
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: HEADROOM }} />
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: HEADROOM + plotH / 2 }} />
          {data.map((d, i) => {
            const hc = (Math.max(0, d.current) / max) * plotH;
            const hp = (Math.max(0, d.previous) / max) * plotH;
            const gained = d.current > d.previous;
            const dim = active !== null && active !== i;
            return (
              <div
                key={d.key}
                aria-hidden="true"
                className="absolute inset-y-0"
                style={{ left: `${i * slotPct}%`, width: `${slotPct}%`, opacity: dim ? 0.55 : 1, transition: reduced ? "none" : `opacity 200ms ${EASE}` }}
              >
                <div className="absolute inset-x-0 bottom-0 overflow-clip" style={{ height: visible ? plotH : 0, transition: reduced ? "none" : `height 640ms ${EASE} ${Math.min(i, 14) * 30}ms` }}>
                  {/* The mark: each bar is a full-height column of 2px hairlines (a mask counted up from the baseline),
                      faint where it's empty and lit as far as its value. Last period waits behind this one. */}
                  <div
                    ref={(el) => {
                      prevRefs.current[i] = el;
                    }}
                    className="absolute bottom-0 left-1/2 origin-bottom"
                    style={{ width: single, marginLeft: -single / 2, height: plotH, maskImage: RULE, WebkitMaskImage: RULE, willChange: "transform" }}
                  >
                    <div className="absolute inset-0 bg-foreground/[0.06]" />
                    <div className="absolute inset-x-0 bottom-0 bg-foreground/[0.28]" style={{ height: Math.max(2, hp) }} />
                  </div>
                  {/* This period: the part over last period lights green; a shortfall lights the lines up to where last period reached, in red. */}
                  <div
                    ref={(el) => {
                      curRefs.current[i] = el;
                    }}
                    className="absolute bottom-0 left-1/2"
                    style={{ width: single, marginLeft: -single / 2, height: plotH, maskImage: RULE, WebkitMaskImage: RULE, willChange: "transform" }}
                  >
                    <div className="absolute inset-0 bg-foreground/[0.06]" />
                    {!gained && hp - hc > 0.5 && (
                      <div
                        ref={(el) => {
                          lossRefs.current[i] = el;
                        }}
                        className="absolute inset-x-0 bg-red-500/45 dark:bg-red-400/50"
                        style={{ bottom: hc, height: hp - hc, opacity: 0 }}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 overflow-clip" style={{ height: Math.max(2, hc), background: "var(--chart-1, var(--primary))" }}>
                      {gained && (
                        <div
                          ref={(el) => {
                            gainRefs.current[i] = el;
                          }}
                          className="absolute inset-x-0 top-0 bg-emerald-500 dark:bg-emerald-400"
                          style={{ height: Math.max(0, hc - hp), opacity: 0 }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] leading-4 text-muted-foreground"
                  style={{ opacity: (n - 1 - i) % every === 0 ? 1 : 0 }}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-border" />

          {/* The readout: this period, and when comparing, the one before and the change. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 flex h-[24px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-2.5 text-[11.5px] shadow-[0_0_0_1px_var(--border)]"
            style={{
              left: active !== null ? `clamp(90px, ${(active + 0.5) * slotPct}%, calc(100% - 90px))` : "50%",
              opacity: shown ? 1 : 0,
              scale: shown ? "1" : "0.94",
              transition: reduced ? "none" : `left 380ms ${THROW}, opacity 200ms ${EASE}, scale 260ms ${EASE}`,
            }}
          >
            <span className="text-muted-foreground">
              {shown ? (shown.title ?? shown.label) : " "}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {shown ? fmt(shown.current) : " "}
            </span>
            <span
              className="grid"
              style={{ gridTemplateColumns: on ? "1fr" : "0fr", opacity: on ? 1 : 0, transition: reduced ? "none" : `grid-template-columns 380ms ${EASE}, opacity 220ms ${EASE}` }}
            >
              <span className="flex min-w-0 items-center gap-1.5 [clip-path:inset(-4px_-2px)]">
                <span className="pl-0.5 text-muted-foreground">vs</span>
                <span className="tabular-nums text-muted-foreground">
                  {shown ? fmt(shown.previous) : " "}
                </span>
                <span className={`font-medium tabular-nums ${shownChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {pct(shownChange)}
                </span>
              </span>
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="h-5" />

        <p aria-live="polite" className="sr-only">
          {keyboard && shown ? `${shown.title ?? shown.label}: ${fmt(shown.current)}${on ? `, ${previousLabel} ${fmt(shown.previous)}, ${pct(shownChange)}` : ""}` : ""}
        </p>
        <div className="sr-only"><table>
          <caption>
            {title}: {currentLabel} {fmt(total)}, {previousLabel} {fmt(before)}, {pct(change)}
          </caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{currentLabel}</th>
              <th scope="col">{previousLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.title ?? d.label}</th>
                <td>{fmt(d.current)}</td>
                <td>{fmt(d.previous)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      </div>
    </div>
  );
}

// Hairline UI · diff-review · MIT License
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";;
import * as React from "react";
import { X } from "lucide-react";
import { NumberRoll } from "./number-roll";
import { TextMorph } from "./text-morph";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
const SMALL = `inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors ${FOCUS}`;
const MORPH = "cubic-bezier(0.16,1,0.3,1)";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedMotion = () =>
  React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

/** A piece of a line that opens out of nothing and folds back into it. */
function Reveal({
  show,
  reduced,
  className = "",
  children
}) {
  return (
    <span
      aria-hidden={!show || undefined}
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        filter: show ? "none" : "blur(3px)",
        transition: reduced ? "none" : `grid-template-columns 420ms ${MORPH}, opacity ${show ? "300ms" : "160ms"} ${MORPH}, filter 300ms ${MORPH}`,
      }}
    >
      <span className="flex min-w-0 items-center whitespace-nowrap [clip-path:inset(-4px)]">{children}</span>
    </span>
  );
}

function DrawnCheck({
  drawn,
  reduced
}) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ strokeDashoffset: drawn ? 0 : 1, transition: drawn && !reduced ? `stroke-dashoffset 420ms ${MORPH} 120ms` : "none" }}
      />
    </svg>
  );
}

/** Longest-common-subsequence diff over tokens; falls back to a full replace for very large inputs. */
function diff(a, b) {
  if (a.length * b.length > 250_000) {
    return [...a.map((text) => ({ kind: "remove", text })), ...b.map((text) => ({ kind: "add", text }))];
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ kind: "remove", text: a[i++] });
    else ops.push({ kind: "add", text: b[j++] });
  }
  while (i < a.length) ops.push({ kind: "remove", text: a[i++] });
  while (j < b.length) ops.push({ kind: "add", text: b[j++] });
  return ops;
}

/** Group ops into unchanged runs and change runs (everything removed, then everything added). */
function toRuns(ops) {
  const runs = [];
  for (const op of ops) {
    const last = runs[runs.length - 1];
    if (op.kind === "same") {
      if (last?.kind === "same") last.tokens.push(op.text);
      else runs.push({ kind: "same", tokens: [op.text] });
    } else {
      let run = last;
      if (run?.kind !== "change") {
        run = { kind: "change", removed: [], added: [] };
        runs.push(run);
      }
      (op.kind === "remove" ? run.removed : run.added).push(op.text);
    }
  }
  return runs;
}

/** Fold short unchanged bits ("to", a space) between two changes into them, so a rewrite reads as one phrase. */
function absorbSmall(runs) {
  const out = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const prev = out[out.length - 1];
    const next = runs[i + 1];
    if (run.kind === "same" && prev?.kind === "change" && next?.kind === "change" && run.tokens.join("").trim().length <= 3) {
      prev.removed.push(...run.tokens, ...next.removed);
      prev.added.push(...run.tokens, ...next.added);
      i++;
    } else if (run.kind === "change" && prev?.kind === "change") {
      prev.removed.push(...run.removed);
      prev.added.push(...run.added);
    } else out.push(run.kind === "same" ? { kind: "same", tokens: [...run.tokens] } : { kind: "change", removed: [...run.removed], added: [...run.added] });
  }
  return out;
}

const words = (s) => s.split(/(\s+|[.,;:!?()"“”])/).filter(Boolean);
const lines = (s) => s.split("\n");

/** Words that leave shrink out of the sentence (their font size eases to nothing, so the line closes up around them). */
const gone = (out, reduced) => ({
  fontSize: out ? 0 : undefined,
  opacity: out ? 0 : 1,
  transition: reduced ? "none" : `font-size 460ms ${MORPH}, opacity 220ms ${MORPH}, background-color 300ms, color 300ms, text-decoration-color 300ms, margin 460ms ${MORPH}`
});

function InlineDiff({
  before,
  after,
  decision,
  reduced
}) {
  const runs = React.useMemo(() => absorbSmall(toRuns(diff(words(before), words(after)))), [before, after]);
  const pending = decision === "pending";
  return (
    <p className={`text-[13.5px] leading-relaxed transition-colors duration-300 ${decision === "rejected" ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
      {runs.map((run, i) =>
        run.kind === "same" ? (
          <React.Fragment key={i}>{run.tokens.join("")}</React.Fragment>
        ) : (
          <React.Fragment key={i}>
            {run.removed.length > 0 && (
              <del
                aria-hidden={decision === "accepted" || undefined}
                className={`line-through text-rose-600 dark:text-rose-200 bg-rose-50/80 dark:bg-rose-950/50 px-1 rounded ${pending ? "decoration-rose-500/80" : "bg-transparent text-inherit decoration-transparent no-underline"}`}
                style={gone(decision === "accepted", reduced)}
              >
                {run.removed.join("")}
              </del>
            )}
            {run.added.length > 0 && (
              <ins
                aria-hidden={decision === "rejected" || undefined}
                className={`no-underline text-emerald-700 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded font-medium ${pending ? "" : "bg-transparent text-inherit"}`}
                style={{ ...gone(decision === "rejected", reduced), marginLeft: pending && run.removed.length > 0 ? 2 : 0 }}
              >
                {run.added.join("")}
              </ins>
            )}
          </React.Fragment>
        )
      )}
    </p>
  );
}

function LineDiff({
  before,
  after,
  decision,
  reduced
}) {
  const ops = React.useMemo(
    () =>
      toRuns(diff(lines(before), lines(after))).flatMap(run => run.kind === "same"
        ? run.tokens.map((text) => ({ kind: "same", text }))
        : [...run.removed.map((text) => ({ kind: "remove", text })), ...run.added.map((text) => ({ kind: "add", text }))]
      ),
    [before, after]
  );
  const pending = decision === "pending";
  return (
    <pre className={`overflow-x-auto font-mono text-[12px] leading-5 transition-colors duration-300 ${decision === "rejected" ? "text-muted-foreground" : "text-foreground"}`}>
      {ops.map((op, i) => {
        // Lines that don't survive the decision fold shut; the ones that do lose their tint and gutter.
        const out = (op.kind === "remove" && decision === "accepted") || (op.kind === "add" && decision === "rejected");
        const tint = pending && op.kind !== "same";
        return (
          <span
            key={i}
            aria-hidden={out || undefined}
            className="grid"
            style={{ gridTemplateRows: out ? "0fr" : "1fr", opacity: out ? 0 : 1, transition: reduced ? "none" : `grid-template-rows 420ms ${MORPH}, opacity 200ms ${MORPH}` }}
          >
            <span
              className={`flex min-h-0 overflow-hidden transition-colors duration-300 ${
                tint ? (op.kind === "add" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400") : ""
              }`}
            >
              <span aria-hidden="true" className="w-5 shrink-0 select-none pl-1.5 text-muted-foreground transition-opacity duration-300" style={{ opacity: tint ? 1 : 0 }}>
                {op.kind === "add" ? "+" : op.kind === "remove" ? "−" : " "}
              </span>
              <span className="pr-3">{op.text || " "}</span>
              {pending && <span className="sr-only">{op.kind === "add" ? " (added)" : op.kind === "remove" ? " (removed)" : ""}</span>}
            </span>
          </span>
        );
      })}
    </pre>
  );
}

export function DiffReview({
  changes,
  mode = "words",
  decisions,
  defaultDecisions = {},
  onDecisionsChange,
  onDecisionChange,
  onComplete,
  readOnly = false,
  title = "Suggested changes",
  className = "",
  ...props
}) {
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState(defaultDecisions);
  const current = decisions ?? own;
  // Where focus goes after a decision: the button that just folded away hands it to the one that took its place.
  const buttons = React.useRef(new Map());
  const focusNext = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!focusNext.current) return;
    buttons.current.get(focusNext.current)?.focus({ preventScroll: true });
    focusNext.current = null;
  });
  const registerButton = React.useCallback((key, el) => {
    buttons.current.set(key, el);
  }, []);
  const decisionOf = (id) => current[id] ?? "pending";

  const commit = (ids, decision) => {
    const next = { ...current, ...Object.fromEntries(ids.map((id) => [id, decision])) };
    if (decisions === undefined) setOwn(next);
    onDecisionsChange?.(next);
    ids.forEach((id) => onDecisionChange?.(id, decision));
    if (decision !== "pending" && changes.every((c) => (next[c.id] ?? "pending") !== "pending")) onComplete?.(next);
  };
  const decide = (id, decision) => {
    const hadFocus = [...buttons.current.entries()].some(([key, el]) => key.startsWith(`${id}:`) && el === document.activeElement);
    if (hadFocus) focusNext.current = decision === "pending" ? `${id}:${decisionOf(id) === "rejected" ? "reject" : "accept"}` : `${id}:undo`;
    commit([id], decision);
  };
  const decideAll = (decision) =>
    commit(changes.filter((c) => decisionOf(c.id) === "pending").map((c) => c.id), decision);

  const pending = changes.filter((c) => decisionOf(c.id) === "pending").length;
  const accepted = changes.filter((c) => decisionOf(c.id) === "accepted").length;

  return (
    <div className={`w-full ${className}`} {...props}>
      <div className="mb-3 flex min-h-7 flex-wrap items-center justify-between gap-2">
        <p className="flex items-baseline gap-[0.3em] text-[13px] font-medium text-[var(--text-primary)]">
          {title}
          {/* "3 to review" → "2 of 3 accepted": the count rolls and the words morph. */}
          <span aria-hidden="true" className="inline-flex items-baseline font-normal tabular-nums text-[var(--text-muted)]">
            <NumberRoll value={pending > 0 ? pending : accepted} duration={600} />
            <Reveal show={pending === 0} reduced={reduced}>
              &nbsp;of&nbsp;
              <NumberRoll value={changes.length} duration={600} />
            </Reveal>
            &nbsp;
            <TextMorph>{pending > 0 ? "to review" : "accepted"}</TextMorph>
          </span>
          <span role="status" aria-live="polite" className="sr-only">
            {pending > 0 ? `${pending} to review` : `${accepted} of ${changes.length} accepted`}
          </span>
        </p>
        {!readOnly && (
          <Reveal show={pending > 1} reduced={reduced}>
            <span className="flex gap-1 p-0.5">
              <button type="button" inert={pending < 2} onClick={() => decideAll("rejected")} className={`cursor-pointer ${SMALL} text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]`}>
                Reject all
              </button>
              <button type="button" inert={pending < 2} onClick={() => decideAll("accepted")} className={`cursor-pointer ${SMALL} bg-primary text-primary-foreground hover:bg-primary/90`}>
                Accept all
              </button>
            </span>
          </Reveal>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {changes.map((change) => {
          const decision = decisionOf(change.id);
          const open = decision === "pending" && !readOnly;
          const name = change.label ?? "change";
          return (
            <li key={change.id} className={`overflow-hidden rounded-xl bg-[var(--surface-card)] border transition-colors duration-300 ${decision === "pending" ? "border-[var(--border-default)]" : "border-[var(--border-default)]/60"}`}>
              <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--border-default)]/60 py-1 pl-3 pr-1.5">
                <span className="truncate text-[11.5px] text-[var(--text-muted)]">{change.label ?? "Change"}</span>
                {/* The button you press becomes the answer: "Accept" morphs to "Accepted" while the other folds away. */}
                <span className="flex shrink-0 items-center">
                  <Reveal show={decision === "rejected" || open} reduced={reduced}>
                    <span className="block p-0.5">
                      <button
                        ref={(el) => registerButton(`${change.id}:reject`, el)}
                        type="button"
                        inert={!open}
                        aria-label={`Reject ${name}`}
                        onClick={() => decide(change.id, "rejected")}
                        className={`cursor-pointer ${SMALL} ${open ? "text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
                      >
                        <X aria-hidden="true" className="size-3.5" />
                        <TextMorph>{decision === "rejected" ? "Rejected" : "Reject"}</TextMorph>
                      </button>
                    </span>
                  </Reveal>
                  <Reveal show={decision === "accepted" || open} reduced={reduced}>
                    <span className="block p-0.5">
                      <button
                        ref={(el) => registerButton(`${change.id}:accept`, el)}
                        type="button"
                        inert={!open}
                        aria-label={`Accept ${name}`}
                        onClick={() => decide(change.id, "accepted")}
                        className={`cursor-pointer ${SMALL} ${open ? "text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]" : "text-emerald-600 dark:text-emerald-400"}`}
                      >
                        <span aria-hidden="true" className="relative flex size-3.5 items-center justify-center">
                          {/* The plain check fades as a green one draws itself over it. */}
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className="absolute size-3.5"
                            style={{ opacity: open ? 1 : 0, transition: reduced ? "none" : `opacity 200ms ${MORPH}` }}
                          >
                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <DrawnCheck drawn={decision === "accepted"} reduced={reduced} />
                          </span>
                        </span>
                        <TextMorph>{decision === "accepted" ? "Accepted" : "Accept"}</TextMorph>
                      </button>
                    </span>
                  </Reveal>
                  {!readOnly && (
                    <Reveal show={decision !== "pending"} reduced={reduced}>
                      <span className="block p-0.5 pl-1.5">
                        <button
                          ref={(el) => registerButton(`${change.id}:undo`, el)}
                          type="button"
                          inert={decision === "pending"}
                          onClick={() => decide(change.id, "pending")}
                          className={`cursor-pointer rounded px-1 text-[12px] font-medium text-[var(--text-primary)] underline decoration-[var(--border-default)] underline-offset-2 hover:decoration-[var(--text-primary)] ${FOCUS}`}
                        >
                          Undo
                        </button>
                      </span>
                    </Reveal>
                  )}
                </span>
              </div>
              <div className={mode === "lines" ? "py-2" : "px-3 py-2.5"}>
                {mode === "lines" ? (
                  <LineDiff before={change.before} after={change.after} decision={decision} reduced={reduced} />
                ) : (
                  <InlineDiff before={change.before} after={change.after} decision={decision} reduced={reduced} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

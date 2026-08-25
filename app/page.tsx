"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Trash2, StickyNote, Check } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

const ROOMS = ["Kitchen", "Bathroom", "Lounge", "Bedroom", "Guest Bedroom", "Office", "Conservatory", "Hallway", "Garden", "General"] as const;
const ROOM_CHIPS = ["All", ...ROOMS] as const;

const NAMES = { you: "Tom", partner: "Rosie" } as const;
const TOM = "#3b82f6";
const ROSIE = "#ec4899";
const GRAD = "linear-gradient(135deg,#3b82f6,#ec4899)";

type Assignee = "you" | "partner" | "both";
type PersonFilter = "all" | "you" | "partner" | "both";
type Tab = "rota" | "history";

type Task = {
  id: number;
  title: string;
  room: string;
  assignee: Assignee;
  notes: string;
  /** Set when completed this week; archived to history on weekly reset. */
  completedAt: number | null;
};

type HistoryEntry = {
  /** Unique key so the same chore can appear more than once over time. */
  key: string;
  title: string;
  room: string;
  assignee: Assignee;
  completedAt: number;
};

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysUntilReset() {
  const now = new Date();
  const next = startOfWeek();
  next.setDate(next.getDate() + 7);
  const ms = next.getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

/** British short date, e.g. 27/07/2025 */
function formatCompletedDate(ms: number) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function assigneeName(a: Assignee) {
  if (a === "both") return "Both";
  return NAMES[a];
}

const seedTasks: Task[] = [
  { id: 1, title: "Hoover downstairs", room: "Lounge", assignee: "you", notes: "Don't forget under the sofa cushions.", completedAt: null },
  { id: 2, title: "Clean the hob", room: "Kitchen", assignee: "partner", notes: "", completedAt: null },
  { id: 3, title: "Bins out", room: "General", assignee: "both", notes: "Recycling is fortnightly.", completedAt: null },
  { id: 4, title: "Change bedsheets", room: "Bedroom", assignee: "you", notes: "", completedAt: Date.now() },
  { id: 5, title: "Water the plants", room: "Garden", assignee: "partner", notes: "", completedAt: null },
  { id: 6, title: "Wipe bathroom mirror & sink", room: "Bathroom", assignee: "both", notes: "", completedAt: null },
  { id: 7, title: "Stack the dishwasher", room: "Kitchen", assignee: "you", notes: "", completedAt: null },
  { id: 8, title: "Tidy the sofa cushions", room: "Lounge", assignee: "partner", notes: "", completedAt: null },
];

/** Migrate older room/title strings from persisted state. Drop unused dueAt. */
function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => {
    const { dueAt: _dueAt, ...rest } = t as Task & { dueAt?: unknown };
    return {
      ...rest,
      room: rest.room === "Living Room" ? "Lounge" : rest.room,
      title: rest.title === "Load the dishwasher" ? "Stack the dishwasher" : rest.title,
    };
  });
}

function useSharedState<T>(key: string, initial: T, pausedRef: React.MutableRefObject<boolean>) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const skipNextPush = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/state?key=${key}`);
        const data = await res.json();
        if (!cancelled && data !== null) {
          skipNextPush.current = true;
          setValue(data);
        }
      } catch {}
      if (!cancelled) setLoaded(true);
    }

    load();
    const interval = setInterval(() => {
      if (!pausedRef.current) load();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    fetch(`/api/state?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loaded, key]);

  return [value, setValue, loaded] as const;
}

function ProgressRing({
  pct,
  color,
  size = 56,
  stroke = 5,
}: {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .45s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[12px] font-semibold text-[var(--text)]">{pct}%</span>
      </div>
    </div>
  );
}

function ScoreCard({
  name,
  color,
  pct,
  label,
}: {
  name: string;
  color: string;
  pct: number;
  label: string;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-3 rounded-[18px] p-[13px]"
      style={{ background: "var(--raised)", boxShadow: "var(--card-shadow)" }}
    >
      <ProgressRing pct={pct} color={color} />
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-[var(--text)]">{name}</div>
        <div className="mt-0.5 text-[11.5px] font-normal text-[var(--muted)]">{label}</div>
      </div>
    </div>
  );
}

function AvatarButton({
  assignee,
  done,
  onClick,
}: {
  assignee: Assignee;
  done: boolean;
  onClick?: () => void;
}) {
  const letter = assignee === "both" ? "B" : assignee === "you" ? "T" : "R";
  const bg = assignee === "you" ? TOM : assignee === "partner" ? ROSIE : GRAD;
  const className =
    "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white";
  const style = { background: bg, opacity: done ? 0.45 : 1 };

  if (!onClick) {
    return (
      <div className={className} style={style} title={assigneeName(assignee)}>
        {letter}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={className}
      style={style}
      title={assigneeName(assignee)}
      aria-label={`Reassign (${letter})`}
    >
      {letter}
    </button>
  );
}

function Checkbox({
  done,
  onClick,
}: {
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
      style={
        done
          ? { background: GRAD, border: 0, color: "#fff" }
          : {
              background: "var(--checkbox-bg)",
              border: "1.5px solid var(--checkbox-border)",
              color: "transparent",
            }
      }
      aria-label={done ? "Mark incomplete" : "Mark done"}
    >
      {done ? "✓" : ""}
    </button>
  );
}

function ChoreRow({
  task,
  done,
  onToggle,
  onCycle,
  onDelete,
  onOpenNotes,
}: {
  task: Task;
  done: boolean;
  onToggle: () => void;
  onCycle: () => void;
  onDelete?: () => void;
  onOpenNotes?: () => void;
}) {
  const x = useMotionValue(0);
  const greenOpacity = useTransform(x, [0, 170], [0, 1]);
  const redOpacity = useTransform(x, [-170, 0], [1, 0]);
  const THRESHOLD = 150;

  function handleDragEnd(_e: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -THRESHOLD && onDelete) {
      animate(x, -500, {
        duration: 0.25,
        ease: "easeIn",
        onComplete: () => onDelete(),
      });
    } else if (info.offset.x > THRESHOLD) {
      onToggle();
      animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
    }
  }

  return (
    <motion.div layout="position" className="relative mb-2" style={{ touchAction: "pan-y" }}>
      <motion.div
        className="absolute inset-0 flex items-center rounded-2xl bg-green-500 px-5"
        style={{ opacity: greenOpacity }}
      >
        <Check size={20} color="white" strokeWidth={3} />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-end rounded-2xl bg-red-500 px-5"
        style={{ opacity: redOpacity }}
      >
        <Trash2 size={20} color="white" />
      </motion.div>

      <motion.div
        drag="x"
        dragElastic={0.85}
        dragConstraints={{ left: -320, right: 320 }}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 26 }}
        style={{
          x,
          background: "var(--row)",
          boxShadow: "var(--card-shadow)",
        }}
        onDragEnd={handleDragEnd}
        className="relative z-10 flex min-h-[56px] cursor-grab items-center gap-[13px] rounded-2xl px-[15px] py-[13px] active:cursor-grabbing"
      >
        <Checkbox done={done} onClick={onToggle} />
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 cursor-pointer text-left">
          <div
            className="truncate text-[15px] font-medium"
            style={{
              color: done ? "var(--disabled)" : "var(--text)",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </div>
          {done && (
            <div className="mt-[3px] text-[11.5px] font-normal text-[var(--due-done)]">Done</div>
          )}
        </button>
        {task.notes && onOpenNotes && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotes();
            }}
            className="shrink-0 text-[var(--dim)]"
            aria-label="Notes"
          >
            <StickyNote size={15} />
          </button>
        )}
        <AvatarButton assignee={task.assignee} done={done} onClick={onCycle} />
      </motion.div>
    </motion.div>
  );
}

export default function ChoreApp() {
  const [showAdd, setShowAdd] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<Tab>("rota");

  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = showAdd || !!activeTask;
  }, [showAdd, activeTask]);

  const [tasks, setTasks, tasksLoaded] = useSharedState<Task[]>("tasks", seedTasks, pausedRef);
  const [history, setHistory, historyLoaded] = useSharedState<HistoryEntry[]>("history", [], pausedRef);

  // One-shot migration for older persisted room/title/due fields.
  useEffect(() => {
    const needs = tasks.some(
      (t) => t.room === "Living Room" || t.title === "Load the dishwasher" || "dueAt" in t
    );
    if (!needs) return;
    setTasks(normalizeTasks(tasks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const [roomFilter, setRoomFilter] = useState("All");
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");
  const [form, setForm] = useState({
    title: "",
    room: "Kitchen" as string,
    assignee: "you" as Assignee,
  });

  // Soft weekly boundary: done this week stays ticked; incomplete jobs carry over.
  // On reset, completed jobs leave the rota and are written to history.
  const weekStart = useMemo(() => startOfWeek().getTime(), []);
  const isDone = (t: Task) => !!(t.completedAt && t.completedAt >= weekStart);

  useEffect(() => {
    if (!tasksLoaded || !historyLoaded) return;
    const toArchive = tasks.filter((t) => t.completedAt != null && t.completedAt < weekStart);
    if (toArchive.length === 0) return;

    setTasks((ts) => ts.filter((t) => !(t.completedAt != null && t.completedAt < weekStart)));
    setHistory((h) => {
      const existing = new Set(h.map((e) => e.key));
      const additions: HistoryEntry[] = toArchive
        .filter((t): t is Task & { completedAt: number } => t.completedAt != null)
        .map((t) => ({
          key: `${t.id}-${t.completedAt}`,
          title: t.title,
          room: t.room,
          assignee: t.assignee,
          completedAt: t.completedAt,
        }))
        .filter((e) => !existing.has(e.key));
      if (additions.length === 0) return h;
      return [...additions, ...h].sort((a, b) => b.completedAt - a.completedAt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tasksLoaded, historyLoaded, weekStart]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (roomFilter !== "All" && t.room !== roomFilter) return false;
      if (personFilter === "all") return true;
      if (personFilter === "both") return t.assignee === "both";
      return t.assignee === personFilter;
    });
  }, [tasks, roomFilter, personFilter]);

  const grouped = useMemo(() => {
    const groups: { room: string; items: Task[] }[] = [];
    for (const room of ROOMS) {
      const items = filtered.filter((t) => t.room === room);
      if (items.length) {
        items.sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
        groups.push({ room, items });
      }
    }
    const known = new Set<string>(ROOMS);
    const extras = Array.from(new Set(filtered.map((t) => t.room).filter((r) => !known.has(r))));
    for (const room of extras) {
      const items = filtered.filter((t) => t.room === room);
      items.sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
      groups.push({ room, items });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, weekStart]);

  const stats = useMemo(() => {
    const mine = (who: "you" | "partner") =>
      tasks.filter((t) => t.assignee === who || t.assignee === "both");
    const tom = mine("you");
    const rosie = mine("partner");
    const pct = (list: Task[]) =>
      list.length ? Math.round((list.filter(isDone).length / list.length) * 100) : 0;
    return {
      tomPct: pct(tom),
      rosiePct: pct(rosie),
      tomLabel: `${tom.filter(isDone).length} of ${tom.length} done`,
      rosieLabel: `${rosie.filter(isDone).length} of ${rosie.length} done`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, weekStart]);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.completedAt - a.completedAt),
    [history]
  );

  function toggleDone(id: number) {
    setTasks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, completedAt: isDone(t) ? null : Date.now() } : t))
    );
  }

  function cycleAssignee(id: number) {
    const next: Record<Assignee, Assignee> = {
      you: "partner",
      partner: "both",
      both: "you",
    };
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, assignee: next[t.assignee] } : t)));
  }

  function addTask() {
    const title = form.title.trim();
    if (!title) {
      setShowAdd(false);
      return;
    }
    setTasks((ts) => [
      ...ts,
      {
        id: Date.now(),
        title,
        room: form.room,
        assignee: form.assignee,
        notes: "",
        completedAt: null,
      },
    ]);
    setForm({ title: "", room: form.room, assignee: "you" });
    setShowAdd(false);
  }

  function deleteTask(id: number) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setActiveTask((a) => (a && a.id === id ? null : a));
  }

  function saveActiveTask(patch: Partial<Task>) {
    setTasks((ts) => ts.map((t) => (t.id === activeTask!.id ? { ...t, ...patch } : t)));
    setActiveTask((a) => (a ? { ...a, ...patch } : a));
  }

  const personTabs: { key: PersonFilter; label: string }[] = [
    { key: "all", label: "Everyone" },
    { key: "you", label: NAMES.you },
    { key: "partner", label: NAMES.partner },
    { key: "both", label: "Both" },
  ];

  const whoColors: Record<Assignee, string> = {
    you: TOM,
    partner: ROSIE,
    both: GRAD,
  };

  return (
    <div className="flex min-h-screen w-full justify-center bg-[var(--bg)] text-[var(--text)] selection:bg-blue-500/20">
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--bg)]">
        {tab === "rota" ? (
          <div className="flex-1 overflow-y-auto pb-[120px]">
            {/* Header */}
            <div className="px-[22px] pb-[26px] pt-[58px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                    {NAMES.you} & {NAMES.partner}
                  </div>
                  <h1 className="mt-[7px] text-[32px] font-bold tracking-[-0.025em] text-[var(--title)]">
                    Jobs
                  </h1>
                </div>
                <div
                  className="mt-1 shrink-0 rounded-full px-[11px] py-[6px] text-[11.5px] font-medium"
                  style={{ background: "var(--pill)", color: "var(--reset-pill-text)" }}
                >
                  Resets in {daysUntilReset()}d
                </div>
              </div>

              <div className="mt-[22px] flex gap-3">
                <ScoreCard name={NAMES.you} color={TOM} pct={stats.tomPct} label={stats.tomLabel} />
                <ScoreCard
                  name={NAMES.partner}
                  color={ROSIE}
                  pct={stats.rosiePct}
                  label={stats.rosieLabel}
                />
              </div>
            </div>

            {/* Person tabs */}
            <div
              className="sticky top-0 z-10 flex gap-1.5 px-[22px] pb-3 pt-[18px]"
              style={{ background: "var(--bg)" }}
            >
              {personTabs.map(({ key, label }) => {
                const active = personFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPersonFilter(key)}
                    className="flex-1 rounded-[11px] px-1 py-[9px] text-[12.5px]"
                    style={{
                      fontWeight: active ? 600 : 500,
                      color: active ? "var(--text)" : "var(--muted)",
                      background: active ? "var(--tab-active)" : "var(--tab-idle)",
                      boxShadow: active ? "var(--tab-shadow)" : "none",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Room chips */}
            <div className="no-scrollbar flex gap-[7px] overflow-x-auto px-[22px] pb-2">
              {ROOM_CHIPS.map((r) => {
                const active = roomFilter === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoomFilter(r)}
                    className="shrink-0 whitespace-nowrap rounded-full px-[14px] py-2 text-[12.5px] font-medium"
                    style={{
                      background: active ? "var(--chip-active-bg)" : "var(--chip-idle-bg)",
                      color: active ? "var(--chip-active-text)" : "var(--chip-idle-text)",
                      border: `1px solid ${active ? "transparent" : "var(--chip-border)"}`,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Room groups */}
            <div className="flex flex-col gap-[26px] px-[22px] pb-8 pt-[14px]">
              {grouped.length === 0 && (
                <div className="px-5 py-12 text-center text-[14px] text-[var(--muted)]">
                  Nothing here. Nice work.
                </div>
              )}

              {grouped.map(({ room, items }) => {
                const doneCount = items.filter(isDone).length;
                return (
                  <div key={room}>
                    <div className="mb-1.5 flex items-baseline gap-[9px] px-0.5">
                      <span className="text-[13px] font-semibold text-[var(--text)]">{room}</span>
                      <span className="text-[11.5px] font-medium text-[var(--dim)]">
                        {doneCount}/{items.length}
                      </span>
                    </div>
                    {items.map((t) => (
                      <ChoreRow
                        key={t.id}
                        task={t}
                        done={isDone(t)}
                        onToggle={() => toggleDone(t.id)}
                        onCycle={() => cycleAssignee(t.id)}
                        onDelete={() => deleteTask(t.id)}
                        onOpenNotes={() => setActiveTask(t)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-[22px] pb-[120px] pt-[58px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              {NAMES.you} & {NAMES.partner}
            </div>
            <h1 className="mt-[7px] text-[32px] font-bold tracking-[-0.025em] text-[var(--title)]">
              History
            </h1>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Completed jobs after each weekly reset.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {sortedHistory.length === 0 && (
                <div className="py-12 text-center text-[14px] text-[var(--muted)]">
                  Nothing logged yet. Done jobs appear here after the weekly reset.
                </div>
              )}
              {sortedHistory.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center gap-3 rounded-2xl px-[15px] py-[13px]"
                  style={{ background: "var(--row)", boxShadow: "var(--card-shadow)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium text-[var(--text)]">
                      {entry.title}
                    </div>
                    <div className="mt-[3px] text-[11.5px] text-[var(--muted)]">
                      {assigneeName(entry.assignee)} · {entry.room} ·{" "}
                      {formatCompletedDate(entry.completedAt)}
                    </div>
                  </div>
                  <AvatarButton assignee={entry.assignee} done={false} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom tab bar */}
        <div
          className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 items-center justify-around px-[22px] pb-[26px] pt-3"
          style={{
            background: "var(--nav-bg)",
            borderTop: "1px solid var(--hairline)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("rota")}
            className="flex flex-col items-center gap-[5px] text-[10.5px] font-medium"
            style={{ color: tab === "rota" ? "var(--text)" : "var(--dim)" }}
          >
            <div
              className="h-[3px] w-[22px] rounded-[2px]"
              style={{
                background:
                  tab === "rota" ? "linear-gradient(90deg,#3b82f6,#ec4899)" : "var(--nav-idle-bar)",
              }}
            />
            Rota
          </button>

          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="-mt-[22px] flex h-[52px] w-[52px] items-center justify-center rounded-full text-[27px] font-light leading-none text-white"
            style={{
              background: GRAD,
              boxShadow: "0 6px 20px rgba(236,72,153,.32)",
            }}
            aria-label="Add chore"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => setTab("history")}
            className="flex flex-col items-center gap-[5px] text-[10.5px] font-medium"
            style={{ color: tab === "history" ? "var(--text)" : "var(--dim)" }}
          >
            <div
              className="h-[3px] w-[22px] rounded-[2px]"
              style={{
                background:
                  tab === "history"
                    ? "linear-gradient(90deg,#3b82f6,#ec4899)"
                    : "var(--nav-idle-bar)",
              }}
            />
            History
          </button>
        </div>

        {/* Add chore sheet */}
        {showAdd && (
          <div
            className="animate-fade-in fixed inset-0 z-40 flex items-end justify-center"
            style={{ background: "var(--scrim)" }}
            onClick={() => setShowAdd(false)}
          >
            <div
              className="animate-slide-up w-full max-w-[430px] rounded-t-[26px] px-[22px] pb-7 pt-5"
              style={{ background: "var(--bg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="mx-auto mb-4 h-1 w-[38px] rounded-full"
                style={{ background: "var(--sheet-handle)" }}
              />
              <h3 className="mb-4 text-[18px] font-semibold text-[var(--text)]">New chore</h3>

              <input
                placeholder="What needs doing?"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mb-5 w-full rounded-[14px] px-3.5 py-3.5 text-[15px] outline-none"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--input-border)",
                  boxShadow: "var(--card-shadow)",
                }}
              />

              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Who
              </div>
              <div className="mb-5 flex gap-2">
                {(["you", "partner", "both"] as const).map((a) => {
                  const selected = form.assignee === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, assignee: a }))}
                      className="flex-1 rounded-[13px] py-3 text-[13px] font-semibold"
                      style={{
                        background: selected ? whoColors[a] : "var(--who-idle-bg)",
                        color: selected ? "#fff" : "var(--who-idle-text)",
                      }}
                    >
                      {a === "you" ? NAMES.you : a === "partner" ? NAMES.partner : "Both"}
                    </button>
                  );
                })}
              </div>

              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Room
              </div>
              <div className="mb-6 flex flex-wrap gap-[7px]">
                {ROOMS.map((r) => {
                  const active = form.room === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, room: r }))}
                      className="rounded-full px-[14px] py-2 text-[12.5px] font-medium"
                      style={{
                        background: active ? "var(--chip-active-bg)" : "var(--chip-idle-bg)",
                        color: active ? "var(--chip-active-text)" : "var(--chip-idle-text)",
                        border: `1px solid ${active ? "transparent" : "var(--chip-border)"}`,
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addTask}
                className="w-full rounded-2xl py-4 text-[15px] font-semibold"
                style={{
                  background: "var(--primary-btn)",
                  color: "var(--bg)",
                }}
              >
                Add chore
              </button>
            </div>
          </div>
        )}

        {/* Notes / detail sheet (existing behaviour, restyled) */}
        {activeTask && (
          <div
            className="animate-fade-in fixed inset-0 z-40 flex items-end justify-center"
            style={{ background: "var(--scrim)" }}
            onClick={() => setActiveTask(null)}
          >
            <div
              className="animate-slide-up w-full max-w-[430px] rounded-t-[26px] px-[22px] pb-7 pt-5"
              style={{ background: "var(--bg)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="mx-auto mb-4 h-1 w-[38px] rounded-full"
                style={{ background: "var(--sheet-handle)" }}
              />
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-500">
                  {activeTask.room}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTask(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)]"
                  style={{ background: "var(--pill)" }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <h3 className="mb-4 text-[22px] font-semibold text-[var(--text)]">{activeTask.title}</h3>

              <div
                className="mb-4 space-y-3 rounded-[16px] p-3"
                style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
              >
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Assigned to
                  </label>
                  <div className="flex gap-2">
                    {(["you", "partner", "both"] as const).map((a) => {
                      const selected = activeTask.assignee === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => saveActiveTask({ assignee: a })}
                          className="flex-1 rounded-[13px] py-3 text-[13px] font-semibold"
                          style={{
                            background: selected ? whoColors[a] : "var(--who-idle-bg)",
                            color: selected ? "#fff" : "var(--who-idle-text)",
                          }}
                        >
                          {a === "you" ? NAMES.you : a === "partner" ? NAMES.partner : "Both"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className="mb-4 rounded-[16px] p-3"
                style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
              >
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Notes
                </label>
                <textarea
                  value={activeTask.notes}
                  onChange={(e) => saveActiveTask({ notes: e.target.value })}
                  placeholder="Add a note..."
                  className="w-full resize-none bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--dim)]"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleDone(activeTask.id);
                    setActiveTask(null);
                  }}
                  className="flex-1 rounded-2xl py-3.5 text-[15px] font-semibold text-white"
                  style={{ background: isDone(activeTask) ? "#f59e0b" : GRAD }}
                >
                  {isDone(activeTask) ? "Mark incomplete" : "Complete"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteTask(activeTask.id)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500"
                  title="Delete"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Trash2, StickyNote } from "lucide-react";

const ROOMS = ["Kitchen", "Bathroom", "Living Room", "Bedroom", "Garden", "General"] as const;
const ROOM_CHIPS = ["All", ...ROOMS] as const;

const NAMES = { you: "Tom", partner: "Rosie" } as const;
const TOM = "#3b82f6";
const ROSIE = "#ec4899";
const GRAD = "linear-gradient(135deg,#3b82f6,#ec4899)";

type Assignee = "you" | "partner" | "both";
type PersonFilter = "all" | "you" | "partner" | "both";
type Tab = "rota" | "people";

type Task = {
  id: number;
  title: string;
  room: string;
  assignee: Assignee;
  notes: string;
  completedAt: number | null;
  /** Start-of-day ms for the due date. */
  dueAt?: number | null;
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dueAtFromOffset(days: number) {
  const d = startOfDay();
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function daysUntilDue(dueAt: number | null | undefined) {
  if (dueAt == null) return 2;
  const today = startOfDay().getTime();
  const due = startOfDay(new Date(dueAt)).getTime();
  return Math.round((due - today) / 86400000);
}

function dueLabel(days: number, done: boolean) {
  if (done) return "Done";
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

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

const seedTasks: Task[] = [
  { id: 1, title: "Hoover downstairs", room: "Living Room", assignee: "you", notes: "Don't forget under the sofa cushions.", completedAt: null, dueAt: dueAtFromOffset(0) },
  { id: 2, title: "Clean the hob", room: "Kitchen", assignee: "partner", notes: "", completedAt: null, dueAt: dueAtFromOffset(1) },
  { id: 3, title: "Bins out", room: "General", assignee: "both", notes: "Recycling is fortnightly.", completedAt: null, dueAt: dueAtFromOffset(-1) },
  { id: 4, title: "Change bedsheets", room: "Bedroom", assignee: "you", notes: "", completedAt: Date.now(), dueAt: dueAtFromOffset(3) },
  { id: 5, title: "Water the plants", room: "Garden", assignee: "partner", notes: "", completedAt: null, dueAt: dueAtFromOffset(2) },
  { id: 6, title: "Wipe bathroom mirror & sink", room: "Bathroom", assignee: "both", notes: "", completedAt: null, dueAt: dueAtFromOffset(-2) },
  { id: 7, title: "Load the dishwasher", room: "Kitchen", assignee: "you", notes: "", completedAt: null, dueAt: dueAtFromOffset(0) },
  { id: 8, title: "Tidy the sofa cushions", room: "Living Room", assignee: "partner", notes: "", completedAt: null, dueAt: dueAtFromOffset(4) },
];

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

  return [value, setValue] as const;
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
  onClick: () => void;
}) {
  const letter = assignee === "both" ? "B" : assignee === "you" ? "T" : "R";
  const bg =
    assignee === "you" ? TOM : assignee === "partner" ? ROSIE : GRAD;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: bg, opacity: done ? 0.45 : 1 }}
      title={assignee === "both" ? "Both" : NAMES[assignee]}
      aria-label={`Reassign (${letter})`}
    >
      {letter}
    </button>
  );
}

function Checkbox({
  done,
  overdue,
  onClick,
}: {
  done: boolean;
  overdue: boolean;
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
              border: `1.5px solid ${overdue ? "var(--checkbox-overdue)" : "var(--checkbox-border)"}`,
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
  days,
  onToggle,
  onCycle,
  onOpenNotes,
  compact,
}: {
  task: Task;
  done: boolean;
  days: number;
  onToggle: () => void;
  onCycle: () => void;
  onOpenNotes?: () => void;
  compact?: boolean;
}) {
  const overdue = days < 0 && !done;
  const label = dueLabel(days, done);

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-[7px]">
        <Checkbox done={done} overdue={overdue} onClick={onToggle} />
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
          <div className="mt-[3px] text-[11.5px] font-normal" style={{ color: "var(--pink-label)" }}>
            {label} · {task.room}
          </div>
        </button>
        <AvatarButton assignee={task.assignee} done={done} onClick={onCycle} />
      </div>
    );
  }

  return (
    <div
      className="mb-2 flex min-h-[56px] items-center gap-[13px] rounded-2xl px-[15px] py-[13px]"
      style={{
        background: "var(--row)",
        boxShadow: overdue
          ? `inset 3px 0 0 ${ROSIE}, var(--card-shadow)`
          : "var(--card-shadow)",
      }}
    >
      <Checkbox done={done} overdue={overdue} onClick={onToggle} />
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
        <div
          className="mt-[3px] text-[11.5px] font-normal"
          style={{
            color: overdue ? ROSIE : done ? "var(--due-done)" : "var(--muted)",
          }}
        >
          {label}
        </div>
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
    </div>
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

  const [tasks, setTasks] = useSharedState<Task[]>("tasks", seedTasks, pausedRef);
  const [roomFilter, setRoomFilter] = useState("All");
  const [personFilter, setPersonFilter] = useState<PersonFilter>("all");
  const [form, setForm] = useState({
    title: "",
    room: "Kitchen" as string,
    assignee: "you" as Assignee,
  });

  const weekStart = useMemo(() => startOfWeek().getTime(), []);
  const isDone = (t: Task) => !!(t.completedAt && t.completedAt >= weekStart);

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

  const overdueTasks = useMemo(
    () =>
      filtered.filter((t) => {
        if (isDone(t)) return false;
        return daysUntilDue(t.dueAt) < 0;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, weekStart]
  );

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
        dueAt: dueAtFromOffset(2),
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
              <div className="flex items-start justify-between">
                <div className="text-[13px] font-semibold tracking-[0.02em] text-[var(--secondary)]">
                  {NAMES.you} & {NAMES.partner}
                </div>
                <div
                  className="rounded-full px-[11px] py-[6px] text-[11.5px] font-medium"
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

            {/* Overdue */}
            {overdueTasks.length > 0 && (
              <div
                className="mx-[22px] mb-1 mt-1.5 rounded-[18px] px-[15px] py-[13px]"
                style={{
                  background: "var(--overdue-bg)",
                  border: "1px solid var(--overdue-border)",
                }}
              >
                <div
                  className="mb-[9px] text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--pink-label)" }}
                >
                  Overdue
                </div>
                {overdueTasks.map((t) => (
                  <ChoreRow
                    key={t.id}
                    task={t}
                    done={isDone(t)}
                    days={daysUntilDue(t.dueAt)}
                    onToggle={() => toggleDone(t.id)}
                    onCycle={() => cycleAssignee(t.id)}
                    compact
                  />
                ))}
              </div>
            )}

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
                        days={daysUntilDue(t.dueAt)}
                        onToggle={() => toggleDone(t.id)}
                        onCycle={() => cycleAssignee(t.id)}
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
            <div className="text-[13px] font-semibold tracking-[0.02em] text-[var(--secondary)]">
              People
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--text)]">
              Who&apos;s on what
            </h1>
            <div className="mt-6 flex flex-col gap-3">
              <ScoreCard name={NAMES.you} color={TOM} pct={stats.tomPct} label={stats.tomLabel} />
              <ScoreCard
                name={NAMES.partner}
                color={ROSIE}
                pct={stats.rosiePct}
                label={stats.rosieLabel}
              />
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-[var(--muted)]">
              Rings count shared (Both) chores for each person. Filter the rota by person to see
              only their list.
            </p>
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
            onClick={() => setTab("people")}
            className="flex flex-col items-center gap-[5px] text-[10.5px] font-medium"
            style={{ color: tab === "people" ? "var(--text)" : "var(--dim)" }}
          >
            <div
              className="h-[3px] w-[22px] rounded-[2px]"
              style={{
                background:
                  tab === "people"
                    ? "linear-gradient(90deg,#3b82f6,#ec4899)"
                    : "var(--nav-idle-bar)",
              }}
            />
            People
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
                autoFocus
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

"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Check, Trash2, StickyNote, Sparkles, Calendar, ChevronRight } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

const ROOMS = ["Kitchen", "Bathroom", "Living Room", "Bedroom", "Garden", "General"];

// Fixed names — no longer editable in the UI.
const NAMES = { you: "Tom", partner: "Rosie" };

const ASSIGNEE_STYLE: Record<string, { bg: string; label: string }> = {
  you: { bg: "bg-blue-500", label: "Tom" },
  partner: { bg: "bg-pink-500", label: "Rosie" },
  both: { bg: "bg-amber-500", label: "Both" },
};

type Task = {
  id: number;
  title: string;
  room: string;
  assignee: "you" | "partner" | "both";
  notes: string;
  completedAt: number | null;
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

const seedTasks: Task[] = [
  { id: 1, title: "Hoover downstairs", room: "Living Room", assignee: "you", notes: "Don't forget under the sofa cushions.", completedAt: null },
  { id: 2, title: "Clean the hob", room: "Kitchen", assignee: "partner", notes: "", completedAt: null },
  { id: 3, title: "Bins out", room: "General", assignee: "both", notes: "Recycling is fortnightly.", completedAt: null },
  { id: 4, title: "Change bedsheets", room: "Bedroom", assignee: "you", notes: "", completedAt: null },
  { id: 5, title: "Water the plants", room: "Garden", assignee: "partner", notes: "", completedAt: null },
  { id: 6, title: "Wipe bathroom mirror & sink", room: "Bathroom", assignee: "both", notes: "", completedAt: null },
];

// Shared state: persisted server-side via Supabase (see app/api/state/route.ts),
// polled every few seconds so both phones stay in sync. Pass a `paused` ref
// (true while a modal is open/typing) to avoid a poll clobbering an in-progress edit.
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

// A task row you can swipe left to delete (flashes red, slides off) or
// swipe right to complete (flashes green, snaps back). Tapping it when it
// hasn't moved opens the detail sheet.
function SwipeableTaskRow({
  task,
  done,
  onToggleDone,
  onDelete,
  onOpen,
}: {
  task: Task;
  done: boolean;
  onToggleDone: (id: number) => void;
  onDelete: (id: number) => void;
  onOpen: (task: Task) => void;
}) {
  const x = useMotionValue(0);
  const greenOpacity = useTransform(x, [0, 90], [0, 1]);
  const redOpacity = useTransform(x, [-90, 0], [1, 0]);
  const THRESHOLD = 90;

  function handleDragEnd(_e: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -THRESHOLD) {
      animate(x, -500, {
        duration: 0.25,
        ease: "easeIn",
        onComplete: () => onDelete(task.id),
      });
    } else if (info.offset.x > THRESHOLD) {
      onToggleDone(task.id);
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    } else {
      animate(x, 0, { type: "spring", stiffness: 500, damping: 32 });
    }
  }

  return (
    <motion.div layout="position" className="relative" style={{ touchAction: "pan-y" }}>
      <motion.div
        className="absolute inset-0 flex items-center px-5 bg-green-500"
        style={{ opacity: greenOpacity }}
      >
        <Check size={20} color="white" strokeWidth={3} />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-end px-5 bg-red-500"
        style={{ opacity: redOpacity }}
      >
        <Trash2 size={20} color="white" />
      </motion.div>

      <motion.div
        drag="x"
        dragElastic={0.15}
        dragConstraints={{ left: 0, right: 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 32 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (Math.abs(x.get()) < 5) onOpen(task);
        }}
        className={`relative z-10 flex items-center gap-3 bg-white px-3.5 py-3 cursor-grab active:cursor-grabbing transition-colors duration-200 ${
          done ? "opacity-40 bg-black/[0.01]" : ""
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task.id);
          }}
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 active:scale-90 ${
            done ? "bg-blue-500 border-none shadow-sm" : "border-2 border-black/20 hover:border-black/40 bg-transparent"
          }`}
        >
          {done && <Check size={14} color="white" strokeWidth={3.5} />}
        </button>

        <div className="flex-1 min-w-0 pr-1">
          <p className={`text-[15px] font-medium leading-snug transition-all ${done ? "line-through text-black/60" : "text-[#1C1C1E]"}`}>
            {task.title}
          </p>
        </div>

        {task.notes && <StickyNote size={15} className="text-black/20 shrink-0" />}

        <div
          className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ${ASSIGNEE_STYLE[task.assignee].bg}`}
          title={ASSIGNEE_STYLE[task.assignee].label}
        >
          {task.assignee === "both" ? "B" : task.assignee === "you" ? "T" : "R"}
        </div>

        <ChevronRight size={14} className="text-black/20 shrink-0" />
      </motion.div>
    </motion.div>
  );
}

export default function ChoreApp() {
  const [showAdd, setShowAdd] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = showAdd || !!activeTask;
  }, [showAdd, activeTask]);

  const [tasks, setTasks] = useSharedState<Task[]>("tasks", seedTasks, pausedRef);
  const [roomFilter, setRoomFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [form, setForm] = useState({ title: "", room: "Kitchen", assignee: "you" as Task["assignee"], notes: "" });

  const weekStart = useMemo(() => startOfWeek().getTime(), []);
  const isDone = (t: Task) => !!(t.completedAt && t.completedAt >= weekStart);

  const rooms = useMemo(() => {
    const present = Array.from(new Set(tasks.map((t) => t.room)));
    return ["All", ...ROOMS.filter((r) => present.includes(r)), ...present.filter((r) => !ROOMS.includes(r))];
  }, [tasks]);

  const filtered = tasks.filter(
    (t) => (roomFilter === "All" || t.room === roomFilter) && (assigneeFilter === "All" || t.assignee === assigneeFilter)
  );

  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = {};
    filtered.forEach((t) => {
      g[t.room] = g[t.room] || [];
      g[t.room].push(t);
    });
    Object.values(g).forEach((arr) => arr.sort((a, b) => Number(isDone(a)) - Number(isDone(b))));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, weekStart]);

  const doneCount = tasks.filter(isDone).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  function toggleDone(id: number) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completedAt: isDone(t) ? null : Date.now() } : t)));
  }

  function addTask() {
    if (!form.title.trim()) return;
    setTasks((ts) => [
      ...ts,
      { id: Date.now(), title: form.title.trim(), room: form.room, assignee: form.assignee, notes: form.notes.trim(), completedAt: null },
    ]);
    setForm({ title: "", room: form.room, assignee: "you", notes: "" });
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

  const ring = 2 * Math.PI * 22;

  return (
    <div
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}
      className="w-full flex justify-center bg-[#F2F2F7] min-h-screen text-[#1C1C1E] selection:bg-blue-500/20"
    >
      <div className="w-full max-w-[430px] min-h-screen bg-[#F2F2F7] relative pb-32 flex flex-col">
        <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#F2F2F7]/80 border-b border-black/[0.05] px-5 pt-12 pb-3 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[11px] font-bold tracking-wider text-black/40 uppercase">Overview</span>
              <h1 className="text-[32px] font-extrabold tracking-tight text-[#1C1C1E]">Home Rota</h1>
            </div>
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="w-14 h-14 -rotate-90">
                <circle cx="26" cy="26" r="22" fill="none" stroke="#E5E5EA" strokeWidth={4.5} />
                <circle
                  cx="26"
                  cy="26"
                  r="22"
                  fill="none"
                  stroke="url(#ringGradient)"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  strokeDasharray={ring}
                  strokeDashoffset={ring - (ring * pct) / 100}
                  style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#007AFF" />
                    <stop offset="100%" stopColor="#5856D6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[12px] font-extrabold text-[#1C1C1E]">{pct}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <span className="text-black/50 font-medium py-1">{NAMES.you} &amp; {NAMES.partner}</span>
            <div className="flex items-center gap-1 text-[12px] font-semibold text-black/40 bg-black/[0.04] px-2.5 py-1 rounded-full">
              <Calendar size={12} />
              <span>Reset in {daysUntilReset()}d</span>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4 flex-1">
          <div className="bg-[#E3E3E8] p-0.5 rounded-xl flex items-center shadow-inner">
            {["All", "you", "partner", "both"].map((a) => {
              const active = assigneeFilter === a;
              return (
                <button
                  key={a}
                  onClick={() => setAssigneeFilter(a)}
                  className={`flex-1 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all duration-200 ${
                    active ? "bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.12)]" : "text-black/60 hover:text-black"
                  }`}
                >
                  {a === "All" ? "Everyone" : a === "you" ? NAMES.you : a === "partner" ? NAMES.partner : "Both"}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4 scroll-smooth">
            {rooms.map((r) => {
              const active = roomFilter === r;
              return (
                <button
                  key={r}
                  onClick={() => setRoomFilter(r)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                    active ? "bg-black text-white shadow-md" : "bg-white/80 text-black/70 hover:bg-white shadow-sm border border-black/[0.03]"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <div className="space-y-5 pt-1">
            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-3 text-black/30">
                  <Sparkles size={24} />
                </div>
                <p className="text-[15px] font-semibold text-black/60">No chores scheduled</p>
                <p className="text-[13px] text-black/40 mt-1">Tap + below to add a task to this list.</p>
              </div>
            )}

            {Object.entries(grouped).map(([room, items]) => (
              <div key={room} className="space-y-1.5">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-black/40 px-3">{room}</h2>
                <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-black/[0.04] divide-y divide-black/[0.04]">
                  {items.map((t) => (
                    <SwipeableTaskRow
                      key={t.id}
                      task={t}
                      done={isDone(t)}
                      onToggleDone={toggleDone}
                      onDelete={deleteTask}
                      onOpen={setActiveTask}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none z-10">
          <button
            onClick={() => setShowAdd(true)}
            className="pointer-events-auto w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-[0_8px_25px_rgba(0,122,255,0.4)] active:scale-90 hover:scale-105 transition-all duration-200"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>

        {showAdd && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setShowAdd(false)}>
            <div
              className="w-full max-w-[430px] bg-[#F2F2F7] rounded-t-[28px] p-5 pb-9 shadow-2xl transition-transform duration-300 animate-slide-up border-t border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-9 h-1 bg-black/20 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-5 px-1">
                <h3 className="text-[20px] font-bold text-[#1C1C1E]">New Task</h3>
                <button onClick={() => setShowAdd(false)} className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center text-black/50 hover:bg-black/10 active:scale-90 transition-all">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  autoFocus
                  placeholder="Task title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-white rounded-xl px-4 py-3.5 text-[16px] text-[#1C1C1E] placeholder:text-black/30 outline-none border border-black/[0.05] shadow-sm focus:ring-2 focus:ring-blue-500/20"
                />

                <div className="bg-white rounded-xl p-3 shadow-sm border border-black/[0.05] space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 block mb-2">Room</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {ROOMS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setForm((f) => ({ ...f, room: r }))}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all active:scale-95 ${
                            form.room === r ? "bg-blue-500 text-white shadow-sm" : "bg-black/[0.04] text-black/70 hover:bg-black/[0.07]"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-black/[0.04]">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 block mb-2">Assign To</label>
                    <div className="bg-[#E3E3E8] p-0.5 rounded-lg flex gap-1">
                      {(["you", "partner", "both"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setForm((f) => ({ ...f, assignee: a }))}
                          className={`flex-1 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                            form.assignee === a ? "bg-white text-black shadow-sm" : "text-black/60 hover:text-black"
                          }`}
                        >
                          {a === "you" ? NAMES.you : a === "partner" ? NAMES.partner : "Both"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <textarea
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-white rounded-xl px-4 py-3 text-[14px] text-[#1C1C1E] placeholder:text-black/30 outline-none border border-black/[0.05] shadow-sm resize-none focus:ring-2 focus:ring-blue-500/20"
                  rows={2}
                />

                <button
                  onClick={addTask}
                  disabled={!form.title.trim()}
                  className="w-full py-3.5 rounded-xl text-[16px] font-semibold text-white bg-blue-500 disabled:opacity-40 active:scale-[0.98] shadow-[0_4px_12px_rgba(0,122,255,0.3)] transition-all"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTask && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end justify-center animate-fade-in" onClick={() => setActiveTask(null)}>
            <div className="w-full max-w-[430px] bg-[#F2F2F7] rounded-t-[28px] p-5 pb-9 shadow-2xl animate-slide-up border-t border-white/20" onClick={(e) => e.stopPropagation()}>
              <div className="w-9 h-1 bg-black/20 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-500">{activeTask.room}</span>
                <button onClick={() => setActiveTask(null)} className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center text-black/50 hover:bg-black/10 active:scale-90 transition-all">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <h3 className="text-[22px] font-bold text-[#1C1C1E] mb-4 px-1">{activeTask.title}</h3>

              <div className="space-y-4">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-black/[0.05] space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 block mb-2">Assigned To</label>
                    <div className="bg-[#E3E3E8] p-0.5 rounded-lg flex gap-1">
                      {(["you", "partner", "both"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => saveActiveTask({ assignee: a })}
                          className={`flex-1 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                            activeTask.assignee === a ? "bg-white text-black shadow-sm" : "text-black/60 hover:text-black"
                          }`}
                        >
                          {a === "you" ? NAMES.you : a === "partner" ? NAMES.partner : "Both"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 shadow-sm border border-black/[0.05]">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black/40 block mb-1">Notes</label>
                  <textarea
                    value={activeTask.notes}
                    onChange={(e) => saveActiveTask({ notes: e.target.value })}
                    placeholder="Add a note or description..."
                    className="w-full bg-transparent text-[14px] text-[#1C1C1E] placeholder:text-black/30 outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      toggleDone(activeTask.id);
                      setActiveTask(null);
                    }}
                    className={`flex-1 py-3.5 rounded-xl text-[15px] font-semibold text-white shadow-md active:scale-[0.98] transition-all ${
                      isDone(activeTask) ? "bg-amber-500" : "bg-blue-500"
                    }`}
                  >
                    {isDone(activeTask) ? "Mark Incomplete" : "Complete Task"}
                  </button>
                  <button
                    onClick={() => deleteTask(activeTask.id)}
                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-90 transition-all"
                    title="Delete task"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
          .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        `}</style>
      </div>
    </div>
  );
}

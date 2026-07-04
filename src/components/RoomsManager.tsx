"use client";

import { useRef, useState, useTransition } from "react";
import { createRoom, deleteRoom, setRoomHidden, updateRoomName } from "@/app/actions/rooms";

type RoomClass = { id: string; name: string };
type Room = { id: string; name: string; isHidden: boolean; classes: RoomClass[] };

type Dialog =
  | { type: "delete"; room: Room }
  | { type: "hide"; room: Room };

const btn =
  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";
const btnGhost =
  `${btn} border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800`;
const btnRed =
  `${btn} border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30`;
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function RoomsManager({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isPending, startTransition] = useTransition();
  const addRef = useRef<HTMLInputElement>(null);

  function refreshRoom(updated: Partial<Room> & { id: string }) {
    setRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    // optimistic
    const tempId = `temp-${Date.now()}`;
    setRooms((prev) => [...prev, { id: tempId, name, isHidden: false, classes: [] }]);
    e.currentTarget.reset();
    startTransition(async () => {
      await createRoom(fd);
    });
  }

  // ── Rename ───────────────────────────────────────────────────────────────
  function startEdit(room: Room) {
    setEditingId(room.id);
    setEditName(room.name);
  }

  async function commitEdit(room: Room) {
    const name = editName.trim();
    if (!name || name === room.name) { setEditingId(null); return; }
    refreshRoom({ id: room.id, name });
    setEditingId(null);
    const fd = new FormData();
    fd.set("id", room.id);
    fd.set("name", name);
    startTransition(async () => { await updateRoomName(fd); });
  }

  // ── Hide / Show ──────────────────────────────────────────────────────────
  function requestHide(room: Room) {
    if (!room.isHidden && room.classes.length > 0) {
      setDialog({ type: "hide", room });
    } else {
      toggleHidden(room, !room.isHidden);
    }
  }

  function toggleHidden(room: Room, hidden: boolean) {
    refreshRoom({ id: room.id, isHidden: hidden });
    const fd = new FormData();
    fd.set("id", room.id);
    fd.set("hidden", String(hidden));
    startTransition(async () => { await setRoomHidden(fd); });
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function requestDelete(room: Room) {
    if (room.classes.length > 0) {
      setDialog({ type: "delete", room });
    } else {
      doDelete(room);
    }
  }

  function doDelete(room: Room) {
    setRooms((prev) => prev.filter((r) => r.id !== room.id));
    const fd = new FormData();
    fd.set("id", room.id);
    startTransition(async () => { await deleteRoom(fd); });
  }

  return (
    <>
      {/* ── Add form ── */}
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          ref={addRef}
          name="name"
          placeholder="New room name…"
          className={inputCls}
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Add
        </button>
      </form>

      {/* ── Room list ── */}
      {rooms.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No rooms yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center gap-3 py-2.5">
              {/* Name / edit */}
              <div className="flex-1">
                {editingId === room.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitEdit(room)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(room);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className={inputCls}
                  />
                ) : (
                  <span
                    className={`text-sm font-medium ${room.isHidden ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}
                  >
                    {room.name}
                    {room.isHidden && (
                      <span className="ml-2 text-xs font-normal text-slate-400 no-underline dark:text-slate-500">
                        hidden
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(room)}
                  className={btnGhost}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => requestHide(room)}
                  className={btnGhost}
                >
                  {room.isHidden ? "Show" : "Hide"}
                </button>
                <button
                  type="button"
                  onClick={() => requestDelete(room)}
                  className={btnRed}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Conflict dialog ── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {dialog.type === "delete" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cannot delete "{dialog.room.name}"
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Move the following classes to another room before deleting:
                </p>
                <ul className="mt-3 space-y-1">
                  {dialog.room.classes.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {c.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setDialog(null)}
                  className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500"
                >
                  OK, I'll move them first
                </button>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Hide "{dialog.room.name}"?
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  The following classes will be hidden from the attendance calendar:
                </p>
                <ul className="mt-3 space-y-1">
                  {dialog.room.classes.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {c.name}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setDialog(null)}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { toggleHidden(dialog.room, true); setDialog(null); }}
                    className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                  >
                    Hide anyway
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

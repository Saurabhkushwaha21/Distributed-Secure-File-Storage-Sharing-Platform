import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { clearCompleted, removeUpload } from "@/store/uploadSlice";
import { useUploadController } from "@/hooks/useUploadController";
import { formatBytes, formatSpeed, formatEta } from "@/utils/format";

export function UploadDock() {
  const tasks = useAppSelector((s) => s.uploads);
  const dispatch = useAppDispatch();
  const { pauseUpload, resumeUpload, cancelUpload } = useUploadController();
  const [collapsed, setCollapsed] = useState(false);

  if (tasks.length === 0) return null;

  const activeCount = tasks.filter((t) => t.status === "uploading" || t.status === "queued").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 overflow-hidden rounded-md border border-steel-hairline bg-paper-raised shadow-panel">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between bg-ink px-4 py-3 text-left text-white"
      >
        <span className="text-sm font-medium">
          {activeCount > 0 ? `Uploading ${activeCount} item${activeCount > 1 ? "s" : ""}` : "Uploads"}
        </span>
        <div className="flex items-center gap-3">
          <span
            className="text-xs text-white/60 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              dispatch(clearCompleted());
            }}
          >
            Clear completed
          </span>
          <span className="text-white/60">{collapsed ? "▲" : "▼"}</span>
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="max-h-96 overflow-y-auto"
          >
            {tasks.map((task) => {
              const percent = task.totalBytes > 0 ? (task.uploadedBytes / task.totalBytes) * 100 : 0;
              return (
                <div key={task.id} className="flex items-center gap-3 border-b border-steel-hairline px-4 py-3">
                  <div className="relative h-8 w-8 shrink-0">
                    <svg viewBox="0 0 32 32" className="-rotate-90">
                      <circle cx="16" cy="16" r="13" fill="none" stroke="#D7DCE5" strokeWidth="3" />
                      <circle
                        cx="16"
                        cy="16"
                        r="13"
                        fill="none"
                        stroke={
                          task.status === "failed" ? "#C1443C" : task.status === "completed" ? "#2F8F6C" : "#B8842E"
                        }
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 13}
                        strokeDashoffset={2 * Math.PI * 13 * (1 - percent / 100)}
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-300"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{task.fileName}</p>
                    <p className="font-mono text-[11px] text-steel">
                      {formatBytes(task.uploadedBytes)} / {formatBytes(task.totalBytes)}
                      {task.status === "uploading" && (
                        <>
                          {" · "}
                          {formatSpeed(task.speedBytesPerSec)} · ETA {formatEta(task.etaSeconds)}
                        </>
                      )}
                      {task.status === "failed" && <span className="text-signal-red"> · Failed</span>}
                      {task.status === "paused" && <span className="text-brass"> · Paused</span>}
                      {task.status === "completed" && <span className="text-vault-green"> · Done</span>}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {task.status === "uploading" && (
                      <IconButton label="Pause" onClick={() => pauseUpload(task.id)}>
                        <PauseIcon />
                      </IconButton>
                    )}
                    {task.status === "paused" && (
                      <IconButton label="Resume" onClick={() => resumeUpload(task.id)}>
                        <PlayIcon />
                      </IconButton>
                    )}
                    {(task.status === "uploading" || task.status === "paused" || task.status === "failed") && (
                      <IconButton label="Cancel" onClick={() => cancelUpload(task.id)}>
                        <CloseIcon />
                      </IconButton>
                    )}
                    {(task.status === "completed" || task.status === "canceled") && (
                      <IconButton label="Remove" onClick={() => dispatch(removeUpload(task.id))}>
                        <CloseIcon />
                      </IconButton>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={clsx("rounded p-1.5 text-steel hover:bg-paper hover:text-ink")}
    >
      {children}
    </button>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
      <rect x="3" y="2" width="2.5" height="9" rx="0.5" />
      <rect x="7.5" y="2" width="2.5" height="9" rx="0.5" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
      <path d="M3.5 2.3v8.4a.6.6 0 0 0 .9.5l7-4.2a.6.6 0 0 0 0-1l-7-4.2a.6.6 0 0 0-.9.5Z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2.5 2.5 10.5 10.5M10.5 2.5 2.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

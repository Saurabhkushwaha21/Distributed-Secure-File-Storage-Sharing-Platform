import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAppSelector } from "@/hooks/redux";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { to: "/files", label: "My Files", icon: FilesIcon },
  { to: "/shared", label: "Shared", icon: ShareIcon },
  { to: "/starred", label: "Starred", icon: StarIcon },
  { to: "/trash", label: "Trash", icon: TrashIcon },
  { to: "/analytics", label: "Analytics", icon: ChartIcon },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <>
      {/* Backdrop - mobile only, closes the sidebar on tap outside it */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-col justify-between bg-ink px-4 py-6 text-white transition-transform duration-200 ease-out",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div>
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brass">
                <div className="h-1.5 w-1.5 rounded-full bg-brass" />
              </div>
              <span className="font-display text-base tracking-wide">CloudVault</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="rounded p-1 text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4.5 4.5 13.5 13.5M13.5 4.5 4.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}

            {user?.role === "ADMIN" && (
              <NavLink
                to="/admin"
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "mt-4 flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors border-t border-white/10 pt-4",
                    isActive ? "text-brass" : "text-white/60 hover:text-white"
                  )
                }
              >
                <AdminIcon />
                Admin Panel
              </NavLink>
            )}
          </nav>
        </div>

        {user && (
          <div className="border-t border-white/10 pt-4 px-2">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
        )}
      </aside>
    </>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="1.5" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="7.5" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9.5" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function FilesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3l1.5 1.5H12.5A1.5 1.5 0 0 1 14 5v7.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="12" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.6 7.1 10.4 4.4M5.6 8.9l4.8 2.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 9.9 5.7l4.6.5-3.4 3.1.9 4.5L8 11.6l-4 2.2.9-4.5-3.4-3.1 4.6-.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5h10M6 4.5v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13.5h12M4.5 13.5V8M8 13.5V4M11.5 13.5v-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 13 3.5v3.8c0 3.4-2.1 5.8-5 6.7-2.9-.9-5-3.3-5-6.7V3.5L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

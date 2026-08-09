import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/hooks/redux";
import { logout } from "@/store/authSlice";
import { showToast } from "@/store/toastSlice";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/files?q=${encodeURIComponent(query.trim())}`);
  }

  async function handleLogout() {
    await dispatch(logout());
    dispatch(showToast("Signed out.", "info"));
    navigate("/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-steel-hairline bg-paper-raised px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="mr-2 rounded p-2 text-steel hover:bg-paper hover:text-ink lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <form onSubmit={handleSearch} className="w-full max-w-md">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-soft"
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 10 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by name, type, or date…"
            className="w-full rounded border border-steel-hairline bg-paper py-2 pl-9 pr-3 text-sm placeholder:text-steel-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
        </div>
      </form>

      <button
        onClick={handleLogout}
        className="ml-4 rounded px-3 py-1.5 text-sm text-steel hover:bg-paper hover:text-ink"
      >
        Sign out
      </button>
    </header>
  );
}

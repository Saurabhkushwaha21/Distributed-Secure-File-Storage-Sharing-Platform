import { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-ink px-12 py-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brass">
            <div className="h-2 w-2 rounded-full bg-brass" />
          </div>
          <span className="font-display text-lg tracking-wide">CloudVault</span>
        </div>
        <div>
          <h2 className="font-display text-3xl leading-tight text-white">
            Every file, sealed shut<br />until you turn the key.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            AES-256 envelope encryption, resumable chunked uploads, and full version
            history — built the way distributed storage systems actually work.
          </p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} CloudVault</p>
      </div>

      {/* Right: form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          <p className="mt-1 text-sm text-steel">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

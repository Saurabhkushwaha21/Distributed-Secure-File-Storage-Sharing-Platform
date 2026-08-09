export function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const color = iconColor(mimeType);
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 2.5h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14 2.5v4h4" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function iconColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#2F8F6C";
  if (mimeType.startsWith("video/")) return "#B8842E";
  if (mimeType.startsWith("audio/")) return "#8F6620";
  if (mimeType === "application/pdf") return "#C1443C";
  if (mimeType.startsWith("text/")) return "#4B5567";
  return "#8993A8";
}

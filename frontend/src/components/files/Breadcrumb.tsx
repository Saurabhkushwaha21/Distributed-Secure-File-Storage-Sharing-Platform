import { Fragment } from "react";
import { FolderItem } from "@/types";

export function Breadcrumb({
  path,
  onNavigate,
}: {
  path: FolderItem[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-steel">
      <button onClick={() => onNavigate(null)} className="hover:text-ink hover:underline">
        My Files
      </button>
      {path.map((folder) => (
        <Fragment key={folder.id}>
          <span className="text-steel-soft">/</span>
          <button onClick={() => onNavigate(folder.id)} className="hover:text-ink hover:underline">
            {folder.name}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

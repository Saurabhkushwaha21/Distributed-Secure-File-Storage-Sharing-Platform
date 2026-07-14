import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { dismissToast } from "@/store/toastSlice";

export function ToastContainer() {
  const toasts = useAppSelector((s) => s.toasts);
  const dispatch = useAppDispatch();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.18 }}
            role="status"
            className={clsx(
              "min-w-[260px] max-w-sm rounded-md border px-4 py-3 text-sm shadow-panel cursor-pointer",
              t.variant === "success" && "bg-vault-greenSoft border-vault-green/30 text-ink",
              t.variant === "error" && "bg-signal-redSoft border-signal-red/30 text-ink",
              t.variant === "info" && "bg-white border-steel-hairline text-ink"
            )}
            onClick={() => dispatch(dismissToast(t.id))}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

import { motion } from "framer-motion";
import { SPRING_SMOOTH } from "../../lib/motion";

interface Props {
  label: string;
  value: number;
  max?: number;
  colorClass: string;
}

export function RatingBar({ label, value, max = 99, colorClass }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-smoke-500">{label}</span>
        <span className="font-display font-bold text-paper">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-ink-800">
        <motion.div
          className={`h-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={SPRING_SMOOTH}
        />
      </div>
    </div>
  );
}

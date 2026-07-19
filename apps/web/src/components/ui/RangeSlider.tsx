interface Props {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  formatLabel?: (value: number) => string;
}

export function RangeSlider({ min, max, valueMin, valueMax, onChange, formatLabel = String }: Props) {
  const span = Math.max(max - min, 1);
  const leftPct = ((valueMin - min) / span) * 100;
  const rightPct = ((valueMax - min) / span) * 100;

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 bg-ink-700" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-gold-500"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          className="range-thumb"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
        />
        <input
          type="range"
          className="range-thumb"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className="font-medium text-gold-400">{formatLabel(valueMin)}</span>
        <span className="font-medium text-gold-400">{formatLabel(valueMax)}</span>
      </div>
    </div>
  );
}

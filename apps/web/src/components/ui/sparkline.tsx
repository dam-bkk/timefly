export function Sparkline({ data, width = 96, height = 28, stroke = "var(--accent)", fill = true }: { data: number[]; width?: number; height?: number; stroke?: string; fill?: boolean }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={stroke} opacity={0.08} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={stroke} />
    </svg>
  );
}

export function Bars({ data, width = 480, height = 120, labels, color = "var(--accent)", color2 }: { data: number[] | [number, number][]; width?: number; height?: number; labels?: string[]; color?: string; color2?: string }) {
  const series = data.map((d) => (Array.isArray(d) ? d : [d, 0])) as [number, number][];
  const max = Math.max(...series.map(([a, b]) => Math.max(a, b)), 1);
  const n = series.length;
  const gap = 3;
  const bw = (width - gap * (n - 1)) / n;
  const ih = height - 18;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} aria-hidden className="block overflow-visible">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={0} x2={width} y1={ih - ih * f} y2={ih - ih * f} stroke="var(--line)" strokeDasharray="2 3" />
      ))}
      {series.map(([a, b], i) => {
        const x = i * (bw + gap);
        const ha = (a / max) * ih;
        const hb = (b / max) * ih;
        return (
          <g key={i}>
            <rect x={x} y={ih - ha} width={color2 ? bw / 2 - 1 : bw} height={ha} rx={2} fill={color} />
            {color2 && <rect x={x + bw / 2 + 1} y={ih - hb} width={bw / 2 - 1} height={hb} rx={2} fill={color2} />}
            {labels && (i % Math.ceil(n / 8) === 0 && n - 1 - i >= Math.ceil(n / 8) / 2 || i === n - 1) && (
              <text x={x + bw / 2} y={height - 3} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ segments, size = 120, thickness = 14 }: { segments: { value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />;
        offset += len;
        return el;
      })}
    </svg>
  );
}

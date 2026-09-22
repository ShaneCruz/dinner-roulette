// The app icon: a six-slice dinner wheel. Plain SVG so ImageResponse can
// render it without fetching emoji fonts.
const SLICES = ["#e0492f", "#f0ad2b", "#2f8a4f", "#7a4bb5", "#f0ad2b", "#2f8a4f"];

export function WheelIcon({ size }: { size: number }) {
  const r = 44;
  const paths = SLICES.map((color, i) => {
    const a0 = (i * Math.PI) / 3 - Math.PI / 2;
    const a1 = ((i + 1) * Math.PI) / 3 - Math.PI / 2;
    const d = `M50 50 L${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)} Z`;
    return <path key={i} d={d} fill={color} stroke="#fff8ef" strokeWidth="2" />;
  });
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff8ef",
      }}
    >
      <svg width={size * 0.86} height={size * 0.86} viewBox="0 0 100 100">
        {paths}
        <circle cx="50" cy="50" r="10" fill="#fff8ef" />
        <circle cx="50" cy="50" r="5" fill="#2a1f16" />
        <path d="M43 1 L57 1 L50 15 Z" fill="#2a1f16" />
      </svg>
    </div>
  );
}

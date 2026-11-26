/**
 * Faint plant silhouettes, like the ferns and leaves of early cyanotype
 * prints (Anna Atkins' photograms). Drawn from code so they stay crisp at
 * any size and cost no image files.
 */

type Pt = [number, number]

/** Point and tangent angle on a quadratic curve. */
function onCurve(a: Pt, c: Pt, b: Pt, t: number): { p: Pt; angle: number } {
  const u = 1 - t
  const p: Pt = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
  const d: Pt = [2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1])]
  return { p, angle: Math.atan2(d[1], d[0]) }
}

/** A leaflet: a pointed oval from the stem outwards. */
function leaflet(at: Pt, angle: number, len: number, width: number): string {
  const [x, y] = at
  const tip: Pt = [x + Math.cos(angle) * len, y + Math.sin(angle) * len]
  const n = angle + Math.PI / 2
  const mid = (k: number): Pt => [x + Math.cos(angle) * len * k, y + Math.sin(angle) * len * k]
  const [m1, m2] = [mid(0.35), mid(0.7)]
  const side = (s: number, m: Pt, w: number): string => `${(m[0] + Math.cos(n) * w * s).toFixed(1)} ${(m[1] + Math.sin(n) * w * s).toFixed(1)}`
  return `M${x.toFixed(1)} ${y.toFixed(1)} C${side(1, m1, width)} ${side(1, m2, width * 0.7)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)} C${side(-1, m2, width * 0.7)} ${side(-1, m1, width)} ${x.toFixed(1)} ${y.toFixed(1)}Z`
}

function fern(a: Pt, c: Pt, b: Pt, pairs: number, size: number): string {
  let d = ''
  for (let i = 1; i <= pairs; i++) {
    const t = i / (pairs + 1)
    const { p, angle } = onCurve(a, c, b, t)
    const len = size * (1 - t * 0.78) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.6)))
    const w = len * 0.22
    d += leaflet(p, angle - 1.05, len, w) + leaflet(p, angle + 1.05, len, w)
  }
  const tip = onCurve(a, c, b, 0.97)
  return d + leaflet(tip.p, tip.angle, size * 0.18, size * 0.05)
}

function stem(a: Pt, c: Pt, b: Pt): string {
  return `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`
}

const FERN_A = fern([40, 600], [140, 330], [330, 70], 17, 120)
const FERN_B = fern([620, 640], [560, 420], [610, 190], 13, 92)
const FERN_C = fern([930, 610], [1000, 460], [1130, 380], 10, 70)

export function Botanical({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 640" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <g fill="currentColor">
        <path d={FERN_A} />
        <path d={FERN_B} />
        <path d={FERN_C} />
        {/* a round leaf and a few seed heads */}
        <path d="M980 120c60-40 150-20 170 50 15 55-30 110-95 105-75-5-120-100-75-155z" opacity=".8" />
        {[
          [820, 90],
          [860, 140],
          [790, 170],
          [250, 560],
          [300, 600]
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={6 + (i % 3) * 3} opacity=".7" />
        ))}
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d={stem([40, 600], [140, 330], [330, 70])} />
        <path d={stem([620, 640], [560, 420], [610, 190])} />
        <path d={stem([930, 610], [1000, 460], [1130, 380])} />
        <path d="M1150 175c-50 20-110 40-170-55" strokeWidth="2" opacity=".6" />
      </g>
    </svg>
  )
}

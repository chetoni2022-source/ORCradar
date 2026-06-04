type RadarMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Marca animada do ORCradar — anéis concêntricos com uma varredura girando e
 * um "blip" piscando, evocando um radar. Respeita prefers-reduced-motion.
 */
export function RadarMark({ size = 72, className = '' }: RadarMarkProps) {
  return (
    <span
      className={`radar-mark ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="radar-ring" />
      <span className="radar-ring r2" />
      <span className="radar-ring r3" />
      <span className="radar-sweep" />
      <span className="radar-blip" />
      <span className="radar-core" />
    </span>
  );
}

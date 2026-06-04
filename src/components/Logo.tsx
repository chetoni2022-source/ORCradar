import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  onDark?: boolean;
  style?: CSSProperties;
  className?: string;
  /** Esconde o ponto verde de assinatura. */
  noDot?: boolean;
};

/**
 * Wordmark do ORCradar — mesma família visual do ORCtech: "ORC" na cor do
 * texto, "radar" em verde, e o ponto verde de assinatura no fim.
 */
export function Logo({ size = 20, onDark = false, style, className = '', noDot = false }: LogoProps) {
  return (
    <span
      className={`logo ${onDark ? 'logo-on-dark' : ''} ${className}`.trim()}
      style={{ fontSize: size, ...style }}
      aria-label="ORCradar"
    >
      <span className="orc">ORC</span>
      <span className="radar">radar</span>
      {!noDot && <span className="logo-dot" aria-hidden />}
    </span>
  );
}

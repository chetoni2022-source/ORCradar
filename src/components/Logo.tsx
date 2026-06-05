import type { CSSProperties } from 'react';

type LogoProps = {
  /** Altura do logo em px (a largura ajusta sozinha). */
  size?: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * Wordmark oficial do ORCradar (o "O" é o radar). Troca automaticamente entre
 * a versão pra fundo claro e a pra fundo escuro conforme o tema (classe `dark`
 * no <html>).
 */
export function Logo({ size = 22, style, className = '' }: LogoProps) {
  return (
    <span className={`logo-img ${className}`.trim()} style={{ height: size, ...style }} aria-label="ORCradar">
      <img className="logo-img-light" src="/brand/orcradar-onlight.png" alt="ORCradar" />
      <img className="logo-img-dark" src="/brand/orcradar-ondark.png" alt="ORCradar" />
    </span>
  );
}

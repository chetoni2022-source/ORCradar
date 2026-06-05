import { calcularScore, COR_HEX, COR_LABEL, type ScoreInput } from '../lib/score';

/** Badge de score com popover explicando como é calculado (hover/foco). */
export function ScoreBadge({ lead }: { lead: ScoreInput }) {
  const { score, cor, parcelas } = calcularScore(lead);
  return (
    <span className="score-badge-wrap" tabIndex={0}>
      <span className={`badge badge-${cor} score-badge`}><span className="dot" /> {score}</span>
      <span className="score-pop" role="tooltip">
        <div className="score-pop-head">
          <span className={`badge badge-${cor}`}><span className="dot" /> {COR_LABEL[cor]}</span>
          <span className="score-pop-total tnum">{score}<span className="t-faint" style={{ fontSize: 12 }}>/100</span></span>
        </div>
        <div>
          {parcelas.map((p, i) => (
            <div key={i} className="score-pop-row">
              <span className="score-pop-label">{p.label}</span>
              <span className="score-pop-bar"><span style={{ width: `${Math.round((p.pontos / p.max) * 100)}%`, background: p.pontos > 0 ? COR_HEX[cor] : 'var(--gray-300)' }} /></span>
              <span className="score-pop-pts">+{p.pontos}</span>
            </div>
          ))}
        </div>
        <div className="score-pop-hint">Mais avaliações, melhor nota e mais fácil de contatar = lead mais quente.</div>
      </span>
    </span>
  );
}

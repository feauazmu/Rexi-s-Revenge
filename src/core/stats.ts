/** What a Run scored: shown on the HUD and the Veredicto, sent with `run-ended`, kept in the top 10. */
export interface RunStats {
  readonly score: number;
  /** Enemies destroyed ("demandas desestimadas" in the UI). */
  readonly enemiesDestroyed: number;
  /** Run ticks survived (including the tick of the fatal hit, once the Run has ended). */
  readonly ticksSurvived: number;
}

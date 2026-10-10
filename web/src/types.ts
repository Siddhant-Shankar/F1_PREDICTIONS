// Shapes of the JSON written by `python -m f1pred export-web`.

export interface ForecastRow {
  driver: string;
  team: string;
  grid: number;
  finish: number;
  p_win: number;
  p_podium: number;
  p_points: number;
}

export interface RaceForecast {
  round: number;
  event: string;
  spearman: number;
  podium_hits: number;
  winner_hit: boolean;
  temperature: number;
  replay: boolean;
  outline: [number, number][] | null;
  rows: ForecastRow[]; // sorted by model score, favourite first
}

export interface SeasonForecasts {
  season: number;
  model: string;
  races: RaceForecast[];
}

export interface Car {
  code: string;
  team: string;
  color: string;
  grid: number;
  finish: number | null;
  status: string;
  until: number; // first frame after the car's last timed lap
  x: number[];
  y: number[];
  z: number[];
}

export interface Replay {
  season: number;
  round: number;
  event: string;
  circuit: string;
  total_laps: number;
  lap_length_m: number;
  dt: number;
  frames: number;
  track: [number, number, number][];
  cars: Car[];
  lap_starts: number[];
  order: Record<string, string[]>; // running order at the end of each lap
}

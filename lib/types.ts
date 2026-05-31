export type ScoringSystem = 'strokeplay' | 'stableford';
export type RoundStatus = 'active' | 'finished';

export interface Player {
  id: string;
  name: string;
  handicap: number;
  scores: (number | null)[]; // index = hole-1, null = not yet played
}

export interface Round {
  id?: string;
  courseName: string;
  location?: string;
  holes: 9 | 18;
  scoringSystem: ScoringSystem;
  createdAt: number;
  finishedAt?: number;
  status: RoundStatus;
  players: Player[];
}

export interface Activity {
  id?: string;
  name: string;
  description?: string;
  location?: string;
  image?: string; // base64
  dateTime: number;
  createdAt: number;
}

export interface LeaderboardEntry {
  player: Player;
  totalStrokes: number;
  stablefordPoints: number;
  holesPlayed: number;
  position: number;
  toPar: number;
}

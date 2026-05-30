import { Player, LeaderboardEntry, Round } from './types';

const DEFAULT_PAR = 4;

export function getParForHole(hole: number): number {
  // Placeholder: alle holes par 4. Vervang later met echte baandata.
  return DEFAULT_PAR;
}

export function getTotalPar(holes: number): number {
  return Array.from({ length: holes }, (_, i) => getParForHole(i + 1)).reduce((a, b) => a + b, 0);
}

export function calculateStrokeplayTotal(scores: (number | null)[]): number {
  return scores.filter((s): s is number => s !== null).reduce((sum, s) => sum + s, 0);
}

export function calculateStablefordPoints(scores: (number | null)[], handicap: number, holes: number): number {
  return scores.reduce<number>((total, strokes, index) => {
    if (strokes === null) return total;
    const hole = index + 1;
    const par = getParForHole(hole);
    // Verdeel handicap over holes: extra slag op laagste stroke-index holes
    const extraStrokes = Math.floor(handicap / holes) + (hole <= handicap % holes ? 1 : 0);
    const net = strokes - extraStrokes;
    const diff = par - net;
    return total + Math.max(0, diff + 2);
  }, 0);
}

export function buildLeaderboard(round: Round): LeaderboardEntry[] {
  const { players, holes, scoringSystem } = round;
  const totalPar = getTotalPar(holes);

  const entries: LeaderboardEntry[] = players.map((player) => {
    const filledScores = player.scores.slice(0, holes);
    const holesPlayed = filledScores.filter((s) => s !== null).length;
    const totalStrokes = calculateStrokeplayTotal(filledScores);
    const stablefordPoints = calculateStablefordPoints(filledScores, player.handicap, holes);
    const toPar = totalStrokes - totalPar;

    return {
      player,
      totalStrokes,
      stablefordPoints,
      holesPlayed,
      toPar,
      position: 0,
    };
  });

  if (scoringSystem === 'stableford') {
    entries.sort((a, b) => b.stablefordPoints - a.stablefordPoints || a.player.name.localeCompare(b.player.name));
  } else {
    entries.sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return a.player.name.localeCompare(b.player.name);
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.totalStrokes - b.totalStrokes || a.player.name.localeCompare(b.player.name);
    });
  }

  let position = 1;
  entries.forEach((entry, index) => {
    if (index > 0) {
      const prev = entries[index - 1];
      const tied =
        scoringSystem === 'stableford'
          ? entry.stablefordPoints === prev.stablefordPoints
          : entry.totalStrokes === prev.totalStrokes && entry.holesPlayed > 0;
      if (!tied) position = index + 1;
    }
    entry.position = entry.holesPlayed === 0 ? 0 : position;
  });

  return entries;
}

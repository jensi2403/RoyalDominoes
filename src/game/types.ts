export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Tile = [PipValue, PipValue];
export type PlayerId = 0 | 1 | 2 | 3;
export type PlayEnd = 'left' | 'right';
export type TileOrientation = 'up' | 'down';
export type BoardDir = 'right' | 'left' | 'up' | 'down';

export interface PlacedTile {
  left: PipValue;
  right: PipValue;
  isDouble: boolean;
  playedBy: PlayerId;
  orientation: TileOrientation;
  x: number;
  y: number;
  rotation: number;
  rotationDeg: number;
}

export interface BoardState {
  tiles: PlacedTile[];
  leftEnd: PipValue | null;
  rightEnd: PipValue | null;
  leftDir: BoardDir;
  rightDir: BoardDir;
  occupied: Set<string>;
}

export interface ValidPlay {
  tile: Tile;
  end: PlayEnd;
}

export type GamePhase = 'setup' | 'playing' | 'roundEnd' | 'gameEnd';
export type Lang = 'es' | 'en';

export interface RoundResult {
  winner: PlayerId | null;
  winningTeam: 0 | 1 | null;
  scores: [number, number];
  isTranca: boolean;
  hands: Tile[][];
}

export interface GameState {
  phase: GamePhase;
  hands: Tile[][];
  board: BoardState;
  currentPlayer: PlayerId;
  consecutivePasses: number;
  scores: [number, number];
  roundNumber: number;
  targetScore: number;
  startingPlayer: PlayerId;
  selectedTile: Tile | null;
  choosingEnd: boolean;
  validPlays: ValidPlay[];
  lastAction: string | null;
  lastPlayedBy: PlayerId | null;
  roundResult: RoundResult | null;
  gameWinner: 0 | 1 | null;
  debugMode: boolean;
  lang: Lang;
  aiThinking: boolean;
}

export const PLAYER_NAMES_ES: Record<PlayerId, string> = {
  0: 'Tú',
  1: 'Derecho',
  2: 'Compañero',
  3: 'Izquierdo',
};

export const PLAYER_NAMES_EN: Record<PlayerId, string> = {
  0: 'You',
  1: 'Right',
  2: 'Partner',
  3: 'Left',
};

export function getPlayerName(id: PlayerId, lang: Lang): string {
  return lang === 'es' ? PLAYER_NAMES_ES[id] : PLAYER_NAMES_EN[id];
}

export function getTeam(playerId: PlayerId): 0 | 1 {
  return playerId === 0 || playerId === 2 ? 0 : 1;
}

export function getPartner(playerId: PlayerId): PlayerId {
  const partners: Record<PlayerId, PlayerId> = { 0: 2, 1: 3, 2: 0, 3: 1 };
  return partners[playerId];
}
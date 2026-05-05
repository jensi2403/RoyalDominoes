import type { Tile, PipValue, PlayerId, BoardState, ValidPlay, RoundResult, GameState, TileOrientation, BoardDir } from './types';

export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = 0; b <= a; b++) {
      tiles.push([a as PipValue, b as PipValue]);
    }
  }
  return tiles;
}

export function shuffle(tiles: Tile[]): Tile[] {
  const arr = [...tiles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function deal(shuffled: Tile[]): Tile[][] {
  return [
    shuffled.slice(0, 7),
    shuffled.slice(7, 14),
    shuffled.slice(14, 21),
    shuffled.slice(21, 28),
  ];
}

export function findStartingPlayer(hands: Tile[][], roundNumber: number, previousWinner: PlayerId | null): PlayerId {
  if (roundNumber > 1 && previousWinner !== null) {
    return previousWinner;
  }
  for (let i = 0; i < 4; i++) {
    if (hands[i].some(([a, b]) => a === 6 && b === 6)) {
      return i as PlayerId;
    }
  }
  return 0;
}

export function tileSum(tile: Tile): number {
  return tile[0] + tile[1];
}

export function handSum(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tileSum(tile), 0);
}

export function getValidPlays(hand: Tile[], board: BoardState, isFirstPlay: boolean): ValidPlay[] {
  if (board.tiles.length === 0) {
    if (isFirstPlay) {
      const has66 = hand.some(([a, b]) => a === 6 && b === 6);
      if (has66) {
        return hand
          .filter(([a, b]) => a === 6 && b === 6)
          .map(tile => ({ tile, end: 'right' as const }));
      }
      return [];
    }
    return hand.map(tile => ({ tile, end: 'right' as const }));
  }

  const plays: ValidPlay[] = [];
  const seen = new Set<string>();

  for (const tile of hand) {
    const [a, b] = tile;

    if (a === board.leftEnd || b === board.leftEnd) {
      const key = `${a},${b},left`;
      if (!seen.has(key)) {
        seen.add(key);
        plays.push({ tile, end: 'left' });
      }
    }

    if (a === board.rightEnd || b === board.rightEnd) {
      const key = `${a},${b},right`;
      if (!seen.has(key)) {
        seen.add(key);
        plays.push({ tile, end: 'right' });
      }
    }
  }

  return plays;
}

export function getTileOrientation(tile: Tile, end: 'left' | 'right', board: BoardState): TileOrientation {
  const [a, b] = tile;
  if (a !== b) return 'up';

  if (board.tiles.length === 0) return 'up';

  if (end === 'left') {
    return board.leftEnd === a ? 'up' : 'down';
  } else {
    return board.rightEnd === a ? 'up' : 'down';
  }
}

/* ── Snake board layout ────────────────────────────────────────────── */

const GRID_W = 20;
const GRID_H = 12;
const MARGIN = 4;

const VECTORS: Record<BoardDir, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

const TURN_CW: Record<BoardDir, BoardDir> = {
  right: 'down',
  down: 'left',
  left: 'up',
  up: 'right',
};

const TURN_CCW: Record<BoardDir, BoardDir> = {
  right: 'up',
  up: 'left',
  left: 'down',
  down: 'right',
};

function isFree(occupied: Set<string>, x: number, y: number): boolean {
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return false;
  if (y < MARGIN || y >= GRID_H - MARGIN) return false;
  return !occupied.has(`${x},${y}`);
}

function findNextDir(
  occupied: Set<string>,
  fromX: number,
  fromY: number,
  currentDir: BoardDir,
): BoardDir {
  const [dx, dy] = VECTORS[currentDir];
  if (isFree(occupied, fromX + dx, fromY + dy)) return currentDir;

  const ccw = TURN_CCW[currentDir];
  const [ccwDx, ccwDy] = VECTORS[ccw];
  if (isFree(occupied, fromX + ccwDx, fromY + ccwDy)) return ccw;

  const cw = TURN_CW[currentDir];
  const [cwDx, cwDy] = VECTORS[cw];
  if (isFree(occupied, fromX + cwDx, fromY + cwDy)) return cw;

  return currentDir;
}

function getGridRotation(dir: BoardDir, isDouble: boolean): number {
  if (isDouble) {
    return dir === 'right' || dir === 'left' ? 90 : 0;
  }
  switch (dir) {
    case 'right': return 0;
    case 'left': return 180;
    case 'up': return -90;
    case 'down': return 90;
  }
}

function getDoubleRotationDeg(incomingDir: BoardDir): number {
  return 0;
}

export function playTileOnBoard(board: BoardState, tile: Tile, end: 'left' | 'right'): BoardState {
  const [a, b] = tile;
  const isDouble = a === b;
  const orientation = getTileOrientation(tile, end, board);

  if (board.tiles.length === 0) {
    const cx = Math.floor(GRID_W / 2);
    const cy = Math.floor(GRID_H / 2);
    const rotationDeg = getDoubleRotationDeg('right');
    const result = {
      tiles: [{
        left: a, right: b, isDouble, playedBy: 0 as PlayerId, orientation,
        x: cx, y: cy, rotation: 0, rotationDeg: isDouble ? rotationDeg : 0,
      }],
      leftEnd: a,
      rightEnd: b,
      leftDir: 'left' as BoardDir,
      rightDir: 'right' as BoardDir,
      occupied: new Set([`${cx},${cy}`]),
    };
    return result;
  }

  const newTiles = [...board.tiles];
  const occupied = new Set(board.occupied);

  let refTile = end === 'left' ? board.tiles[0] : board.tiles[board.tiles.length - 1];
  let currentDir = end === 'left' ? board.leftDir : board.rightDir;

  const nextDir = findNextDir(occupied, refTile.x, refTile.y, currentDir);
  const [dx, dy] = VECTORS[nextDir];
  const newX = refTile.x + dx;
  const newY = refTile.y + dy;

  occupied.add(`${newX},${newY}`);
  const rotation = getGridRotation(nextDir, isDouble);
  const rotationDeg = isDouble ? getDoubleRotationDeg(nextDir) : 0;

  if (end === 'left') {
    const matchValue = board.leftEnd!;
    let left: PipValue, right: PipValue;
    if (a === matchValue) {
      right = a;
      left = b;
    } else {
      right = b;
      left = a;
    }
    newTiles.unshift({
      left: left as PipValue, right: right as PipValue,
      isDouble, playedBy: 0 as PlayerId, orientation,
      x: newX, y: newY, rotation, rotationDeg,
    });
    const result = {
      tiles: newTiles,
      leftEnd: left as PipValue,
      rightEnd: board.rightEnd,
      leftDir: nextDir,
      rightDir: board.rightDir,
      occupied,
    };
    return result;
  } else {
    const matchValue = board.rightEnd!;
    let left: PipValue, right: PipValue;
    if (a === matchValue) {
      left = a;
      right = b;
    } else {
      left = b;
      right = a;
    }
    newTiles.push({
      left: left as PipValue, right: right as PipValue,
      isDouble, playedBy: 0 as PlayerId, orientation,
      x: newX, y: newY, rotation, rotationDeg,
    });
    const result = {
      tiles: newTiles,
      leftEnd: board.leftEnd,
      rightEnd: right as PipValue,
      leftDir: board.leftDir,
      rightDir: nextDir,
      occupied,
    };
    return result;
  }
}

export function canPlay(hand: Tile[], board: BoardState, isFirstPlay: boolean): boolean {
  return getValidPlays(hand, board, isFirstPlay).length > 0;
}

export function removeTileFromHand(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.findIndex(([a, b]) => a === tile[0] && b === tile[1]);
  if (idx === -1) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

export function nextPlayer(current: PlayerId): PlayerId {
  return ((current + 1) % 4) as PlayerId;
}

export function checkRoundEnd(state: GameState): RoundResult | null {
  for (let i = 0; i < 4; i++) {
    if (state.hands[i].length === 0) {
      const winningTeam = (i === 0 || i === 2) ? 0 : 1;
      const opponents: PlayerId[] = winningTeam === 0 ? [1, 3] : [0, 2];
      const score: number = opponents.reduce((sum: number, p: PlayerId) => sum + handSum(state.hands[p]), 0);
      const scores: [number, number] = [0, 0];
      scores[winningTeam] = score;
      return {
        winner: i as PlayerId,
        winningTeam: winningTeam as 0 | 1,
        scores,
        isTranca: false,
        hands: state.hands.map(h => [...h]) as Tile[][],
      };
    }
  }

  if (state.consecutivePasses >= 4) {
    const team0Pips = handSum(state.hands[0]) + handSum(state.hands[2]);
    const team1Pips = handSum(state.hands[1]) + handSum(state.hands[3]);

    if (team0Pips < team1Pips) {
      const scores: [number, number] = [team1Pips - team0Pips, 0];
      return {
        winner: null,
        winningTeam: 0,
        scores,
        isTranca: true,
        hands: state.hands.map(h => [...h]) as Tile[][],
      };
    } else if (team1Pips < team0Pips) {
      const scores: [number, number] = [0, team0Pips - team1Pips];
      return {
        winner: null,
        winningTeam: 1,
        scores,
        isTranca: true,
        hands: state.hands.map(h => [...h]) as Tile[][],
      };
    } else {
      return {
        winner: null,
        winningTeam: null,
        scores: [0, 0],
        isTranca: true,
        hands: state.hands.map(h => [...h]) as Tile[][],
      };
    }
  }

  return null;
}

export function getPlayableTileEnds(tile: Tile, board: BoardState): ('left' | 'right')[] {
  if (board.tiles.length === 0) return ['right'];
  const [a, b] = tile;
  const ends: ('left' | 'right')[] = [];
  if (a === board.leftEnd || b === board.leftEnd) ends.push('left');
  if (a === board.rightEnd || b === board.rightEnd) ends.push('right');
  return ends;
}
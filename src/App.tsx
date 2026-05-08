import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Tile, PlayerId, BoardState, ValidPlay, GameState, PipValue, Lang, TileOrientation, PlacedTile } from './game/types';
import { getPlayerName, getTeam } from './game/types';
import { createTileSet, shuffle, deal, findStartingPlayer, getValidPlays, playTileOnBoard, removeTileFromHand, nextPlayer, checkRoundEnd, handSum, canPlay } from './game/engine';
import { chooseAIPlay } from './game/ai';
import { t } from './game/i18n';
import { playPlaceSound, playPassSound, playWinSound, playLoseSound, playDealSound, playSelectSound, playTrancaSound, playClickSound } from './game/sounds';

const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[2, 2]],
  2: [[1, 3], [3, 1]],
  3: [[1, 3], [2, 2], [3, 1]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

function PipGrid({ value }: { value: number }) {
  const positions = PIP_POSITIONS[value] || [];
  return (
    <div className="domino-half">
      {positions.map(([row, col], i) => (
        <div
          key={i}
          className="pip"
          style={{
            gridRow: row,
            gridColumn: col,
          }}
        />
      ))}
    </div>
  );
}

function DominoTile({
  tile,
  faceDown = false,
  playable = false,
  selected = false,
  notPlayable = false,
  onClick,
  onTopHalfClick,
  onBottomHalfClick,
  highlightHalves = false,
  onDragStart,
  size = 'normal',
  orientation = 'up',
  className = '',
}: {
  tile?: Tile;
  faceDown?: boolean;
  playable?: boolean;
  selected?: boolean;
  notPlayable?: boolean;
  onClick?: () => void;
  onTopHalfClick?: () => void;
  onBottomHalfClick?: () => void;
  highlightHalves?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  size?: 'normal' | 'small' | 'side';
  orientation?: TileOrientation;
  className?: string;
}) {
  const classes = [
    'domino-tile',
    faceDown ? 'face-down' : '',
    playable ? 'playable' : '',
    selected ? 'selected' : '',
    notPlayable ? 'not-playable' : '',
    size === 'small' ? 'board-tile' : '',
    size === 'side' ? 'side-tile' : '',
    className,
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={classes} onClick={onClick} draggable={!!onDragStart} onDragStart={onDragStart} />;
  }

  if (!tile) return null;

  const [a, b] = tile;

  return (
    <div className={classes} onClick={onClick} draggable={!!onDragStart} onDragStart={onDragStart}>
      <div
        className={`domino-half ${highlightHalves ? 'clickable-half' : ''}`}
        onClick={highlightHalves ? (e) => { e.stopPropagation(); onTopHalfClick?.(); } : undefined}
      >
        <PipGrid value={a} />
      </div>
      <div className="domino-divider" />
      <div
        className={`domino-half ${highlightHalves ? 'clickable-half' : ''}`}
        onClick={highlightHalves ? (e) => { e.stopPropagation(); onBottomHalfClick?.(); } : undefined}
      >
        <PipGrid value={b} />
      </div>
    </div>
  );
}

const TILE_LONG = 72;
const TILE_SHORT = 40;
const GRID_W = 20;
const GRID_H = 12;
const CANVAS_W = GRID_W * TILE_LONG;      // 1000
const CANVAS_H = GRID_H * TILE_SHORT;     // 336
const ANCHOR_GX = Math.floor(GRID_W / 2); // 10 — fixed grid anchor (first tile always here)
const ANCHOR_GY = Math.floor(GRID_H / 2); // 6
const CANVAS_CX = Math.floor(CANVAS_W / 2);
const CANVAS_CY = Math.floor(CANVAS_H / 2);

function BoardPipGrid({ value }: { value: number }) {
  const positions = PIP_POSITIONS[value] || [];
  return (
    <>
      {positions.map(([row, col], i) => (
        <div
          key={i}
          className="pip"
          style={{
            gridRow: row,
            gridColumn: col,
          }}
        />
      ))}
    </>
  );
}

// Returns whether tile i is in a horizontal chain segment, based on neighbor positions
function tileIsHoriz(tiles: PlacedTile[], i: number): boolean {
  if (i < tiles.length - 1) return tiles[i + 1].x !== tiles[i].x;
  if (i > 0) return tiles[i].x !== tiles[i - 1].x;
  return true; // single tile defaults to horizontal
}

// Compute pixel positions anchored to the first tile (grid center) so existing
// tiles never shift when new tiles are added to either end.
function computePixelPositions(tiles: PlacedTile[]): { px: number; py: number }[] {
  if (tiles.length === 0) return [];

  const result = new Array<{ px: number; py: number }>(tiles.length);

  let anchorIdx = tiles.findIndex(t => t.x === ANCHOR_GX && t.y === ANCHOR_GY);
  if (anchorIdx === -1) anchorIdx = 0;
  result[anchorIdx] = { px: 0, py: 0 };

  for (let i = anchorIdx + 1; i < tiles.length; i++) {
    const gdx = tiles[i].x - tiles[i - 1].x;
    const gdy = tiles[i].y - tiles[i - 1].y;
    const horiz = gdx !== 0;
    const step = tiles[i - 1].isDouble
      ? (horiz ? TILE_SHORT : TILE_LONG)
      : (horiz ? TILE_LONG : TILE_SHORT);
    result[i] = { px: result[i - 1].px + gdx * step, py: result[i - 1].py + gdy * step };
  }

  for (let i = anchorIdx - 1; i >= 0; i--) {
    const gdx = tiles[i + 1].x - tiles[i].x;
    const gdy = tiles[i + 1].y - tiles[i].y;
    const horiz = gdx !== 0;
    const step = tiles[i].isDouble
      ? (horiz ? TILE_SHORT : TILE_LONG)
      : (horiz ? TILE_LONG : TILE_SHORT);
    result[i] = { px: result[i + 1].px - gdx * step, py: result[i + 1].py - gdy * step };
  }

  return result;
}

function BoardTile({ placed, px, py, horiz }: { placed: PlacedTile; px: number; py: number; horiz: boolean }) {
  const rot180 = placed.rotation === 180;
  const a = rot180 ? placed.right : placed.left;
  const b = rot180 ? placed.left : placed.right;

  if (placed.isDouble) {
    // Double: perpendicular to chain direction
    // Horizontal chain → 28W × 50H (column layout)
    // Vertical chain   → 50W × 28H (row layout)
    const w = horiz ? TILE_SHORT : TILE_LONG;
    const h = horiz ? TILE_LONG : TILE_SHORT;
    return (
      <div
        className="board-tile-abs"
        style={{
          left: px, top: py, width: w, height: h,
          flexDirection: horiz ? 'column' : 'row',
        }}
      >
        <div className="domino-half"><BoardPipGrid value={a} /></div>
        <div className="domino-divider" style={horiz
          ? { position: 'absolute', left: 2, right: 2, top: '50%', width: 'auto', height: 1, transform: 'translateY(-50%)' }
          : { position: 'absolute', top: 2, bottom: 2, left: '50%', width: 1, height: 'auto', transform: 'translateX(-50%)' }
        } />
        <div className="domino-half"><BoardPipGrid value={b} /></div>
      </div>
    );
  }

  // Normal tile: 50×28, CSS rotation handles visual orientation
  // Center the 28px short side in the 50px lane (offsetY for horiz, handled by rotation for vert)
  const transform = placed.rotation !== 0 ? `rotate(${placed.rotation}deg)` : undefined;
  return (
    <div
      className="board-tile-abs"
      style={{ left: px, top: py + 11, transform }}
    >
      <div className="domino-half"><BoardPipGrid value={a} /></div>
      <div className="domino-divider" />
      <div className="domino-half"><BoardPipGrid value={b} /></div>
    </div>
  );
}

function BoardChain({ board }: { board: BoardState }) {
  if (board.tiles.length === 0) {
    return <div className="board-area" />;
  }

  const pixelPos = computePixelPositions(board.tiles);

  return (
    <div className="board-area">
      <div style={{ width: CANVAS_W, height: CANVAS_H, position: 'relative', flexShrink: 0 }}>
        {board.tiles.map((placed, i) => (
          <BoardTile
            key={i}
            placed={placed}
            px={CANVAS_CX + pixelPos[i].px}
            py={CANVAS_CY + pixelPos[i].py}
            horiz={tileIsHoriz(board.tiles, i)}
          />
        ))}
      </div>
    </div>
  );
}

const HAND_ROTATION: Record<'bottom' | 'top' | 'left' | 'right', 0 | 90 | 180 | 270> = {
  bottom: 0,
  top: 180,
  left: 90,
  right: 270,
};

function PlayerHand({
  hand,
  isHuman,
  isCurrentPlayer,
  validPlays,
  selectedTile,
  onSelectTile,
  onTopHalfClick,
  onBottomHalfClick,
  choosingEnd,
  playedBy,
  label,
  debugMode,
  lang,
  canPlayNow,
  onPass,
  position,
}: {
  hand: Tile[];
  isHuman: boolean;
  isCurrentPlayer: boolean;
  validPlays: ValidPlay[];
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile) => void;
  onTopHalfClick?: (tile: Tile, half: 'top' | 'bottom') => void;
  onBottomHalfClick?: (tile: Tile, half: 'top' | 'bottom') => void;
  choosingEnd?: boolean;
  playedBy: PlayerId;
  label: string;
  debugMode: boolean;
  lang: Lang;
  canPlayNow: boolean;
  onPass?: () => void;
  position: 'bottom' | 'top' | 'left' | 'right';
}) {
  const showFace = isHuman || debugMode;
  const isSide = position === 'left' || position === 'right';
  const tileSize = isHuman ? 'normal' : position === 'top' ? 'small' : 'side';

  const getTileClass = (tile: Tile) => {
    if (!isHuman || !isCurrentPlayer) return '';
    const isPlayable = validPlays.some(vp => vp.tile[0] === tile[0] && vp.tile[1] === tile[1]);
    const isSelected = selectedTile && selectedTile[0] === tile[0] && selectedTile[1] === tile[1];
    if (isSelected) return 'selected';
    if (isPlayable) return 'playable';
    if (validPlays.length > 0) return 'not-playable';
    return '';
  };

  const sortedHand = isHuman ? [...hand].sort((a, b) => (b[0] + b[1]) - (a[0] + a[1])) : hand;

  return (
    <div className={`player-area ${isSide ? 'side' : ''} ${position}`}>
      <div className={`player-label ${isCurrentPlayer ? 'active' : ''}`}>
        {label}
        {isCurrentPlayer && !isHuman && <span style={{ marginLeft: 4, opacity: 0.7 }}> ···</span>}
        <span className="pip-count">({hand.length})</span>
      </div>
      <div className="player-hand">
        {sortedHand.map((tile, i) => {
          const tileClass = getTileClass(tile);
          const isPlayable = isHuman && isCurrentPlayer && validPlays.some(vp => vp.tile[0] === tile[0] && vp.tile[1] === tile[1]);
          const isSelected = selectedTile !== null && tile[0] === selectedTile[0] && tile[1] === selectedTile[1];
          const showHalves = isSelected && choosingEnd && isHuman && isCurrentPlayer;
          return (
            <div
              key={`${tile[0]}-${tile[1]}-${i}`}
              style={{
                transform: `rotate(${HAND_ROTATION[position]}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <DominoTile
                tile={tile}
                faceDown={!showFace}
                playable={isPlayable}
                selected={isSelected}
                notPlayable={isHuman && isCurrentPlayer && validPlays.length > 0 && !isPlayable}
                onClick={isHuman && isPlayable ? () => onSelectTile(tile) : undefined}
                onTopHalfClick={showHalves ? () => onTopHalfClick?.(tile, 'top') : undefined}
                onBottomHalfClick={showHalves ? () => onBottomHalfClick?.(tile, 'bottom') : undefined}
                highlightHalves={showHalves}
                onDragStart={isHuman && isPlayable ? (e: React.DragEvent) => {
                  e.dataTransfer.setData('tile', `${tile[0]},${tile[1]}`);
                  e.dataTransfer.effectAllowed = 'move';
                } : undefined}
                size={tileSize as 'normal' | 'small' | 'side'}
                className={tileClass}
              />
            </div>
          );
        })}
      </div>
      {isHuman && isCurrentPlayer && onPass && (
        <div style={{ marginTop: 4, textAlign: 'center' }}>
          {canPlayNow ? (
            <div style={{ fontSize: 10, opacity: 0.5 }}>
              {t('game.yourTurn', lang)}
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#ff8888', fontWeight: 700, marginBottom: 4 }}>
                {t('hand.noPlays', lang)}
              </div>
              <button className="btn btn-pass" onClick={onPass}>
                {t('game.pass', lang)}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SetupScreen({ onStart, lang }: { onStart: (target: number) => void; lang: Lang }) {
  const [target, setTarget] = useState(100);

  return (
    <div className="setup-screen">
      <div className="setup-card fade-in">
        <div className="setup-title">🁣 {t('app.title', lang)}</div>
        <div className="setup-subtitle">{t('setup.subtitle', lang)}</div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            {t('setup.targetScore', lang)}
          </div>
          <div className="target-options">
            {[100, 150, 200].map(score => (
              <div
                key={score}
                className={`target-option ${target === score ? 'selected' : ''}`}
                onClick={() => setTarget(score)}
              >
                {score}
              </div>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => onStart(target)} style={{ fontSize: 16, padding: '12px 32px' }}>
          {t('setup.start', lang)}
        </button>
      </div>
    </div>
  );
}

function RoundEndOverlay({
  result,
  scores,
  lang,
  onNext,
}: {
  result: GameState['roundResult'];
  scores: [number, number];
  lang: Lang;
  onNext: () => void;
}) {
  if (!result) return null;

  const winnerName = result.winner !== null ? getPlayerName(result.winner, lang) : null;
  const teamName = result.winningTeam === 0 ? t('score.us', lang) : t('score.them', lang);

  return (
    <div className="overlay fade-in">
      <div className="overlay-card slide-up">
        <div className="overlay-title">
          {result.isTranca ? t('round.tranca', lang) : t('round.title', lang)}
        </div>
        <div className="overlay-text">
          {result.isTranca
            ? t('round.trancaWin', lang, { team: teamName })
            : winnerName
              ? t('round.winnerOut', lang, { name: winnerName })
              : ''
          }
        </div>
        <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center', gap: 32 }}>
          <div className="score-team">
            <div className="score-team-name">{t('score.us', lang)}</div>
            <div className="score-value">+{result.scores[0]}</div>
          </div>
          <div className="score-team">
            <div className="score-team-name">{t('score.them', lang)}</div>
            <div className="score-value">+{result.scores[1]}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 16 }}>
          {t('score.us', lang)}: {scores[0]} · {t('score.them', lang)}: {scores[1]}
        </div>
        <button className="btn btn-primary" onClick={onNext}>
          {t('round.nextRound', lang)}
        </button>
      </div>
    </div>
  );
}

function GameEndOverlay({
  winningTeam,
  scores,
  lang,
  onPlayAgain,
}: {
  winningTeam: 0 | 1;
  scores: [number, number];
  lang: Lang;
  onPlayAgain: () => void;
}) {
  const teamName = winningTeam === 0 ? t('score.us', lang) : t('score.them', lang);

  return (
    <div className="overlay fade-in">
      <div className="overlay-card slide-up">
        <div className="overlay-title">🏆 {t('gameEnd.title', lang)}</div>
        <div className="overlay-text" style={{ fontSize: 18, marginBottom: 16 }}>
          {t('gameEnd.teamWins', lang, { team: teamName })}
        </div>
        <div className="overlay-text" style={{ marginBottom: 8 }}>{t('gameEnd.finalScore', lang)}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
          <div className="score-team">
            <div className="score-team-name">{t('score.us', lang)}</div>
            <div className="score-value">{scores[0]}</div>
          </div>
          <div className="score-team">
            <div className="score-team-name">{t('score.them', lang)}</div>
            <div className="score-value">{scores[1]}</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onPlayAgain} style={{ fontSize: 14, padding: '10px 28px' }}>
          {t('gameEnd.playAgain', lang)}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<GameState>({
    phase: 'setup',
    hands: [[], [], [], []],
    board: { tiles: [], leftEnd: null, rightEnd: null, leftDir: 'left', rightDir: 'right', occupied: new Set() },
    currentPlayer: 0,
    consecutivePasses: 0,
    scores: [0, 0],
    roundNumber: 1,
    targetScore: 100,
    startingPlayer: 0,
    selectedTile: null,
    choosingEnd: false,
    validPlays: [],
    lastAction: null,
    lastPlayedBy: null,
    roundResult: null,
    gameWinner: null,
    debugMode: false,
    lang: 'es',
    aiThinking: false,
  });

  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback((targetScore: number) => {
    const tiles = shuffle(createTileSet());
    const hands = deal(tiles);
    const starting = findStartingPlayer(hands, 1, null);
    const isFirstPlay = true;
    const validPlays = getValidPlays(hands[0], { tiles: [], leftEnd: null, rightEnd: null, leftDir: 'left', rightDir: 'right', occupied: new Set() }, isFirstPlay);

    playDealSound();

    setState({
      phase: 'playing',
      hands,
      board: { tiles: [], leftEnd: null, rightEnd: null, leftDir: 'left', rightDir: 'right', occupied: new Set() },
      currentPlayer: starting,
      consecutivePasses: 0,
      scores: [0, 0],
      roundNumber: 1,
      targetScore,
      startingPlayer: starting,
      selectedTile: null,
      choosingEnd: false,
      validPlays: starting === 0 ? validPlays : [],
      lastAction: null,
      lastPlayedBy: null,
      roundResult: null,
      gameWinner: null,
      debugMode: state.debugMode,
      lang: state.lang,
      aiThinking: starting !== 0,
    });
  }, [state.debugMode, state.lang]);

  const startNewRound = useCallback((previousWinner: PlayerId) => {
    const tiles = shuffle(createTileSet());
    const hands = deal(tiles);
    const starting = previousWinner;
    const isFirstPlay = false;
    const valid = starting === 0 ? getValidPlays(hands[0], { tiles: [], leftEnd: null, rightEnd: null, leftDir: 'left', rightDir: 'right', occupied: new Set() }, isFirstPlay) : [];

    playDealSound();

    setState(prev => ({
      ...prev,
      phase: 'playing',
      hands,
      board: { tiles: [], leftEnd: null, rightEnd: null, leftDir: 'left', rightDir: 'right', occupied: new Set() },
      currentPlayer: starting,
      consecutivePasses: 0,
      roundNumber: prev.roundNumber + 1,
      startingPlayer: starting,
      selectedTile: null,
      choosingEnd: false,
      validPlays: valid,
      lastAction: null,
      lastPlayedBy: null,
      roundResult: null,
      gameWinner: null,
      aiThinking: starting !== 0,
    }));
  }, []);

  const handleSelectTile = useCallback((tile: Tile) => {
    playSelectSound();

    setState(prev => {
      if (prev.phase !== 'playing' || prev.currentPlayer !== 0) return prev;

      const boardEmpty = prev.board.tiles.length === 0;
      const isFirstPlay = prev.roundNumber === 1;
      const validPlays = getValidPlays(prev.hands[0], prev.board, isFirstPlay);

      const validForTile = validPlays.filter(vp =>
        (vp.tile[0] === tile[0] && vp.tile[1] === tile[1]) ||
        (vp.tile[0] === tile[1] && vp.tile[1] === tile[0])
      );
      if (validForTile.length === 0) return prev;

      if (validForTile.length === 1 || boardEmpty) {
        const end = validForTile[0].end;
        const newBoard = playTileOnBoard(prev.board, tile, end);
        const newHands = prev.hands.map((h, i) => i === 0 ? removeTileFromHand(h, tile) : h) as Tile[][];
        const newConsecutivePasses = 0;

        const tempState: GameState = {
          ...prev,
          hands: newHands,
          board: newBoard,
          consecutivePasses: newConsecutivePasses,
          selectedTile: null,
          choosingEnd: false,
          validPlays: [],
          lastPlayedBy: 0,
        };

        const result = checkRoundEnd({ ...tempState, currentPlayer: prev.currentPlayer });
        if (result) {
          const newScores: [number, number] = [prev.scores[0] + result.scores[0], prev.scores[1] + result.scores[1]];
          const gameWinner = newScores[0] >= prev.targetScore ? 0 : newScores[1] >= prev.targetScore ? 1 : null;

          playPlaceSound();
          if (gameWinner !== null) {
            if (gameWinner === 0) playWinSound(); else playLoseSound();
          } else if (result.isTranca) {
            playTrancaSound();
          } else if (result.winner === 0 || result.winner === 2) {
            playWinSound();
          } else {
            playLoseSound();
          }

          if (gameWinner !== null) {
            return {
              ...tempState,
              phase: 'gameEnd' as const,
              scores: newScores,
              roundResult: result,
              gameWinner,
              aiThinking: false,
            };
          }

          return {
            ...tempState,
            phase: 'roundEnd' as const,
            scores: newScores,
            roundResult: result,
            aiThinking: false,
          };
        }

        const nextP = nextPlayer(0) as PlayerId;
        const isFirstPlay = prev.roundNumber === 1;
        const nextValidPlays = canPlay(newHands[nextP], newBoard, isFirstPlay) ? getValidPlays(newHands[nextP], newBoard, isFirstPlay) : [];
        const nextAiThinking = nextP !== 0;

        playPlaceSound();

        return {
          ...tempState,
          currentPlayer: nextP,
          validPlays: nextP === 0 ? nextValidPlays : [],
          aiThinking: nextAiThinking,
        };
      } else {
        return { ...prev, selectedTile: tile, choosingEnd: true };
      }
    });
  }, []);

  const executePlay = useCallback((tile: Tile, end: 'left' | 'right') => {
    setState(prev => {
      const newBoard = playTileOnBoard(prev.board, tile, end);
      const newHands = prev.hands.map((h, i) => i === 0 ? removeTileFromHand(h, tile) : h) as Tile[][];
      const newConsecutivePasses = 0;

      const tempState: GameState = {
        ...prev,
        hands: newHands,
        board: newBoard,
        consecutivePasses: newConsecutivePasses,
        selectedTile: null,
        choosingEnd: false,
        validPlays: [],
        lastPlayedBy: 0,
      };

      const result = checkRoundEnd({ ...tempState, currentPlayer: prev.currentPlayer });
      if (result) {
        const newScores: [number, number] = [prev.scores[0] + result.scores[0], prev.scores[1] + result.scores[1]];
        const gameWinner = newScores[0] >= prev.targetScore ? 0 : newScores[1] >= prev.targetScore ? 1 : null;

        playPlaceSound();
        if (gameWinner !== null) {
          if (gameWinner === 0) playWinSound(); else playLoseSound();
        } else if (result.isTranca) {
          playTrancaSound();
        } else if (result.winner === 0 || result.winner === 2) {
          playWinSound();
        } else {
          playLoseSound();
        }

        if (gameWinner !== null) {
          return { ...tempState, phase: 'gameEnd', scores: newScores, roundResult: result, gameWinner, aiThinking: false };
        }
        return { ...tempState, phase: 'roundEnd', scores: newScores, roundResult: result, aiThinking: false };
      }

      const nextP = nextPlayer(0) as PlayerId;
      const isFirstPlay = prev.roundNumber === 1;
      const nextValidPlays = canPlay(prev.hands[nextP], prev.board, isFirstPlay) ? getValidPlays(prev.hands[nextP], prev.board, isFirstPlay) : [];

      playPlaceSound();

      return {
        ...tempState,
        currentPlayer: nextP,
        validPlays: nextP === 0 ? nextValidPlays : [],
        aiThinking: nextP !== 0,
      };
    });
  }, []);

  const handleHalfClick = useCallback((tile: Tile, half: 'top' | 'bottom') => {
    playClickSound();
    const [a, b] = tile;
    const value = half === 'top' ? a : b;

    let end: 'left' | 'right' = 'right';

    if (state.board.leftEnd === value && state.board.rightEnd !== value) {
      end = 'left';
    } else if (state.board.rightEnd === value && state.board.leftEnd !== value) {
      end = 'right';
    } else if (state.board.leftEnd === value && state.board.rightEnd === value) {
      const otherValue = half === 'top' ? b : a;
      if (state.board.leftEnd === otherValue && state.board.rightEnd !== otherValue) {
        end = 'right';
      } else if (state.board.rightEnd === otherValue && state.board.leftEnd !== otherValue) {
        end = 'left';
      } else {
        end = 'right';
      }
    } else {
      return; // invalid click
    }

    executePlay(tile, end);
  }, [state.board.leftEnd, state.board.rightEnd, executePlay]);

  const handlePass = useCallback(() => {
    playPassSound();

    setState(prev => {
      if (prev.phase !== 'playing' || prev.currentPlayer !== 0) return prev;

      const newConsecutivePasses = prev.consecutivePasses + 1;
      const nextP = nextPlayer(0) as PlayerId;
      const isFirstPlay = prev.roundNumber === 1;

      const tempState: GameState = {
        ...prev,
        consecutivePasses: newConsecutivePasses,
        selectedTile: null,
        choosingEnd: false,
        lastAction: 'pass',
        lastPlayedBy: null,
      };

      const result = checkRoundEnd({ ...tempState, currentPlayer: 0 });
      if (result) {
        const newScores: [number, number] = [prev.scores[0] + result.scores[0], prev.scores[1] + result.scores[1]];
        const gameWinner = newScores[0] >= prev.targetScore ? 0 : newScores[1] >= prev.targetScore ? 1 : null;

        if (gameWinner !== null) {
          if (gameWinner === 0) playWinSound(); else playLoseSound();
          return { ...tempState, phase: 'gameEnd', scores: newScores, roundResult: result, gameWinner, aiThinking: false };
        }
        return { ...tempState, phase: 'roundEnd', scores: newScores, roundResult: result, aiThinking: false };
      }

      const nextValidPlays = canPlay(prev.hands[nextP], prev.board, isFirstPlay) ? getValidPlays(prev.hands[nextP], prev.board, isFirstPlay) : [];

      return {
        ...tempState,
        currentPlayer: nextP,
        validPlays: nextP === 0 ? nextValidPlays : [],
        aiThinking: true,
      };
    });
  }, []);

  // AI turn handler — triggers whenever it's an AI's turn
  useEffect(() => {
    if (state.phase !== 'playing' || state.currentPlayer === 0) return;

    const playerId = state.currentPlayer;
    const isFirstPlay = state.roundNumber === 1;
    const delay = state.board.tiles.length === 0 ? 1200 : 700 + Math.random() * 500;

    aiTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'playing' || prev.currentPlayer !== playerId) return prev;

        const aiPlay = chooseAIPlay(playerId, prev.hands[playerId], prev.board, prev.hands, isFirstPlay);

        if (aiPlay) {
          const newBoard = playTileOnBoard(prev.board, aiPlay.tile, aiPlay.end);
          const newHands = prev.hands.map((h, i) => i === playerId ? removeTileFromHand(h, aiPlay.tile) : h) as Tile[][];
          const newConsecutivePasses = 0;

          playPlaceSound();

          const tempState: GameState = {
            ...prev,
            hands: newHands,
            board: newBoard,
            consecutivePasses: newConsecutivePasses,
            selectedTile: null,
            choosingEnd: false,
            lastPlayedBy: playerId,
            aiThinking: false,
          };

          const result = checkRoundEnd({ ...tempState, currentPlayer: playerId });
          if (result) {
            const newScores: [number, number] = [prev.scores[0] + result.scores[0], prev.scores[1] + result.scores[1]];
            const gameWinner = newScores[0] >= prev.targetScore ? 0 : newScores[1] >= prev.targetScore ? 1 : null;

            if (result.isTranca) playTrancaSound();
            else if (result.winner === 0 || result.winner === 2) playWinSound();
            else playLoseSound();

            if (gameWinner !== null) {
              return { ...tempState, phase: 'gameEnd', scores: newScores, roundResult: result, gameWinner };
            }
            return { ...tempState, phase: 'roundEnd', scores: newScores, roundResult: result };
          }

          const nextP = nextPlayer(playerId) as PlayerId;

          return {
            ...tempState,
            currentPlayer: nextP,
            validPlays: [],
            aiThinking: true,
          };
        } else {
          playPassSound();
          const newConsecutivePasses = prev.consecutivePasses + 1;

          const tempState: GameState = {
            ...prev,
            consecutivePasses: newConsecutivePasses,
            lastAction: 'pass',
            lastPlayedBy: null,
            aiThinking: true,
          };

          const result = checkRoundEnd({ ...tempState, currentPlayer: playerId });
          if (result) {
            const newScores: [number, number] = [prev.scores[0] + result.scores[0], prev.scores[1] + result.scores[1]];
            const gameWinner = newScores[0] >= prev.targetScore ? 0 : newScores[1] >= prev.targetScore ? 1 : null;

            if (result.isTranca) playTrancaSound();
            else if (result.winner === 0 || result.winner === 2) playWinSound();
            else playLoseSound();

            if (gameWinner !== null) {
              return { ...tempState, phase: 'gameEnd', scores: newScores, roundResult: result, gameWinner };
            }
            return { ...tempState, phase: 'roundEnd', scores: newScores, roundResult: result };
          }

          const nextP = nextPlayer(playerId) as PlayerId;

          return {
            ...tempState,
            currentPlayer: nextP,
            validPlays: [],
            aiThinking: true,
          };
        }
      });
    }, delay);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [state.currentPlayer, state.phase]);

  const handleNextRound = useCallback(() => {
    if (!state.roundResult) return;
    const winner = state.roundResult.winner;
    const previousWinner = winner !== null ? winner : (state.roundResult.winningTeam === 0 ? 0 : 1) as PlayerId;
    startNewRound(previousWinner);
  }, [state.roundResult, startNewRound]);

  const handlePlayAgain = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'setup',
      scores: [0, 0],
      roundNumber: 1,
      gameWinner: null,
      roundResult: null,
    }));
  }, []);

  const isHumanTurn = state.currentPlayer === 0 && state.phase === 'playing';
  const humanCanPlay = isHumanTurn && state.validPlays.length > 0;
  const humanMustPass = isHumanTurn && state.validPlays.length === 0;

  const humanValidPlays = useMemo(() => {
    return getValidPlays(state.hands[0], state.board, state.roundNumber === 1);
  }, [state.hands[0], state.board, state.roundNumber]);

  if (state.phase === 'setup') {
    return <SetupScreen onStart={startGame} lang={state.lang} />;
  }


  const playerLabels: Record<PlayerId, string> = {
    0: t('player.you', state.lang),
    1: t('player.right', state.lang),
    2: t('player.top', state.lang),
    3: t('player.left', state.lang),
  };

  return (
    <div className="game-table">
      {/* Score info bar */}
      <div className="score-info-bar">
        <div className="round-badge">{t('score.round', state.lang)} {state.roundNumber}</div>
        <div className="scoreboard">
          <div className="score-team">
            <div className="score-team-name">{t('score.us', state.lang)}</div>
            <div className="score-value">{state.scores[0]}</div>
          </div>
          <div className="score-divider" />
          <div className="score-team">
            <div className="score-team-name">{t('score.them', state.lang)}</div>
            <div className="score-value">{state.scores[1]}</div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="settings-bar">
        <button
          className={`settings-btn ${state.debugMode ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, debugMode: !prev.debugMode }))}
        >
          {state.debugMode ? '👁' : '🔒'} {t('debug.showTiles', state.lang)}
        </button>
        <button
          className="settings-btn"
          onClick={() => setState(prev => ({ ...prev, lang: prev.lang === 'es' ? 'en' : 'es' }))}
        >
          {state.lang === 'es' ? '🇺🇸 EN' : '🇩🇴 ES'}
        </button>
      </div>

      {/* Top player (partner) */}
      <div className="top-area">
        <PlayerHand
          hand={state.hands[2]}
          isHuman={false}
          isCurrentPlayer={state.currentPlayer === 2}
          validPlays={[]}
          selectedTile={null}
          onSelectTile={() => {}}
          playedBy={2}
          label={playerLabels[2]}
          debugMode={state.debugMode}
          lang={state.lang}
          canPlayNow={false}
          position="top"
        />
      </div>

      {/* Middle section: left player, board, right player */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 0 }}>
        {/* Left side */}
        <div className="side-areas left" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <PlayerHand
            hand={state.hands[3]}
            isHuman={false}
            isCurrentPlayer={state.currentPlayer === 3}
            validPlays={[]}
            selectedTile={null}
            onSelectTile={() => {}}
            playedBy={3}
            label={playerLabels[3]}
            debugMode={state.debugMode}
            lang={state.lang}
            canPlayNow={false}
            position="left"
          />
        </div>

        {/* Board */}
        <BoardChain board={state.board} />

        {/* Right side */}
        <div className="side-areas right" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <PlayerHand
            hand={state.hands[1]}
            isHuman={false}
            isCurrentPlayer={state.currentPlayer === 1}
            validPlays={[]}
            selectedTile={null}
            onSelectTile={() => {}}
            playedBy={1}
            label={playerLabels[1]}
            debugMode={state.debugMode}
            lang={state.lang}
            canPlayNow={false}
            position="right"
          />
        </div>
      </div>

      {/* Turn indicator */}
      {state.phase === 'playing' && (
        <div style={{ textAlign: 'center', padding: '2px 0' }}>
          <div className={`turn-indicator ${state.currentPlayer !== 0 ? 'ai-turn' : ''}`}>
            {state.currentPlayer === 0
              ? (state.choosingEnd ? t('game.chooseEnd', state.lang) : t('game.yourTurn', state.lang))
              : `${playerLabels[state.currentPlayer]} ${t('game.aiThinking', state.lang)}`
            }
          </div>
        </div>
      )}



      {/* Bottom player (you) */}
      <div className="bottom-area">
        <PlayerHand
          hand={state.hands[0]}
          isHuman={true}
          isCurrentPlayer={isHumanTurn}
          validPlays={humanValidPlays}
          selectedTile={state.selectedTile}
          onSelectTile={handleSelectTile}
          onTopHalfClick={handleHalfClick}
          onBottomHalfClick={handleHalfClick}
          choosingEnd={state.choosingEnd}
          playedBy={0}
          label={playerLabels[0]}
          debugMode={state.debugMode}
          lang={state.lang}
          canPlayNow={humanCanPlay}
          onPass={humanMustPass ? handlePass : undefined}
          position="bottom"
        />
      </div>

      {/* Round end overlay */}
      {state.phase === 'roundEnd' && state.roundResult && (
        <RoundEndOverlay
          result={state.roundResult}
          scores={state.scores}
          lang={state.lang}
          onNext={handleNextRound}
        />
      )}

      {/* Game end overlay */}
      {state.phase === 'gameEnd' && state.gameWinner !== null && (
        <GameEndOverlay
          winningTeam={state.gameWinner}
          scores={state.scores}
          lang={state.lang}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
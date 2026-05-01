import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Tile, PlayerId, BoardState, ValidPlay, GameState, PipValue, Lang, TileOrientation } from './game/types';
import { getPlayerName, getTeam } from './game/types';
import { createTileSet, shuffle, deal, findStartingPlayer, getValidPlays, playTileOnBoard, removeTileFromHand, nextPlayer, checkRoundEnd, handSum, canPlay, getPlayableTileEnds } from './game/engine';
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
    orientation === 'down' ? 'tile-down' : '',
    className,
  ].filter(Boolean).join(' ');

  if (faceDown) {
    return <div className={classes} onClick={onClick} draggable={!!onDragStart} onDragStart={onDragStart} />;
  }

  if (!tile) return null;

  const [a, b] = tile;

  return (
    <div className={classes} onClick={onClick} draggable={!!onDragStart} onDragStart={onDragStart}>
      <PipGrid value={a} />
      <div className="domino-divider" />
      <PipGrid value={b} />
    </div>
  );
}

function BoardChain({
  board,
  playableEnds,
  humanPlayer,
  onEndClick,
  onDropOnEnd,
}: {
  board: BoardState;
  playableEnds: ('left' | 'right')[];
  humanPlayer: boolean;
  onEndClick?: (end: 'left' | 'right') => void;
  onDropOnEnd?: (tile: Tile, end: 'left' | 'right') => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [board.tiles.length]);

  if (board.tiles.length === 0) {
    return (
      <div className="board-area">
        <div className="board-chain" ref={scrollRef}>
          {humanPlayer ? (
            <div
              className="end-marker end-marker-active"
              onClick={() => onEndClick?.('right')}
            >
              ♦
            </div>
          ) : (
            <div className="end-marker">♦</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="board-area">
      <div className="board-chain" ref={scrollRef}>
        {playableEnds.includes('left') || humanPlayer ? (
          <div
            className={`end-marker ${humanPlayer && playableEnds.includes('left') ? 'end-marker-active' : ''}`}
            onClick={humanPlayer && playableEnds.includes('left') ? () => onEndClick?.('left') : undefined}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const tileStr = e.dataTransfer.getData('tile');
              if (tileStr && onDropOnEnd) {
                const [a, b] = tileStr.split(',').map(Number) as [PipValue, PipValue];
                onDropOnEnd([a, b], 'left');
              }
            }}
          >
            ◄
          </div>
        ) : (
          <div className="end-marker">◄</div>
        )}
        {board.tiles.map((placed, i) => (
          <div key={i} className="tile-enter">
            <DominoTile
              tile={[placed.left, placed.right] as Tile}
              size="small"
              orientation={placed.orientation}
            />
          </div>
        ))}
        {playableEnds.includes('right') || humanPlayer ? (
          <div
            className={`end-marker ${humanPlayer && playableEnds.includes('right') ? 'end-marker-active' : ''}`}
            onClick={humanPlayer && playableEnds.includes('right') ? () => onEndClick?.('right') : undefined}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const tileStr = e.dataTransfer.getData('tile');
              if (tileStr && onDropOnEnd) {
                const [a, b] = tileStr.split(',').map(Number) as [PipValue, PipValue];
                onDropOnEnd([a, b], 'right');
              }
            }}
          >
            ►
          </div>
        ) : (
          <div className="end-marker">►</div>
        )}
      </div>
    </div>
  );
}

function PlayerHand({
  hand,
  isHuman,
  isCurrentPlayer,
  validPlays,
  selectedTile,
  onSelectTile,
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
          return (
            <DominoTile
              key={`${tile[0]}-${tile[1]}-${i}`}
              tile={tile}
              faceDown={!showFace}
              playable={isPlayable}
              selected={selectedTile !== null && tile[0] === selectedTile[0] && tile[1] === selectedTile[1]}
              notPlayable={isHuman && isCurrentPlayer && validPlays.length > 0 && !isPlayable}
              onClick={isHuman && isPlayable ? () => onSelectTile(tile) : undefined}
              onDragStart={isHuman && isPlayable ? (e: React.DragEvent) => {
                e.dataTransfer.setData('tile', `${tile[0]},${tile[1]}`);
                e.dataTransfer.effectAllowed = 'move';
              } : undefined}
              size={tileSize as 'normal' | 'small' | 'side'}
              className={tileClass}
            />
          );
        })}
      </div>
      {isHuman && isCurrentPlayer && onPass && (
        <div style={{ marginTop: 4 }}>
          {canPlayNow ? (
            <div style={{ fontSize: 10, opacity: 0.5 }}>
              {t('game.yourTurn', lang)}
            </div>
          ) : (
            <button className="btn btn-pass" onClick={onPass}>
              {t('game.pass', lang)}
            </button>
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
    board: { tiles: [], leftEnd: null, rightEnd: null },
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
    const validPlays = getValidPlays(hands[0], { tiles: [], leftEnd: null, rightEnd: null }, isFirstPlay);

    playDealSound();

    setState({
      phase: 'playing',
      hands,
      board: { tiles: [], leftEnd: null, rightEnd: null },
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
    const isFirstPlay = true;
    const valid = starting === 0 ? getValidPlays(hands[0], { tiles: [], leftEnd: null, rightEnd: null }, isFirstPlay) : [];

    playDealSound();

    setState(prev => ({
      ...prev,
      phase: 'playing',
      hands,
      board: { tiles: [], leftEnd: null, rightEnd: null },
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

      const isFirstPlay = prev.board.tiles.length === 0;
      const computedValidPlays = getValidPlays(prev.hands[0], prev.board, isFirstPlay);
      const validForTile = computedValidPlays.filter(vp => vp.tile[0] === tile[0] && vp.tile[1] === tile[1]);
      if (validForTile.length === 0) return prev;

      if (validForTile.length === 1 || prev.board.tiles.length === 0) {
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
        const isFirstPlay = newBoard.tiles.length <= 1;
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

  const handleChooseEnd = useCallback((end: 'left' | 'right') => {
    playClickSound();

    setState(prev => {
      if (!prev.selectedTile) return prev;

      const tile = prev.selectedTile;
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
      const isFirstPlay = newBoard.tiles.length <= 1;
      const nextValidPlays = canPlay(newHands[nextP], newBoard, isFirstPlay) ? getValidPlays(newHands[nextP], newBoard, isFirstPlay) : [];

      playPlaceSound();

      return {
        ...tempState,
        currentPlayer: nextP,
        validPlays: nextP === 0 ? nextValidPlays : [],
        aiThinking: nextP !== 0,
      };
    });
  }, []);

  const handleDropOnEnd = useCallback((tile: Tile, end: 'left' | 'right') => {
    const isFirstPlay = state.board.tiles.length === 0;
    const computedValidPlays = getValidPlays(state.hands[0], state.board, isFirstPlay);
    const isValidPlay = computedValidPlays.some(vp =>
      vp.tile[0] === tile[0] && vp.tile[1] === tile[1] && vp.end === end
    );

    if (!isValidPlay) {
      playClickSound();
      return;
    }

    playPlaceSound();

    const newBoard = playTileOnBoard(state.board, tile, end);
    const newHands = state.hands.map((h, i) => i === 0 ? removeTileFromHand(h, tile) : h) as Tile[][];
    const newConsecutivePasses = 0;

    const tempState: GameState = {
      ...state,
      hands: newHands,
      board: newBoard,
      consecutivePasses: newConsecutivePasses,
      selectedTile: null,
      choosingEnd: false,
      validPlays: [],
      lastPlayedBy: 0,
    };

    const result = checkRoundEnd({ ...tempState, currentPlayer: 0 });
    if (result) {
      const newScores: [number, number] = [state.scores[0] + result.scores[0], state.scores[1] + result.scores[1]];
      const gameWinner = newScores[0] >= state.targetScore ? 0 : newScores[1] >= state.targetScore ? 1 : null;

      if (gameWinner !== null) {
        if (gameWinner === 0) playWinSound(); else playLoseSound();
        setState({ ...tempState, phase: 'gameEnd', scores: newScores, roundResult: result, gameWinner });
        return;
      } else if (result.isTranca) {
        playTrancaSound();
      } else if (result.winner === 0 || result.winner === 2) {
        playWinSound();
      } else {
        playLoseSound();
      }
      setState({ ...tempState, phase: 'roundEnd', scores: newScores, roundResult: result });
      return;
    }

    const nextP = nextPlayer(0) as PlayerId;
    setState({ ...tempState, currentPlayer: nextP, aiThinking: true });
  }, [state]);

  const handlePass = useCallback(() => {
    playPassSound();

    setState(prev => {
      if (prev.phase !== 'playing' || prev.currentPlayer !== 0) return prev;

      const newConsecutivePasses = prev.consecutivePasses + 1;
      const nextP = nextPlayer(0) as PlayerId;
      const isFirstPlay = prev.board.tiles.length <= 1;

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
    const isFirstPlay = state.board.tiles.length === 0;
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
    return getValidPlays(state.hands[0], state.board, state.board.tiles.length === 0);
  }, [state.hands[0], state.board]);

  if (state.phase === 'setup') {
    return <SetupScreen onStart={startGame} lang={state.lang} />;
  }


  const playableEnds: ('left' | 'right')[] = state.selectedTile && state.choosingEnd
    ? getPlayableTileEnds(state.selectedTile, state.board)
    : [];

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
        <BoardChain
          board={state.board}
          playableEnds={state.choosingEnd && state.selectedTile ? playableEnds : []}
          humanPlayer={isHumanTurn}
          onEndClick={isHumanTurn && state.selectedTile ? handleChooseEnd : undefined}
          onDropOnEnd={isHumanTurn ? handleDropOnEnd : undefined}
        />

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

      {/* Choose end overlay */}
      {state.choosingEnd && state.selectedTile && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '4px 0' }}>
          <DominoTile tile={state.selectedTile} />
          <button className="btn btn-primary" onClick={() => handleChooseEnd('left')}>
            ◄ {t('game.playLeft', state.lang)}
          </button>
          <button className="btn btn-primary" onClick={() => handleChooseEnd('right')}>
            {t('game.playRight', state.lang)} ►
          </button>
          <button className="btn btn-secondary" onClick={() => setState(prev => ({ ...prev, selectedTile: null, choosingEnd: false }))}>
            {t('game.cancel', state.lang)}
          </button>
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
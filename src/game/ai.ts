import type { Tile, PlayerId, BoardState, ValidPlay } from './types';
import { getValidPlays, playTileOnBoard, handSum, tileSum } from './engine';
import { getTeam } from './types';

export function chooseAIPlay(
  playerId: PlayerId,
  hand: Tile[],
  board: BoardState,
  allHands: Tile[][],
  isFirstPlay: boolean,
): ValidPlay | null {
  const validPlays = getValidPlays(hand, board, isFirstPlay);
  if (validPlays.length === 0) return null;
  if (validPlays.length === 1) return validPlays[0];

  const myTeam = getTeam(playerId);
  const scoredPlays = validPlays.map(play => {
    let score = 0;
    const [a, b] = play.tile;

    score += (a + b) * 2;

    const newBoard = playTileOnBoard(board, play.tile, play.end);
    const playedValue = play.end === 'left' ? newBoard.leftEnd! : newBoard.rightEnd!;
    const tilesWithPlayedValue = hand.filter(t => t[0] === playedValue || t[1] === playedValue).length;
    score += tilesWithPlayedValue * 4;

    const otherEnd = play.end === 'left' ? newBoard.rightEnd! : newBoard.leftEnd!;
    const tilesWithOtherEnd = hand.filter(t => t[0] === otherEnd || t[1] === otherEnd).length;
    score += tilesWithOtherEnd * 2;

    const partnerId = myTeam === 0 ? (playerId === 0 ? 2 : 0) : (playerId === 1 ? 3 : 1);
    const partnerTilesLeft = allHands[partnerId].length;
    if (partnerTilesLeft <= 2) {
      score += 6;
    }

    const opponentIds: PlayerId[] = myTeam === 0 ? [1, 3] : [0, 2];
    for (const oppId of opponentIds) {
      if (allHands[oppId].length <= 2) {
        const oppHasEnd = allHands[oppId].some(t => t[0] === playedValue || t[1] === playedValue);
        if (!oppHasEnd && play.end === 'right') {
          score += 3;
        }
      }
    }

    if (a === b) {
      score -= 3;
    }

    score += Math.random() * 1.5;

    return { play, score };
  });

  scoredPlays.sort((a, b) => b.score - a.score);
  return scoredPlays[0].play;
}
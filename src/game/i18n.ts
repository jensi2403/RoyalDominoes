import type { Lang } from './types';

const translations: Record<string, Record<Lang, string>> = {
  'app.title': { es: 'Dominó Dominicano', en: 'Dominican Dominoes' },
  'setup.subtitle': { es: 'Juego de 4 jugadores (2vs2) con IA', en: '4-player game (2v2) with AI' },
  'setup.targetScore': { es: 'Puntuación Objetivo', en: 'Target Score' },
  'setup.start': { es: 'Comenzar Juego', en: 'Start Game' },
  'game.yourTurn': { es: 'Tu turno — selecciona una ficha', en: 'Your turn — select a tile' },
  'game.chooseEnd': { es: '¿En qué extremo juegas?', en: 'Which end do you play?' },
  'game.playLeft': { es: 'Izquierda', en: 'Left' },
  'game.playRight': { es: 'Derecha', en: 'Right' },
  'game.cancel': { es: 'Cancelar', en: 'Cancel' },
  'game.pass': { es: 'Paso', en: 'Pass' },
  'game.mustPlay': { es: 'Debes jugar una ficha', en: 'You must play a tile' },
  'game.passed': { es: 'pasa', en: 'passes' },
  'game.played': { es: 'juega', en: 'plays' },
  'game.aiThinking': { es: 'pensando...', en: 'thinking...' },
  'score.us': { es: 'Nosotros', en: 'Us' },
  'score.them': { es: 'Ellos', en: 'Them' },
  'score.round': { es: 'Ronda', en: 'Round' },
  'score.pips': { es: 'pts', en: 'pts' },
  'round.title': { es: 'Fin de Ronda', en: 'Round End' },
  'round.tranca': { es: '¡Tranca!', en: 'Blocked!' },
  'round.winnerOut': { es: '¡{name} se fue!', en: '{name} went out!' },
  'round.trancaWin': { es: '¡Equipo {team} gana por tranca!', en: 'Team {team} wins by block!' },
  'round.pointsScored': { es: '{team} anota {points} puntos', en: '{team} scores {points} points' },
  'round.nextRound': { es: 'Siguiente Ronda', en: 'Next Round' },
  'gameEnd.title': { es: '¡Fin del Juego!', en: 'Game Over!' },
  'gameEnd.teamWins': { es: '¡Equipo {team} gana el juego!', en: 'Team {team} wins the game!' },
  'gameEnd.finalScore': { es: 'Marcador Final', en: 'Final Score' },
  'gameEnd.playAgain': { es: 'Jugar de Nuevo', en: 'Play Again' },
  'debug.showTiles': { es: 'Mostrar fichas IA', en: 'Show AI tiles' },
  'player.you': { es: 'Tú', en: 'You' },
  'player.right': { es: 'Derecho', en: 'Right' },
  'player.top': { es: 'Compañero', en: 'Partner' },
  'player.left': { es: 'Izquierdo', en: 'Left' },
  'lang.toggle': { es: 'EN', en: 'ES' },
  'hand.noPlays': { es: 'No tienes jugadas', en: 'No valid plays' },
  'board.empty': { es: 'Primera jugada', en: 'First play' },
};

export function t(key: string, lang: Lang, replacements?: Record<string, string>): string {
  const entry = translations[key];
  if (!entry) return key;
  let text = entry[lang];
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}
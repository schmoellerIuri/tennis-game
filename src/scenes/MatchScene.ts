import { Container } from 'pixi.js';
import { Difficulty, MatchStats, PlayerSide } from '@/types';
import { Game } from '@/game/Game';
import { InputManager } from '@/input/InputManager';

export class MatchScene {
  readonly container = new Container();
  private game: Game;
  private onMatchEnd: ((winner: PlayerSide, stats: MatchStats) => void) | null = null;

  constructor(input: InputManager, difficulty: Difficulty, sets: number, sw: number, sh: number) {
    this.game = new Game(input, difficulty, sets);
    this.game.setCenter(sw / 2, sh / 2);
    this.game.setOnMatchEnd((winner, stats) => {
      if (this.onMatchEnd) this.onMatchEnd(winner, stats);
    });
    this.container.addChild(this.game.container);
  }

  setOnMatchEnd(cb: (winner: PlayerSide, stats: MatchStats) => void): void {
    this.onMatchEnd = cb;
  }

  update(dt: number): void {
    this.game.update(dt);
  }
}

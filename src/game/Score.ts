import { PlayerSide, ScoreState } from '@/types';

const POINT_VALUES = [0, 15, 30, 40];

export class Score {
  state: ScoreState;

  constructor(maxSets: number = 3) {
    this.state = {
      points: [0, 0],
      games: [[], []],
      sets: [0, 0],
      servingSide: PlayerSide.Near,
      currentSet: 0,
      isDeuce: false,
      advantage: null,
      maxSets,
    };
    this.state.games[0].push(0);
    this.state.games[1].push(0);
  }

  pointWon(winner: PlayerSide): void {
    const wi = winner === PlayerSide.Near ? 0 : 1;
    const li = 1 - wi;

    if (this.state.isDeuce) {
      if (this.state.advantage === winner) {
        this.gameWon(winner);
      } else if (this.state.advantage !== null) {
        this.state.advantage = null;
      } else {
        this.state.advantage = winner;
      }
      return;
    }

    this.state.points[wi]++;

    if (this.state.points[wi] >= 4) {
      this.gameWon(winner);
    } else if (this.state.points[wi] === 3 && this.state.points[li] === 3) {
      this.state.isDeuce = true;
    }
  }

  private gameWon(winner: PlayerSide): void {
    const wi = winner === PlayerSide.Near ? 0 : 1;
    const li = 1 - wi;
    const set = this.state.currentSet;

    this.state.games[wi][set]++;
    this.state.points = [0, 0];
    this.state.isDeuce = false;
    this.state.advantage = null;

    this.state.servingSide =
      this.state.servingSide === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;

    const gamesW = this.state.games[wi][set];
    const gamesL = this.state.games[li][set];

    if (gamesW >= 6 && gamesW - gamesL >= 2) {
      this.setWon(winner);
    }
  }

  private setWon(winner: PlayerSide): void {
    const wi = winner === PlayerSide.Near ? 0 : 1;
    this.state.sets[wi]++;
    this.state.currentSet++;

    if (!this.isMatchOver()) {
      this.state.games[0].push(0);
      this.state.games[1].push(0);
    }
  }

  isMatchOver(): boolean {
    const setsToWin = Math.ceil(this.state.maxSets / 2);
    return this.state.sets[0] >= setsToWin || this.state.sets[1] >= setsToWin;
  }

  getMatchWinner(): PlayerSide | null {
    const setsToWin = Math.ceil(this.state.maxSets / 2);
    if (this.state.sets[0] >= setsToWin) return PlayerSide.Near;
    if (this.state.sets[1] >= setsToWin) return PlayerSide.Far;
    return null;
  }

  getDisplayScore(): { near: string; far: string } {
    if (this.state.isDeuce) {
      if (this.state.advantage === PlayerSide.Near) return { near: 'AD', far: '40' };
      if (this.state.advantage === PlayerSide.Far) return { near: '40', far: 'AD' };
      return { near: '40', far: '40' };
    }

    return {
      near: this.pointToString(this.state.points[0]),
      far: this.pointToString(this.state.points[1]),
    };
  }

  private pointToString(p: number): string {
    if (p >= 0 && p < POINT_VALUES.length) return POINT_VALUES[p].toString();
    return p.toString();
  }

  reset(): void {
    this.state.points = [0, 0];
    this.state.games = [[0], [0]];
    this.state.sets = [0, 0];
    this.state.servingSide = PlayerSide.Near;
    this.state.currentSet = 0;
    this.state.isDeuce = false;
    this.state.advantage = null;
  }
}

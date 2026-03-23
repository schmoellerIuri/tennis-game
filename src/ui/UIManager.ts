import { Difficulty, MatchStats, PlayerSide, GamePhase } from '@/types';

export class UIManager {
  private menuOverlay: HTMLElement;
  private hudOverlay: HTMLElement;
  private resultOverlay: HTMLElement;

  private hudYouName: HTMLElement;
  private hudYouGames: HTMLElement;
  private hudYouPoints: HTMLElement;
  private hudCpuName: HTMLElement;
  private hudCpuGames: HTMLElement;
  private hudCpuPoints: HTMLElement;
  private centerMessage: HTMLElement;
  private serveInstruction: HTMLElement;
  private powerMeterContainer: HTMLElement;
  private powerMeterFill: HTMLElement;
  private resultTitle: HTMLElement;
  private resultStats: HTMLElement;

  private onPlay: ((difficulty: Difficulty, sets: number) => void) | null = null;
  private onBackToMenu: (() => void) | null = null;

  private selectedDifficulty: Difficulty = Difficulty.Medium;
  private selectedSets = 1;

  constructor() {
    this.menuOverlay = document.getElementById('menu-overlay')!;
    this.hudOverlay = document.getElementById('hud-overlay')!;
    this.resultOverlay = document.getElementById('result-overlay')!;

    this.hudYouName = document.getElementById('hud-you-name')!;
    this.hudYouGames = document.getElementById('hud-you-games')!;
    this.hudYouPoints = document.getElementById('hud-you-points')!;
    this.hudCpuName = document.getElementById('hud-cpu-name')!;
    this.hudCpuGames = document.getElementById('hud-cpu-games')!;
    this.hudCpuPoints = document.getElementById('hud-cpu-points')!;
    this.centerMessage = document.getElementById('center-message')!;
    this.serveInstruction = document.getElementById('serve-instruction')!;
    this.powerMeterContainer = document.getElementById('power-meter-container')!;
    this.powerMeterFill = document.getElementById('power-meter-fill')!;
    this.resultTitle = document.getElementById('result-title')!;
    this.resultStats = document.getElementById('result-stats')!;

    this.setupMenuListeners();
  }

  private setupMenuListeners(): void {
    // Difficulty buttons
    const diffGroup = document.getElementById('difficulty-group')!;
    diffGroup.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => {
        diffGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedDifficulty = (btn as HTMLElement).dataset.value as Difficulty;
      });
    });

    // Sets buttons
    const setsGroup = document.getElementById('sets-group')!;
    setsGroup.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setsGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedSets = parseInt((btn as HTMLElement).dataset.value!, 10);
      });
    });

    // Play button
    document.getElementById('play-btn')!.addEventListener('click', () => {
      if (this.onPlay) this.onPlay(this.selectedDifficulty, this.selectedSets);
    });

    // Back button
    document.getElementById('back-btn')!.addEventListener('click', () => {
      if (this.onBackToMenu) this.onBackToMenu();
    });
  }

  setOnPlay(cb: (difficulty: Difficulty, sets: number) => void): void {
    this.onPlay = cb;
  }

  setOnBackToMenu(cb: () => void): void {
    this.onBackToMenu = cb;
  }

  showMenu(): void {
    this.menuOverlay.classList.add('active');
    this.hudOverlay.classList.remove('active');
    this.resultOverlay.classList.remove('active');
  }

  showHUD(): void {
    this.menuOverlay.classList.remove('active');
    this.hudOverlay.classList.add('active');
    this.resultOverlay.classList.remove('active');
  }

  showResult(winner: PlayerSide, stats: MatchStats): void {
    this.menuOverlay.classList.remove('active');
    this.hudOverlay.classList.remove('active');
    this.resultOverlay.classList.add('active');

    const isWin = winner === PlayerSide.Near;
    this.resultTitle.textContent = isWin ? 'YOU WIN!' : 'YOU LOSE';
    this.resultTitle.style.color = isWin ? '#4CAF50' : '#E94560';

    this.resultStats.innerHTML = [
      `Total Points:      ${stats.totalPoints}`,
      `Aces:              ${stats.aces}`,
      `Winners:           ${stats.winners}`,
      `Unforced Errors:   ${stats.unforcedErrors}`,
    ].join('\n');
  }

  updateHUD(
    displayScore: { near: string; far: string },
    games: [number[], number[]],
    servingSide: PlayerSide,
    phase: GamePhase,
    message: string,
    faultCount: number,
    pauseTimer: number,
  ): void {
    const serveNear = servingSide === PlayerSide.Near ? ' \u25B6' : '';
    const serveFar = servingSide === PlayerSide.Far ? ' \u25B6' : '';

    this.hudYouName.textContent = `YOU${serveNear}`;
    this.hudYouGames.textContent = games[0].map(g => g.toString()).join('  ');
    this.hudYouPoints.textContent = displayScore.near;
    this.hudCpuName.textContent = `CPU${serveFar}`;
    this.hudCpuGames.textContent = games[1].map(g => g.toString()).join('  ');
    this.hudCpuPoints.textContent = displayScore.far;

    // Center message
    if (phase === GamePhase.PointOver && message) {
      this.centerMessage.textContent = message;
      this.centerMessage.style.display = 'block';
    } else if (phase === GamePhase.Countdown) {
      this.centerMessage.textContent = `${Math.ceil(pauseTimer)}`;
      this.centerMessage.style.display = 'block';
    } else {
      this.centerMessage.style.display = 'none';
    }

    // Serve instruction
    if (phase === GamePhase.Serving) {
      const isPlayer = servingSide === PlayerSide.Near;
      const faultLabel = faultCount === 1 ? ' (2nd serve)' : '';
      this.serveInstruction.textContent = isPlayer
        ? `Press SPACE to toss${faultLabel}`
        : 'Opponent serving...';
      this.serveInstruction.style.display = 'block';
    } else {
      this.serveInstruction.style.display = 'none';
    }
  }

  updatePowerMeter(power: number, visible: boolean): void {
    if (visible && power > 0) {
      this.powerMeterContainer.style.display = 'block';
      this.powerMeterFill.style.width = `${power * 100}%`;
    } else {
      this.powerMeterContainer.style.display = 'none';
    }
  }
}

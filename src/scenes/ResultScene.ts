import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { MatchStats, PlayerSide } from '@/types';
import { RENDER } from '@/utils/Constants';

export class ResultScene {
  readonly container = new Container();
  private onBack: (() => void) | null = null;

  constructor(winner: PlayerSide, stats: MatchStats, sw: number, sh: number) {
    this.build(winner, stats, sw, sh);
  }

  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  private build(winner: PlayerSide, stats: MatchStats, sw: number, sh: number): void {
    const isWin = winner === PlayerSide.Near;

    const titleStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 42,
      fill: isWin ? 0x4CAF50 : RENDER.COLORS.UI_ACCENT,
      fontWeight: 'bold',
    });
    const title = new Text({ text: isWin ? 'YOU WIN!' : 'YOU LOSE', style: titleStyle });
    title.anchor.set(0.5);
    title.x = sw / 2;
    title.y = sh * 0.25;
    this.container.addChild(title);

    // Stats
    const statLines = [
      `Total Points:      ${stats.totalPoints}`,
      `Aces:              ${stats.aces}`,
      `Winners:           ${stats.winners}`,
      `Unforced Errors:   ${stats.unforcedErrors}`,
    ];

    const statStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 16,
      fill: RENDER.COLORS.UI_TEXT,
      lineHeight: 28,
    });

    const bg = new Graphics();
    bg.roundRect(sw / 2 - 180, sh * 0.38 - 15, 360, statLines.length * 28 + 30, 8);
    bg.fill({ color: RENDER.COLORS.UI_BG, alpha: 0.9 });
    this.container.addChild(bg);

    const statsText = new Text({ text: statLines.join('\n'), style: statStyle });
    statsText.anchor.set(0.5, 0);
    statsText.x = sw / 2;
    statsText.y = sh * 0.4;
    this.container.addChild(statsText);

    // Back button
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.x = sw / 2;
    btn.y = sh * 0.75;

    const btnBg = new Graphics();
    btnBg.roundRect(-100, -28, 200, 56, 6);
    btnBg.fill(RENDER.COLORS.UI_ACCENT);

    const btnText = new Text({
      text: 'BACK TO MENU',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 18,
        fill: RENDER.COLORS.UI_TEXT,
        fontWeight: 'bold',
      }),
    });
    btnText.anchor.set(0.5);

    btn.addChild(btnBg);
    btn.addChild(btnText);
    btn.on('pointerdown', () => {
      if (this.onBack) this.onBack();
    });

    this.container.addChild(btn);
  }
}

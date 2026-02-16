import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { Difficulty } from '@/types';
import { RENDER } from '@/utils/Constants';

export class MenuScene {
  readonly container = new Container();
  private onStart: ((difficulty: Difficulty, sets: number) => void) | null = null;
  private selectedDifficulty: Difficulty = Difficulty.Medium;
  private selectedSets = 1;

  constructor(screenWidth: number, screenHeight: number) {
    this.build(screenWidth, screenHeight);
  }

  setOnStart(cb: (difficulty: Difficulty, sets: number) => void): void {
    this.onStart = cb;
  }

  private build(sw: number, sh: number): void {
    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 48,
      fill: RENDER.COLORS.UI_TEXT,
      fontWeight: 'bold',
      letterSpacing: 4,
    });
    const title = new Text({ text: 'TENNIS', style: titleStyle });
    title.anchor.set(0.5);
    title.x = sw / 2;
    title.y = sh * 0.2;
    this.container.addChild(title);

    const subtitleStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 16,
      fill: 0x888888,
    });
    const subtitle = new Text({ text: 'An isometric arcade tennis game', style: subtitleStyle });
    subtitle.anchor.set(0.5);
    subtitle.x = sw / 2;
    subtitle.y = sh * 0.2 + 50;
    this.container.addChild(subtitle);

    // Difficulty buttons
    const diffLabel = new Text({
      text: 'DIFFICULTY',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: 0x888888 }),
    });
    diffLabel.anchor.set(0.5);
    diffLabel.x = sw / 2;
    diffLabel.y = sh * 0.42;
    this.container.addChild(diffLabel);

    const difficulties: Difficulty[] = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];
    const diffButtons: Container[] = [];

    difficulties.forEach((diff, i) => {
      const btn = this.createButton(
        diff.toUpperCase(),
        sw / 2 + (i - 1) * 140,
        sh * 0.5,
        120,
        40,
        diff === this.selectedDifficulty,
      );
      btn.on('pointerdown', () => {
        this.selectedDifficulty = diff;
        diffButtons.forEach((b, j) => this.updateButtonStyle(b, difficulties[j] === diff));
      });
      diffButtons.push(btn);
      this.container.addChild(btn);
    });

    // Sets selector
    const setsLabel = new Text({
      text: 'SETS',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: 0x888888 }),
    });
    setsLabel.anchor.set(0.5);
    setsLabel.x = sw / 2;
    setsLabel.y = sh * 0.58;
    this.container.addChild(setsLabel);

    const setOptions = [1, 3, 5];
    const setButtons: Container[] = [];

    setOptions.forEach((sets, i) => {
      const btn = this.createButton(
        sets.toString(),
        sw / 2 + (i - 1) * 140,
        sh * 0.65,
        120,
        40,
        sets === this.selectedSets,
      );
      btn.on('pointerdown', () => {
        this.selectedSets = sets;
        setButtons.forEach((b, j) => this.updateButtonStyle(b, setOptions[j] === sets));
      });
      setButtons.push(btn);
      this.container.addChild(btn);
    });

    // Play button
    const playBtn = this.createButton('PLAY', sw / 2, sh * 0.78, 200, 56, false, true);
    playBtn.on('pointerdown', () => {
      if (this.onStart) this.onStart(this.selectedDifficulty, this.selectedSets);
    });
    this.container.addChild(playBtn);

    // Controls help
    const helpStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0x666666,
      align: 'center',
    });
    const help = new Text({
      text: 'WASD/Arrows: Move  |  Left Click: Shot  |  Right Click: Lob',
      style: helpStyle,
    });
    help.anchor.set(0.5);
    help.x = sw / 2;
    help.y = sh * 0.92;
    this.container.addChild(help);
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
    accent = false,
  ): Container {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 6);

    if (accent) {
      bg.fill(RENDER.COLORS.UI_ACCENT);
    } else {
      bg.fill(selected ? 0x3A3A5C : RENDER.COLORS.UI_BG);
      bg.stroke({ width: selected ? 2 : 1, color: selected ? RENDER.COLORS.UI_ACCENT : 0x444466 });
    }

    const text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: accent ? 20 : 14,
        fill: RENDER.COLORS.UI_TEXT,
        fontWeight: 'bold',
      }),
    });
    text.anchor.set(0.5);

    btn.addChild(bg);
    btn.addChild(text);
    btn.x = x;
    btn.y = y;

    return btn;
  }

  private updateButtonStyle(btn: Container, selected: boolean): void {
    const bg = btn.children[0] as Graphics;
    bg.clear();
    const bounds = btn.children[1] as Text;
    const w = 120;
    const h = 40;
    bg.roundRect(-w / 2, -h / 2, w, h, 6);
    bg.fill(selected ? 0x3A3A5C : RENDER.COLORS.UI_BG);
    bg.stroke({ width: selected ? 2 : 1, color: selected ? RENDER.COLORS.UI_ACCENT : 0x444466 });
  }
}

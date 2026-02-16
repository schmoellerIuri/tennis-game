import { Application, Ticker } from 'pixi.js';
import { Difficulty, MatchStats, PlayerSide } from '@/types';
import { RENDER } from '@/utils/Constants';
import { InputManager } from '@/input/InputManager';
import { MenuScene } from '@/scenes/MenuScene';
import { MatchScene } from '@/scenes/MatchScene';
import { ResultScene } from '@/scenes/ResultScene';

async function bootstrap(): Promise<void> {
  const app = new Application();

  await app.init({
    background: RENDER.COLORS.BACKGROUND,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  const input = new InputManager();
  input.bind(app.canvas as HTMLCanvasElement);

  let currentScene: { update?: (dt: number) => void } | null = null;

  function showMenu(): void {
    app.stage.removeChildren();
    const menu = new MenuScene(app.screen.width, app.screen.height);
    menu.setOnStart((difficulty, sets) => startMatch(difficulty, sets));
    app.stage.addChild(menu.container);
    currentScene = null;
  }

  function startMatch(difficulty: Difficulty, sets: number): void {
    app.stage.removeChildren();
    const match = new MatchScene(
      input,
      difficulty,
      sets,
      app.screen.width,
      app.screen.height,
    );
    match.setOnMatchEnd((winner, stats) => showResult(winner, stats));
    app.stage.addChild(match.container);
    currentScene = match;
  }

  function showResult(winner: PlayerSide, stats: MatchStats): void {
    app.stage.removeChildren();
    const result = new ResultScene(winner, stats, app.screen.width, app.screen.height);
    result.setOnBack(() => showMenu());
    app.stage.addChild(result.container);
    currentScene = null;
  }

  app.ticker.add((ticker: Ticker) => {
    const dt = ticker.deltaMS / 1000;
    if (currentScene?.update) {
      currentScene.update(dt);
    }
  });

  showMenu();
}

bootstrap().catch(console.error);

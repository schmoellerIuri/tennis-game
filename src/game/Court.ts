import { Container, Graphics } from 'pixi.js';
import { COURT, RENDER } from '@/utils/Constants';
import { worldToScreen } from '@/utils/IsometricUtils';
import { Vec2 } from '@/types';

export class Court {
  readonly container = new Container();

  constructor() {
    this.draw();
  }

  private draw(): void {
    this.drawSurface();
    this.drawLines();
    this.drawNet();
  }

  private worldPoint(x: number, y: number): Vec2 {
    return worldToScreen(x, y);
  }

  private drawSurface(): void {
    const g = new Graphics();
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    const margin = 7;

    // Outer clay (run-off area)
    const otl = this.worldPoint(-hw - margin, -hl - margin);
    const otr = this.worldPoint(hw + margin, -hl - margin);
    const obr = this.worldPoint(hw + margin, hl + margin);
    const obl = this.worldPoint(-hw - margin, hl + margin);
    g.poly([otl.x, otl.y, otr.x, otr.y, obr.x, obr.y, obl.x, obl.y]);
    g.fill(RENDER.COLORS.CLAY);

    // Inner court surface (lighter)
    const itl = this.worldPoint(-hw, -hl);
    const itr = this.worldPoint(hw, -hl);
    const ibr = this.worldPoint(hw, hl);
    const ibl = this.worldPoint(-hw, hl);
    g.poly([itl.x, itl.y, itr.x, itr.y, ibr.x, ibr.y, ibl.x, ibl.y]);
    g.fill(RENDER.COLORS.CLAY_LIGHT);

    this.container.addChild(g);
  }

  private drawLines(): void {
    const g = new Graphics();
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    const sl = COURT.SERVICE_LINE_DIST;
    const lineWidth = 2;

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      const p1 = this.worldPoint(x1, y1);
      const p2 = this.worldPoint(x2, y2);
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.stroke({ width: lineWidth, color: RENDER.COLORS.COURT_LINE });
    };

    // Baselines
    drawLine(-hw, -hl, hw, -hl);
    drawLine(-hw, hl, hw, hl);

    // Sidelines
    drawLine(-hw, -hl, -hw, hl);
    drawLine(hw, -hl, hw, hl);

    // Service lines
    drawLine(-hw, -sl, hw, -sl);
    drawLine(-hw, sl, hw, sl);

    // Center service line
    drawLine(0, -sl, 0, sl);

    // Center marks
    drawLine(0, -hl, 0, -hl + 0.5);
    drawLine(0, hl, 0, hl - 0.5);

    this.container.addChild(g);
  }

  private drawNet(): void {
    const g = new Graphics();
    const hw = COURT.SINGLES_WIDTH / 2 + 0.5;
    const netY = 0;
    const netHeight = COURT.NET_HEIGHT;

    const leftBase = this.worldPoint(-hw, netY);
    const rightBase = this.worldPoint(hw, netY);
    const leftTop = worldToScreen(-hw, netY);
    const rightTop = worldToScreen(hw, netY);

    leftTop.y -= netHeight * RENDER.COURT_SCALE * 0.8;
    rightTop.y -= netHeight * RENDER.COURT_SCALE * 0.8;

    // Net mesh
    g.poly([leftBase.x, leftBase.y, rightBase.x, rightBase.y, rightTop.x, rightTop.y, leftTop.x, leftTop.y]);
    g.fill({ color: RENDER.COLORS.NET, alpha: 0.4 });
    g.stroke({ width: 1, color: RENDER.COLORS.NET });

    // Net top line
    g.moveTo(leftTop.x, leftTop.y);
    g.lineTo(rightTop.x, rightTop.y);
    g.stroke({ width: 2, color: RENDER.COLORS.NET });

    // Posts
    const postWidth = 3;
    g.rect(leftBase.x - postWidth / 2, leftTop.y, postWidth, leftBase.y - leftTop.y);
    g.fill(RENDER.COLORS.NET_POST);
    g.rect(rightBase.x - postWidth / 2, rightTop.y, postWidth, rightBase.y - rightTop.y);
    g.fill(RENDER.COLORS.NET_POST);

    this.container.addChild(g);
  }
}

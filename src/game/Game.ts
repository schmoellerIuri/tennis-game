import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GamePhase, MatchStats, PlayerSide, ShotType, Difficulty } from '@/types';
import { COURT, GAME, RENDER } from '@/utils/Constants';
import { worldToScreen, screenToWorld } from '@/utils/IsometricUtils';
import { Court } from './Court';
import { Player } from './Player';
import { Ball } from './Ball';
import { Score } from './Score';
import { InputManager } from '@/input/InputManager';
import { AIController } from '@/ai/AIController';

export class Game {
  readonly container = new Container();
  private readonly court: Court;
  private readonly playerNear: Player;
  private readonly playerFar: Player;
  private readonly ball: Ball;
  private readonly score: Score;
  private readonly input: InputManager;
  private readonly ai: AIController;
  private readonly scoreDisplay: Container;

  private phase: GamePhase = GamePhase.Countdown;
  private pauseTimer = 2;
  private accumulator = 0;
  private hasServed = false;
  private stats: MatchStats = { aces: 0, winners: 0, unforcedErrors: 0, totalPoints: 0 };
  private centerX = 0;
  private centerY = 0;
  private onMatchEnd: ((winner: PlayerSide, stats: MatchStats) => void) | null = null;

  // Tennis serve state
  private faultCount = 0;
  private pointsInCurrentGame = 0;
  private serveInProgress = false;
  private serveBounceChecked = false;
  private lastPointMessage = '';
  private rallyHitCount = 0;
  private aiServeDelay = 0;

  constructor(input: InputManager, difficulty: Difficulty, sets: number = 1) {
    this.court = new Court();
    this.playerNear = new Player(PlayerSide.Near);
    this.playerFar = new Player(PlayerSide.Far);
    this.ball = new Ball();
    this.score = new Score(sets);
    this.input = input;
    this.ai = new AIController(difficulty);
    this.scoreDisplay = new Container();

    this.container.addChild(this.court.container);
    this.container.addChild(this.playerFar.container);
    this.container.addChild(this.ball.container);
    this.container.addChild(this.playerNear.container);
    this.container.addChild(this.scoreDisplay);

    this.ball.reset(this.score.state.servingSide);
    this.setupServe();
  }

  setOnMatchEnd(cb: (winner: PlayerSide, stats: MatchStats) => void): void {
    this.onMatchEnd = cb;
  }

  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.container.x = x;
    this.container.y = y;
  }

  update(dt: number): void {
    this.accumulator += dt;
    const fixedDt = GAME.TICK_DURATION / 1000;

    while (this.accumulator >= fixedDt) {
      this.fixedUpdate(fixedDt);
      this.accumulator -= fixedDt;
    }

    this.render();
  }

  private fixedUpdate(dt: number): void {
    switch (this.phase) {
      case GamePhase.Countdown:
        this.updateCountdown(dt);
        break;
      case GamePhase.Serving:
        this.updateServing(dt);
        break;
      case GamePhase.Rally:
        this.updateRally(dt);
        break;
      case GamePhase.PointOver:
        this.updatePointOver(dt);
        break;
      case GamePhase.MatchOver:
        break;
    }
  }

  private updateCountdown(dt: number): void {
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);
    this.pauseTimer -= dt;
    if (this.pauseTimer <= 0) {
      this.setupServe();
      this.phase = GamePhase.Serving;
    }
  }

  private get isDeuceSide(): boolean {
    return this.pointsInCurrentGame % 2 === 0;
  }

  private updateServing(dt: number): void {
    // Tick animations for both players even while waiting
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);

    const isPlayerServing = this.score.state.servingSide === PlayerSide.Near;

    if (isPlayerServing) {
      const playerScreen = worldToScreen(this.playerNear.position.x, this.playerNear.position.y);
      const input = this.input.getInput(
        playerScreen.x + this.centerX,
        playerScreen.y + this.centerY,
      );

      if (input.shotType !== null && !this.hasServed) {
        this.hasServed = true;
        const mouse = this.input.getMousePosition();
        const worldTarget = screenToWorld(mouse.x - this.centerX, mouse.y - this.centerY);
        const targetX = worldTarget.x;
        const targetY = -(COURT.SERVICE_LINE_DIST * 0.3 + input.shotPower * COURT.SERVICE_LINE_DIST * 0.5);
        this.executeServe(PlayerSide.Near, targetX, targetY, input.shotPower);
      }
    } else {
      if (!this.hasServed) {
        this.aiServeDelay -= dt;
        if (this.aiServeDelay <= 0) {
          this.hasServed = true;
          const aiServe = this.ai.getServeTarget(this.isDeuceSide);
          this.executeServe(PlayerSide.Far, aiServe.targetX, aiServe.targetY, aiServe.power);
        }
      }
    }
  }

  private executeServe(side: PlayerSide, targetX: number, targetY: number, power: number): void {
    const server = side === PlayerSide.Near ? this.playerNear : this.playerFar;
    server.serve();

    const speed = GAME.BALL_SPEED_NORMAL * (0.6 + power * 0.3);

    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 2.5,
    };
    this.ball.hit(targetX, targetY, speed, 2, side);
    this.phase = GamePhase.Rally;
    this.serveInProgress = true;
    this.serveBounceChecked = false;
    this.rallyHitCount = 0;
  }

  private updateRally(dt: number): void {
    // Update player (near - human)
    const playerScreen = worldToScreen(this.playerNear.position.x, this.playerNear.position.y);
    const playerInput = this.input.getInput(
      playerScreen.x + this.centerX,
      playerScreen.y + this.centerY,
    );

    const isoInput = { ...playerInput };
    isoInput.moveX = playerInput.moveX;
    isoInput.moveY = playerInput.moveY;
    this.playerNear.update(dt, isoInput);

    // AI movement
    const ballApproaching = this.ball.state.velocity.y < 0;
    const aiInput = this.ai.getInput(
      this.playerFar.position,
      this.ball.state.position,
      this.ball.state.velocity,
      this.ball.state.inPlay,
      ballApproaching,
    );
    this.playerFar.update(dt, aiInput);

    // Ball physics
    this.ball.update(dt);

    // Serve landing validation
    if (this.serveInProgress && !this.serveBounceChecked) {
      // Net hit during serve = fault
      if (this.ball.isNetHit()) {
        this.handleFault();
        return;
      }

      // Check first bounce landing
      if (this.ball.state.bounceCount >= 1) {
        if (this.isServeInBox()) {
          this.serveBounceChecked = true;
          this.serveInProgress = false;
        } else {
          this.handleFault();
          return;
        }
      }

      // Ball went out without valid bounce
      if (this.ball.isOut()) {
        this.handleFault();
        return;
      }

      // During serve flight, receiver can't hit (must let it bounce)
      return;
    }

    // Hit detection - player
    if (playerInput.shotType !== null && this.playerNear.canHit) {
      this.tryHit(this.playerNear, playerInput.aimAngle, playerInput.shotPower, playerInput.shotType);
    }

    // Hit detection - AI
    if (aiInput.shotType !== null && this.playerFar.canHit) {
      this.tryHit(this.playerFar, aiInput.aimAngle, aiInput.shotPower, aiInput.shotType);
    }

    // Point resolution
    this.checkPointEnd();
  }

  private isServeInBox(): boolean {
    const pos = this.ball.getLastBouncePos();
    const hw = COURT.SINGLES_WIDTH / 2;
    const sl = COURT.SERVICE_LINE_DIST;
    const servingSide = this.score.state.servingSide;

    if (servingSide === PlayerSide.Near) {
      // Near serves toward -y; must land in far service box: y in [-sl, 0]
      if (pos.y < -sl || pos.y > 0) return false;
      if (Math.abs(pos.x) > hw) return false;
      // Cross-court: deuce side (+x server) → must land in -x half
      if (this.isDeuceSide && pos.x > 0) return false;
      if (!this.isDeuceSide && pos.x < 0) return false;
    } else {
      // Far serves toward +y; must land in near service box: y in [0, sl]
      if (pos.y > sl || pos.y < 0) return false;
      if (Math.abs(pos.x) > hw) return false;
      // Cross-court: deuce side (-x server) → must land in +x half
      if (this.isDeuceSide && pos.x < 0) return false;
      if (!this.isDeuceSide && pos.x > 0) return false;
    }

    return true;
  }

  private handleFault(): void {
    this.faultCount++;
    if (this.faultCount >= 2) {
      // Double fault — point to receiver
      this.lastPointMessage = 'DOUBLE FAULT';
      const receiver = this.score.state.servingSide === PlayerSide.Near
        ? PlayerSide.Far
        : PlayerSide.Near;
      this.endPoint(receiver);
    } else {
      // First fault — re-serve
      this.lastPointMessage = 'FAULT';
      this.phase = GamePhase.PointOver;
      this.pauseTimer = 1.5;
    }
  }

  private tryHit(player: Player, aimAngle: number, power: number, shotType: ShotType): void {
    const bp = this.ball.state.position;
    const pp = player.position;
    const dx = bp.x - pp.x;
    const dy = bp.y - pp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > GAME.PLAYER_HIT_RADIUS || bp.z > 2.5) return;
    if (this.ball.state.lastHitBy === player.side) return;

    this.rallyHitCount++;
    player.swing();

    const isLob = shotType === ShotType.Lob;
    const speed = isLob ? GAME.BALL_SPEED_LOB : GAME.BALL_SPEED_NORMAL;
    const lobHeight = isLob ? 4 : 1.5;

    const direction = player.side === PlayerSide.Near ? -1 : 1;

    // Determine horizontal target from mouse world position (human) or aim angle (AI)
    let targetX: number;
    if (player.side === PlayerSide.Near) {
      const mouse = this.input.getMousePosition();
      const worldTarget = screenToWorld(mouse.x - this.centerX, mouse.y - this.centerY);
      targetX = worldTarget.x;
    } else {
      targetX = Math.cos(aimAngle) * COURT.SINGLES_WIDTH * 0.4;
    }

    // Depth: power controls how deep — high power can overshoot the baseline
    const targetY = direction * (COURT.HALF_LENGTH * 0.3 + power * COURT.HALF_LENGTH * 0.9);

    this.ball.hit(targetX, targetY, speed * (0.8 + power * 0.2), lobHeight, player.side);
  }

  private checkPointEnd(): void {
    const ball = this.ball;

    if (ball.isNetHit()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.lastPointMessage = 'NET';
      this.endPoint(winner);
      return;
    }

    // Double bounce must be checked BEFORE out — the second bounce may land
    // past the baseline, but the point was already decided by the receiver
    // failing to return the ball.
    if (ball.isDoubleBounce()) {
      const landingSide = ball.getLandingSide();
      if (landingSide !== null) {
        const winner = landingSide === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
        if (this.rallyHitCount === 0) {
          this.stats.aces++;
          this.lastPointMessage = 'ACE';
        } else {
          this.stats.winners++;
          this.lastPointMessage = '';
        }
        this.endPoint(winner);
      }
      return;
    }

    if (ball.isOut()) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.stats.unforcedErrors++;
      this.lastPointMessage = 'OUT';
      this.endPoint(winner);
      return;
    }

    // Ball fell too far off court
    if (ball.state.position.z < -5) {
      const winner = ball.state.lastHitBy === PlayerSide.Near ? PlayerSide.Far : PlayerSide.Near;
      this.endPoint(winner);
    }
  }

  private endPoint(winner: PlayerSide): void {
    this.stats.totalPoints++;
    this.pointsInCurrentGame++;

    const prevTotalGames = this.score.state.games[0].reduce((a, b) => a + b, 0) +
                           this.score.state.games[1].reduce((a, b) => a + b, 0);

    this.score.pointWon(winner);

    const newTotalGames = this.score.state.games[0].reduce((a, b) => a + b, 0) +
                          this.score.state.games[1].reduce((a, b) => a + b, 0);

    // New game started — reset point counter
    if (newTotalGames !== prevTotalGames) {
      this.pointsInCurrentGame = 0;
    }

    this.faultCount = 0;
    this.serveInProgress = false;
    this.phase = GamePhase.PointOver;
    this.pauseTimer = GAME.POINT_PAUSE_DURATION / 1000;

    if (this.score.isMatchOver()) {
      this.phase = GamePhase.MatchOver;
      if (this.onMatchEnd) {
        this.onMatchEnd(this.score.getMatchWinner()!, { ...this.stats });
      }
    }
  }

  private updatePointOver(dt: number): void {
    this.playerNear.tickAnimation(dt);
    this.playerFar.tickAnimation(dt);
    this.pauseTimer -= dt;
    if (this.pauseTimer <= 0) {
      if (this.lastPointMessage === 'FAULT') {
        // Re-serve after first fault (keep faultCount, same side)
        this.lastPointMessage = '';
        this.positionForServe();
        this.phase = GamePhase.Serving;
      } else {
        this.lastPointMessage = '';
        this.setupServe();
        this.phase = GamePhase.Serving;
      }
    }
  }

  private positionForServe(): void {
    const servingSide = this.score.state.servingSide;
    const server = servingSide === PlayerSide.Near ? this.playerNear : this.playerFar;
    const receiver = servingSide === PlayerSide.Near ? this.playerFar : this.playerNear;

    // Server: behind baseline, deuce/ad side
    if (servingSide === PlayerSide.Near) {
      server.position.x = this.isDeuceSide ? 1.5 : -1.5;
      server.position.y = COURT.HALF_LENGTH;
    } else {
      server.position.x = this.isDeuceSide ? -1.5 : 1.5;
      server.position.y = -COURT.HALF_LENGTH;
    }

    // Receiver: opposite baseline, positioned to receive
    if (servingSide === PlayerSide.Near) {
      receiver.position.x = this.isDeuceSide ? -1 : 1;
      receiver.position.y = -COURT.HALF_LENGTH + 2;
    } else {
      receiver.position.x = this.isDeuceSide ? 1 : -1;
      receiver.position.y = COURT.HALF_LENGTH - 2;
    }

    // Ball at server
    this.ball.reset(servingSide);
    this.ball.state.position = {
      x: server.position.x,
      y: server.position.y,
      z: 1,
    };

    this.hasServed = false;
    this.serveInProgress = false;
    this.aiServeDelay = 1.0 + Math.random() * 0.5;
  }

  private setupServe(): void {
    // Detect new game (points reset)
    if (this.score.state.points[0] === 0 && this.score.state.points[1] === 0
        && !this.score.state.isDeuce) {
      this.pointsInCurrentGame = 0;
    }

    this.faultCount = 0;
    this.playerNear.resetPosition();
    this.playerFar.resetPosition();
    this.positionForServe();
  }

  private render(): void {
    this.playerNear.render();
    this.playerFar.render();
    this.ball.render();
    this.renderScore();
    this.renderAimLine();

    // Depth sort
    const ballDepth = this.ball.state.position.x + this.ball.state.position.y;
    const netDepth = 0;

    this.container.removeChildren();
    this.container.addChild(this.court.container);

    if (ballDepth < netDepth) {
      this.container.addChild(this.ball.container);
    }
    this.container.addChild(this.playerFar.container);
    if (ballDepth >= netDepth) {
      this.container.addChild(this.ball.container);
    }
    this.container.addChild(this.playerNear.container);
    this.container.addChild(this.scoreDisplay);
  }

  private renderAimLine(): void {
    if (this.phase !== GamePhase.Rally && this.phase !== GamePhase.Serving) return;

    const playerScreen = worldToScreen(this.playerNear.position.x, this.playerNear.position.y);
    const mouse = this.input.getMousePosition();
    const startX = playerScreen.x;
    const startY = playerScreen.y;
    const endX = mouse.x - this.centerX;
    const endY = mouse.y - this.centerY;

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const power = Math.min(1, dist / 150);

    let color: number;
    if (power < 0.5) {
      const t = power / 0.5;
      const r = Math.floor(0x33 + t * (0xFF - 0x33));
      const g = Math.floor(0x99 + t * (0xFF - 0x99));
      const b = Math.floor(0xFF * (1 - t));
      color = (r << 16) | (g << 8) | b;
    } else {
      const t = (power - 0.5) / 0.5;
      const r = 0xFF;
      const g = Math.floor(0xFF * (1 - t));
      const b = 0;
      color = (r << 16) | (g << 8) | b;
    }

    const g = new Graphics();
    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ width: 2, color, alpha: 0.5 });
    g.circle(endX, endY, 4 + power * 4);
    g.fill({ color, alpha: 0.6 });

    this.playerNear.container.addChild(g);
  }

  private renderScore(): void {
    this.scoreDisplay.removeChildren();

    const display = this.score.getDisplayScore();
    const games = this.score.state.games;
    const servingSide = this.score.state.servingSide;

    const nameStyle = new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 16,
      fill: RENDER.COLORS.UI_TEXT,
      fontWeight: 'bold',
    });

    const pointStyle = new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 18,
      fill: RENDER.COLORS.UI_ACCENT,
      fontWeight: 'bold',
    });

    const gamesStyle = new TextStyle({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 16,
      fill: RENDER.COLORS.UI_TEXT,
      fontWeight: 'normal',
    });

    const baseX = -this.centerX + 20;
    const baseY = -this.centerY + 16;

    const bg = new Graphics();
    bg.roundRect(baseX - 10, baseY - 6, 220, 64, 8);
    bg.fill({ color: RENDER.COLORS.UI_BG, alpha: 0.9 });
    this.scoreDisplay.addChild(bg);

    const serveNear = servingSide === PlayerSide.Near ? ' \u25B6' : '';
    const serveFar = servingSide === PlayerSide.Far ? ' \u25B6' : '';

    const youLabel = new Text({ text: `YOU${serveNear}`, style: nameStyle });
    youLabel.x = baseX;
    youLabel.y = baseY;
    this.scoreDisplay.addChild(youLabel);

    const gamesStr0 = games[0].map((g) => g.toString()).join('  ');
    const youGames = new Text({ text: gamesStr0, style: gamesStyle });
    youGames.x = baseX + 75;
    youGames.y = baseY + 1;
    this.scoreDisplay.addChild(youGames);

    const youPoints = new Text({ text: display.near, style: pointStyle });
    youPoints.x = baseX + 170;
    youPoints.y = baseY - 1;
    this.scoreDisplay.addChild(youPoints);

    const cpuLabel = new Text({ text: `CPU${serveFar}`, style: nameStyle });
    cpuLabel.x = baseX;
    cpuLabel.y = baseY + 28;
    this.scoreDisplay.addChild(cpuLabel);

    const gamesStr1 = games[1].map((g) => g.toString()).join('  ');
    const cpuGames = new Text({ text: gamesStr1, style: gamesStyle });
    cpuGames.x = baseX + 75;
    cpuGames.y = baseY + 29;
    this.scoreDisplay.addChild(cpuGames);

    const cpuPoints = new Text({ text: display.far, style: pointStyle });
    cpuPoints.x = baseX + 170;
    cpuPoints.y = baseY + 27;
    this.scoreDisplay.addChild(cpuPoints);

    // Center messages (fault, out, deuce, etc.)
    if (this.phase === GamePhase.PointOver && this.lastPointMessage) {
      const msgStyle = new TextStyle({
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 28,
        fill: RENDER.COLORS.UI_ACCENT,
        fontWeight: 'bold',
      });
      const msgText = new Text({ text: this.lastPointMessage, style: msgStyle });
      msgText.anchor.set(0.5);
      msgText.x = 0;
      msgText.y = -80;
      this.scoreDisplay.addChild(msgText);
    } else if (this.phase === GamePhase.PointOver) {
      const msg = this.getPointMessage();
      if (msg) {
        const msgStyle = new TextStyle({
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 28,
          fill: RENDER.COLORS.UI_ACCENT,
          fontWeight: 'bold',
        });
        const msgText = new Text({ text: msg, style: msgStyle });
        msgText.anchor.set(0.5);
        msgText.x = 0;
        msgText.y = -80;
        this.scoreDisplay.addChild(msgText);
      }
    }

    if (this.phase === GamePhase.Countdown) {
      const countStyle = new TextStyle({
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 32,
        fill: RENDER.COLORS.UI_ACCENT,
        fontWeight: 'bold',
      });
      const seconds = Math.ceil(this.pauseTimer);
      const countText = new Text({ text: `${seconds}`, style: countStyle });
      countText.anchor.set(0.5);
      countText.x = 0;
      countText.y = -40;
      this.scoreDisplay.addChild(countText);
    }

    if (this.phase === GamePhase.Serving) {
      const servingStyle = new TextStyle({
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 16,
        fill: 0xCCCCCC,
      });
      const isPlayer = this.score.state.servingSide === PlayerSide.Near;
      const faultLabel = this.faultCount === 1 ? ' (2nd serve)' : '';
      const serveText = new Text({
        text: isPlayer ? `Click to serve${faultLabel}` : 'Opponent serving...',
        style: servingStyle,
      });
      serveText.anchor.set(0.5);
      serveText.x = 0;
      serveText.y = 100;
      this.scoreDisplay.addChild(serveText);
    }
  }

  private getPointMessage(): string {
    if (this.score.state.isDeuce) return 'DEUCE';
    if (this.score.state.advantage) {
      return this.score.state.advantage === PlayerSide.Near ? 'ADVANTAGE YOU' : 'ADVANTAGE CPU';
    }
    return '';
  }
}

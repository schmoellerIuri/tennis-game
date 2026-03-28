import * as THREE from 'three';
import {
  COURT_LENGTH,
  HALF_LENGTH,
  SINGLES_WIDTH,
  DOUBLES_WIDTH,
  SERVICE_LINE_DIST,
  CENTER_MARK_LENGTH,
  LINE_WIDTH,
  SURROUND_MARGIN,
  COLORS,
} from '@/utils/Constants';

export class Court {
  readonly group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();

    this.createSurround();
    this.createClaySurface();
    this.createLines();
  }

  private createSurround(): void {
    const totalW = DOUBLES_WIDTH + SURROUND_MARGIN * 2;
    const totalL = COURT_LENGTH + SURROUND_MARGIN * 2;
    const geo = new THREE.PlaneGeometry(totalW, totalL);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.surround });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.001;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private createClaySurface(): void {
    const geo = new THREE.PlaneGeometry(DOUBLES_WIDTH, COURT_LENGTH);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.clay });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.002;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private createLines(): void {
    const y = 0.003;
    const halfSW = SINGLES_WIDTH / 2;
    const halfDW = DOUBLES_WIDTH / 2;

    // Baselines (at z = ±HALF_LENGTH)
    this.addLine(DOUBLES_WIDTH, LINE_WIDTH, 0, y, HALF_LENGTH);
    this.addLine(DOUBLES_WIDTH, LINE_WIDTH, 0, y, -HALF_LENGTH);

    // Singles sidelines
    this.addLine(LINE_WIDTH, COURT_LENGTH, halfSW, y, 0);
    this.addLine(LINE_WIDTH, COURT_LENGTH, -halfSW, y, 0);

    // Doubles sidelines
    this.addLine(LINE_WIDTH, COURT_LENGTH, halfDW, y, 0);
    this.addLine(LINE_WIDTH, COURT_LENGTH, -halfDW, y, 0);

    // Service lines
    this.addLine(SINGLES_WIDTH, LINE_WIDTH, 0, y, SERVICE_LINE_DIST);
    this.addLine(SINGLES_WIDTH, LINE_WIDTH, 0, y, -SERVICE_LINE_DIST);

    // Center service line
    this.addLine(LINE_WIDTH, SERVICE_LINE_DIST * 2, 0, y, 0);

    // Center marks on baselines
    this.addLine(LINE_WIDTH, CENTER_MARK_LENGTH, 0, y, HALF_LENGTH - CENTER_MARK_LENGTH / 2);
    this.addLine(LINE_WIDTH, CENTER_MARK_LENGTH, 0, y, -(HALF_LENGTH - CENTER_MARK_LENGTH / 2));
  }

  private addLine(width: number, length: number, x: number, y: number, z: number): void {
    const geo = new THREE.PlaneGeometry(width, length);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.lines });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
  }
}

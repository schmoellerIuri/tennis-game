import * as THREE from 'three';
import { COURT, RENDER_3D } from '@/utils/Constants';

export class Court {
  readonly group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.buildSurface();
    this.buildLines();
    this.buildNet();
    scene.add(this.group);
  }

  private buildSurface(): void {
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    const margin = 5;

    // Surround (green area)
    const surroundGeo = new THREE.PlaneGeometry(
      (hw + margin) * 2,
      (hl + margin) * 2,
    );
    const surroundMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.SURROUND });
    const surround = new THREE.Mesh(surroundGeo, surroundMat);
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.01;
    surround.receiveShadow = true;
    this.group.add(surround);

    // Court surface (clay)
    const courtGeo = new THREE.PlaneGeometry(hw * 2, hl * 2);
    const courtMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.CLAY_LIGHT });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0;
    court.receiveShadow = true;
    this.group.add(court);
  }

  private buildLines(): void {
    const hw = COURT.SINGLES_WIDTH / 2;
    const hl = COURT.HALF_LENGTH;
    const sl = COURT.SERVICE_LINE_DIST;
    const lineY = 0.01; // Slightly above court to avoid z-fighting

    const lineMat = new THREE.LineBasicMaterial({ color: RENDER_3D.COLORS.COURT_LINE });

    const addLine = (x1: number, z1: number, x2: number, z2: number) => {
      const points = [
        new THREE.Vector3(x1, lineY, z1),
        new THREE.Vector3(x2, lineY, z2),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geo, lineMat));
    };

    // Baselines
    addLine(-hw, -hl, hw, -hl);
    addLine(-hw, hl, hw, hl);

    // Sidelines
    addLine(-hw, -hl, -hw, hl);
    addLine(hw, -hl, hw, hl);

    // Service lines
    addLine(-hw, -sl, hw, -sl);
    addLine(-hw, sl, hw, sl);

    // Center service line
    addLine(0, -sl, 0, sl);

    // Center marks
    addLine(0, -hl, 0, -hl + 0.5);
    addLine(0, hl, 0, hl - 0.5);
  }

  private buildNet(): void {
    const hw = COURT.SINGLES_WIDTH / 2 + 0.5;
    const netH = COURT.NET_HEIGHT;

    // Net mesh (semi-transparent plane)
    const netGeo = new THREE.PlaneGeometry(hw * 2, netH);
    const netMat = new THREE.MeshLambertMaterial({
      color: RENDER_3D.COLORS.NET,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, netH / 2, 0);
    this.group.add(net);

    // Net top line (white cord)
    const cordMat = new THREE.LineBasicMaterial({ color: 0xFFFFFF });
    const cordPoints = [
      new THREE.Vector3(-hw, netH, 0),
      new THREE.Vector3(hw, netH, 0),
    ];
    const cordGeo = new THREE.BufferGeometry().setFromPoints(cordPoints);
    this.group.add(new THREE.Line(cordGeo, cordMat));

    // Net posts
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, netH + 0.1, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: RENDER_3D.COLORS.NET_POST });

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-hw, (netH + 0.1) / 2, 0);
    leftPost.castShadow = true;
    this.group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(hw, (netH + 0.1) / 2, 0);
    rightPost.castShadow = true;
    this.group.add(rightPost);
  }
}

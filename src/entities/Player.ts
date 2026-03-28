import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { Racket } from './Racket';
import { PlayerInput, PlayerSide, AnimationState } from '@/types/index';
import { PLAYER, PLAYER_BOUNDS, HALF_LENGTH } from '@/utils/Constants';

// Bone search keywords — used for fuzzy matching against actual bone names
const BONE_KEY = {
  spine: 'spine_01',
  upperArmL: 'upper_arml',
  upperArmR: 'upper_armr',
  forearmL: 'forearml',
  forearmR: 'forearmr',
  handR: 'handr',
  thighL: 'thighl',
  thighR: 'thighr',
  shinL: 'shinl',
  shinR: 'shinr',
} as const;

type BoneKey = keyof typeof BONE_KEY;

// Bones driven by the procedural run animation
const RUN_BONE_KEYS: BoneKey[] = [
  'thighL', 'thighR',
  'shinL', 'shinR',
  'upperArmL', 'upperArmR',
  'forearmL', 'forearmR',
  'spine',
];

export class Player {
  readonly group: THREE.Group;
  readonly side: PlayerSide;

  // Physics
  private rigidBody: RAPIER.RigidBody;

  // Skeleton bones for procedural animation (keyed by BoneKey)
  private bones: Map<BoneKey, THREE.Bone> = new Map();
  private restQuaternions: Map<BoneKey, THREE.Quaternion> = new Map();

  // Animation
  private mixer: THREE.AnimationMixer;
  private idleAction: THREE.AnimationAction | null = null;

  // State
  private animState: AnimationState = 'idle';
  private animTime = 0;
  private facingAngle = 0;
  private velocity = new THREE.Vector3();

  // Model root inside the group (for facing rotation)
  private modelRoot: THREE.Object3D;

  private constructor(
    group: THREE.Group,
    side: PlayerSide,
    rigidBody: RAPIER.RigidBody,
    mixer: THREE.AnimationMixer,
    idleAction: THREE.AnimationAction | null,
    modelRoot: THREE.Object3D,
    bones: Map<BoneKey, THREE.Bone>,
    restQuaternions: Map<BoneKey, THREE.Quaternion>,
  ) {
    this.group = group;
    this.side = side;
    this.rigidBody = rigidBody;
    this.mixer = mixer;
    this.idleAction = idleAction;
    this.modelRoot = modelRoot;
    this.bones = bones;
    this.restQuaternions = restQuaternions;
  }

  /**
   * Search all bones in the model for one whose name contains the given
   * keyword (case-insensitive). Returns the first match, or undefined.
   */
  private static findBoneByKeyword(
    allBones: THREE.Bone[],
    keyword: string,
  ): THREE.Bone | undefined {
    const kw = keyword.toLowerCase();
    return allBones.find((b) => b.name.toLowerCase().includes(kw));
  }

  static async create(physics: PhysicsWorld, side: PlayerSide): Promise<Player> {
    const group = new THREE.Group();

    // Starting position
    const startZ = side === 'near' ? HALF_LENGTH - 1.5 : -(HALF_LENGTH - 1.5);
    group.position.set(0, 0, startZ);

    // ── Load person model ────────────────────────────────
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/src/assets/person.glb');
    const model = gltf.scene;

    // Calculate scale to make the model ~1.80m tall
    const box = new THREE.Box3().setFromObject(model);
    const modelHeight = box.max.y - box.min.y;
    const targetHeight = PLAYER.height; // 1.80
    const scaleFactor = targetHeight / modelHeight;
    model.scale.multiplyScalar(scaleFactor);

    // Recompute bounding box after scale to position feet on ground
    box.setFromObject(model);
    model.position.y = -box.min.y;

    // Enable shadows on all meshes
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Wrap model in a pivot for facing rotation
    const modelRoot = new THREE.Group();
    modelRoot.add(model);
    group.add(modelRoot);

    // ── Collect all bones from the skeleton ───────────────
    const allBones: THREE.Bone[] = [];
    model.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        allBones.push(child as THREE.Bone);
      }
    });

    console.log(
      '[Player] bones found in model:',
      allBones.map((b) => b.name),
    );

    // Map our logical bone keys to actual bones via fuzzy name matching
    const bones = new Map<BoneKey, THREE.Bone>();
    for (const [key, keyword] of Object.entries(BONE_KEY) as [BoneKey, string][]) {
      const bone = Player.findBoneByKeyword(allBones, keyword);
      if (bone) {
        bones.set(key, bone);
      } else {
        console.warn(`[Player] bone not found for key "${key}" (keyword "${keyword}")`);
      }
    }

    // ── Load and attach racket to right hand ─────────────
    const handBone = bones.get('handR');
    if (handBone) {
      const racket = await Racket.create();

      // The bone sits deep in a hierarchy with non-uniform scales
      // (e.g. 0.01 × 100 from FBX export). Compute the bone's world
      // scale so we can compensate and keep the racket at a sane size.
      handBone.updateWorldMatrix(true, false);
      const boneWorldScale = new THREE.Vector3();
      handBone.getWorldScale(boneWorldScale);

      // Undo the bone chain's accumulated scale so 1 local unit ≈ 1 m
      racket.group.scale.set(
        1 / boneWorldScale.x,
        1 / boneWorldScale.y,
        1 / boneWorldScale.z,
      );

      // Position / orient in bone-local space (values in metres after compensation)
      racket.group.position.set(0, 0.05, 0);
      racket.group.rotation.set(Math.PI / 2, 0, 0);

      handBone.add(racket.group);
    } else {
      console.warn('[Player] hand.R bone not found — racket not attached');
    }

    // ── Set up animation mixer ───────────────────────────
    const mixer = new THREE.AnimationMixer(model);
    let idleAction: THREE.AnimationAction | null = null;

    if (gltf.animations.length > 0) {
      const clip = gltf.animations[0];
      idleAction = mixer.clipAction(clip);
      idleAction.play();
    }

    // ── Store rest-pose quaternions for procedural overlay bones
    // Evaluate mixer at t=0 so bones have the clip's first-frame pose
    mixer.update(0);

    const restQuaternions = new Map<BoneKey, THREE.Quaternion>();
    for (const key of RUN_BONE_KEYS) {
      const bone = bones.get(key);
      if (bone) {
        restQuaternions.set(key, bone.quaternion.clone());
      }
    }

    // ── Physics rigid body (kinematic capsule) ───────────
    const R = physics.RAPIER;
    const bodyDesc = R.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(group.position.x, PLAYER.hipY, group.position.z);
    const rigidBody = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = R.ColliderDesc.capsule(PLAYER.torsoLength / 2, PLAYER.torsoRadius);
    physics.world.createCollider(colliderDesc, rigidBody);

    return new Player(
      group, side, rigidBody, mixer, idleAction,
      modelRoot, bones, restQuaternions,
    );
  }

  update(dt: number, input: PlayerInput): void {
    const speed = PLAYER.moveSpeed;
    this.velocity.set(input.moveX * speed, 0, input.moveZ * speed);

    const isMoving = this.velocity.lengthSq() > 0.01;
    this.animState = isMoving ? 'running' : 'idle';

    // Move position
    const pos = this.group.position;
    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;

    // Clamp to boundaries
    pos.x = Math.max(PLAYER_BOUNDS.minX, Math.min(PLAYER_BOUNDS.maxX, pos.x));
    pos.z = Math.max(PLAYER_BOUNDS.minZ, Math.min(PLAYER_BOUNDS.maxZ, pos.z));

    // Face movement direction
    if (isMoving) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetAngle - this.facingAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingAngle += diff * Math.min(1, 10 * dt);
    }
    this.modelRoot.rotation.y = this.facingAngle;

    // Sync physics body
    this.rigidBody.setNextKinematicTranslation(
      { x: pos.x, y: PLAYER.hipY, z: pos.z },
    );
  }

  updateAnimation(dt: number): void {
    this.animTime += dt;

    if (this.animState === 'running') {
      // Disable the idle action entirely so the mixer doesn't touch bones
      if (this.idleAction) this.idleAction.enabled = false;
      this.animateRun();
    } else {
      // Re-enable the idle action and advance the mixer
      if (this.idleAction) this.idleAction.enabled = true;
      this.mixer.update(dt);
    }
  }

  // ── Procedural run animation applied to skeleton bones ──
  private static _qTemp = new THREE.Quaternion();
  private static _eulerTemp = new THREE.Euler();

  private applyBoneOverlay(key: BoneKey, rx: number, ry = 0, rz = 0): void {
    const bone = this.bones.get(key);
    const rest = this.restQuaternions.get(key);
    if (!bone || !rest) return;

    const euler = Player._eulerTemp;
    const q = Player._qTemp;

    euler.set(rx, ry, rz);
    q.setFromEuler(euler);
    bone.quaternion.copy(rest).multiply(q);
  }

  private animateRun(): void {
    const t = this.animTime;
    const freq = 10.0;
    const cycle = Math.sin(t * freq);
    const cycleAbs = Math.abs(cycle);

    // Leg swing — opposite legs
    const legSwing = cycle * 0.6;
    this.applyBoneOverlay('thighL', legSwing);
    this.applyBoneOverlay('thighR', -legSwing);

    // Knee bend (only when leg is swinging backward)
    this.applyBoneOverlay('shinL', Math.max(0, -legSwing) * 1.0);
    this.applyBoneOverlay('shinR', Math.max(0, legSwing) * 1.0);

    // Arm swing — opposite to legs
    this.applyBoneOverlay('upperArmL', -legSwing * 0.6);
    this.applyBoneOverlay('upperArmR', legSwing * 0.6);
    this.applyBoneOverlay('forearmL', -0.4 - cycleAbs * 0.2);
    this.applyBoneOverlay('forearmR', -0.4 - cycleAbs * 0.2);

    // Slight forward lean on spine
    this.applyBoneOverlay('spine', -0.08);
  }
}

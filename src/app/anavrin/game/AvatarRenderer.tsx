import { ContactShadows, Environment, PresentationControls, useFBX, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Box3, Color, Group, MathUtils, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3, type Bone } from "three";

import { ANAVRIN_CONFIG } from "../config/anavrinConfig";
import {
  EYE_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  SKIN_TONE_OPTIONS,
} from "../lib/avatarSchema";
import type { AvatarDraft, CameraFocus } from "../types";

const TOP_COLORS: Record<string, string> = {
  "soho-jacket": "#b65b44",
  "brooklyn-hoodie": "#426c9e",
  "midtown-blazer": "#d1d6de",
  "uptown-vest": "#4d8b76",
};

const PANTS_COLORS: Record<string, string> = {
  "cargo-tech": "#35475f",
  "tailored-black": "#171a22",
  "denim-dark": "#26435e",
  "track-slate": "#4b5563",
};

const SHOE_COLORS: Record<string, string> = {
  "runner-carbon": "#111827",
  "lux-loafers": "#3f2f24",
  "court-white": "#eef2f7",
  "combat-onyx": "#0b0d10",
};

const ACCESSORY_COLORS: Record<string, string> = {
  none: "#000000",
  "chain-silver": "#b8c0cc",
  "visor-black": "#111827",
  "crossbody-tech": "#96a7bf",
};

const AURA_COLORS: Record<string, string> = {
  "city-neon": "#5fd6ff",
  "platinum-haze": "#d7e2ef",
  "empire-amber": "#ffb54d",
  "downtown-mint": "#72f1c0",
};

type AvatarFigureProps = {
  draft: AvatarDraft;
  locomotion?: "idle" | "walk";
};

type RigBone = {
  bone: Bone;
  restX: number;
  restY: number;
  restZ: number;
};

const MODEL_LIBRARY = {
  masculine: {
    model: ANAVRIN_CONFIG.assets.previewCharacters.masculine.model,
    root: ANAVRIN_CONFIG.assets.previewCharacters.masculine.root,
    materials: {
      armor: {
        base: "T_Armor_BaseColor.png",
        normal: "T_Armor_Normal_OpenGL.png",
        rough: "T_Armor_Rough.png",
        metal: "T_Armor_Metalic.png",
      },
      cloth: {
        base: "T_Cloth_BaseColor.png",
        normal: "T_Cloth_Normal_OpenGL.png",
        rough: "T_Cloth_Rough.png",
        metal: "T_Cloth_Metalic.png",
      },
      organic: {
        base: "T_Organik_BaseColor.png",
        normal: "T_Organik_Normal_OpenGL.png",
        rough: "T_Organik_Rough.png",
        metal: "T_Organik_Metalic.png",
      },
    },
  },
  feminine: {
    model: ANAVRIN_CONFIG.assets.previewCharacters.feminine.model,
    root: ANAVRIN_CONFIG.assets.previewCharacters.feminine.root,
    materials: {
      other: {
        base: "T_Other_BaseColor.png",
        normal: "T_Other_Normal_OpenGL.png",
        rough: "T_Other_Rough.png",
        metal: "T_Other_Metalic.png",
      },
      cloth: {
        base: "T_Cloth_BaseColor.png",
        normal: "T_Cloth_Normal_OpenGL.png",
        rough: "T_Cloth_Rough.png",
        metal: "T_Cloth_Metalic.png",
      },
      organic: {
        base: "T_Organic_BaseColor.png",
        normal: "T_Organic_Normal_OpenGL.png",
        rough: "T_Organic_Rough.png",
        metal: "T_Organic_Metalic.png",
      },
    },
  },
} as const;

function colorFromSwatch(swatch: string | undefined, fallback: string) {
  return new Color(swatch ?? fallback);
}

function PreviewCameraRig({
  focus,
  zoom,
}: {
  focus: CameraFocus;
  zoom: number;
}) {
  useFrame(({ camera }, delta) => {
    const targetY = focus === "face" ? 1.75 : focus === "body" ? 1.25 : 1.45;
    const targetZ = focus === "face" ? zoom * 0.72 : focus === "body" ? zoom : zoom * 1.12;

    camera.position.x = MathUtils.damp(camera.position.x, 0, 5, delta);
    camera.position.y = MathUtils.damp(camera.position.y, targetY, 5, delta);
    camera.position.z = MathUtils.damp(camera.position.z, targetZ, 5, delta);
    camera.lookAt(0, focus === "face" ? 1.55 : 1.1, 0);
  });

  return null;
}

function AvatarHair({
  hairType,
  hairColor,
}: {
  hairType: number;
  hairColor: Color;
}) {
  if (hairType === 0) return null;

  if (hairType === 7) {
    return (
      <mesh position={[0, 1.56, 0]} castShadow>
        <sphereGeometry args={[0.28, 18, 18]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
    );
  }

  if (hairType === 2 || hairType === 6) {
    return (
      <group>
        <mesh position={[0, 1.64, -0.02]} castShadow>
          <sphereGeometry args={[0.31, 20, 20]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
        <mesh position={[0, 1.26, -0.24]} castShadow>
          <boxGeometry args={[0.24, hairType === 6 ? 0.42 : 0.62, 0.12]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
      </group>
    );
  }

  if (hairType === 3) {
    return (
      <group>
        {[-0.18, 0, 0.18].map((offset) => (
          <mesh key={offset} position={[offset, 1.62, 0.05]} castShadow>
            <sphereGeometry args={[0.14, 14, 14]} />
            <meshStandardMaterial color={hairColor} />
          </mesh>
        ))}
      </group>
    );
  }

  if (hairType === 4 || hairType === 5) {
    return (
      <group>
        {[-0.14, 0, 0.14].map((offset) => (
          <mesh key={offset} position={[offset, 1.38, 0.22]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, hairType === 5 ? 0.62 : 0.42, 10]} />
            <meshStandardMaterial color={hairColor} />
          </mesh>
        ))}
        <mesh position={[0, 1.63, 0]} castShadow>
          <sphereGeometry args={[0.28, 18, 18]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, 1.61, 0]} castShadow>
      <sphereGeometry args={[0.3, 20, 20]} />
      <meshStandardMaterial color={hairColor} />
    </mesh>
  );
}

function AvatarAccessory({
  accessory,
  color,
}: {
  accessory: string;
  color: string;
}) {
  if (accessory === "none") return null;

  if (accessory === "chain-silver") {
    return (
      <mesh position={[0, 1.13, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.015, 10, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.25} />
      </mesh>
    );
  }

  if (accessory === "visor-black") {
    return (
      <mesh position={[0, 1.46, 0.31]} castShadow>
        <boxGeometry args={[0.44, 0.08, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return (
    <group position={[0.2, 1.02, 0]}>
      <mesh rotation={[0.1, 0, 0.25]} castShadow>
        <boxGeometry args={[0.12, 0.48, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.22, 0.2, 0]} rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.6, 0.05, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ProceduralAvatarFigure({ draft, locomotion = "idle" }: AvatarFigureProps) {
  const rootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const auraRef = useRef<Group>(null);

  const skinColor = useMemo(
    () =>
      colorFromSwatch(
        SKIN_TONE_OPTIONS[draft.appearance.skin_tone]?.swatch,
        "#d1a27d"
      ),
    [draft.appearance.skin_tone]
  );
  const hairColor = useMemo(
    () =>
      colorFromSwatch(
        HAIR_COLOR_OPTIONS[draft.appearance.hair_color]?.swatch,
        "#18181b"
      ),
    [draft.appearance.hair_color]
  );
  const eyeColor = useMemo(
    () =>
      colorFromSwatch(
        EYE_COLOR_OPTIONS[draft.appearance.eye_color]?.swatch,
        "#4f3629"
      ),
    [draft.appearance.eye_color]
  );

  const topColor = TOP_COLORS[draft.starter_style.top] ?? "#426c9e";
  const pantsColor = PANTS_COLORS[draft.starter_style.pants] ?? "#35475f";
  const shoeColor = SHOE_COLORS[draft.starter_style.shoes] ?? "#111827";
  const accessoryColor = ACCESSORY_COLORS[draft.starter_style.accessory] ?? "#b8c0cc";
  const auraColor = AURA_COLORS[draft.starter_style.aura] ?? "#5fd6ff";

  const heightScale = [0.92, 1, 1.08][draft.appearance.height_class] ?? 1;
  const bodyWidth = [0.92, 1, 1.08][draft.appearance.body_type] ?? 1;
  const shoulderWidth = draft.appearance.frame_type === 0 ? 1.08 : 0.98;
  const eyeScaleY = [1, 0.9, 0.72, 0.82, 0.58, 1.12][draft.appearance.eye_style] ?? 1;
  const mouthCurve = [0, 0.08, 0.03, -0.04, 0.02, 0.05][draft.appearance.mouth_style] ?? 0;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const moving = locomotion === "walk";
    const gait = moving ? Math.sin(t * 7) : Math.sin(t * 1.7) * 0.12;
    const upperBodyLift = moving ? 0.03 : 0.015;

    if (rootRef.current) {
      rootRef.current.position.y = MathUtils.damp(
        rootRef.current.position.y,
        Math.sin(t * 2.2 + draft.behavior.idle_style * 0.6) * upperBodyLift,
        8,
        delta
      );
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = MathUtils.damp(
        leftArmRef.current.rotation.x,
        moving ? gait * 0.9 : gait * 0.25 - 0.08,
        8,
        delta
      );
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = MathUtils.damp(
        rightArmRef.current.rotation.x,
        moving ? -gait * 0.9 : -gait * 0.25 + 0.08,
        8,
        delta
      );
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = MathUtils.damp(
        leftLegRef.current.rotation.x,
        moving ? -gait * 0.8 : 0,
        8,
        delta
      );
    }

    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = MathUtils.damp(
        rightLegRef.current.rotation.x,
        moving ? gait * 0.8 : 0,
        8,
        delta
      );
    }

    if (headRef.current) {
      headRef.current.rotation.y = MathUtils.damp(
        headRef.current.rotation.y,
        Math.sin(t * 0.6 + draft.behavior.expression_profile) * 0.08,
        6,
        delta
      );
      headRef.current.rotation.x = MathUtils.damp(
        headRef.current.rotation.x,
        mouthCurve * 0.6,
        6,
        delta
      );
    }

    if (auraRef.current) {
      auraRef.current.rotation.y += delta * 0.8;
      auraRef.current.scale.setScalar(
        1 + Math.sin(t * 2 + draft.behavior.expression_profile) * 0.03
      );
    }
  });

  return (
    <group ref={rootRef} scale={[bodyWidth * shoulderWidth, heightScale, bodyWidth]}>
      <group ref={auraRef} position={[0, 0.4, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
          <ringGeometry args={[0.7, 0.98, 48]} />
          <meshBasicMaterial color={auraColor} transparent opacity={0.28} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27, 0]}>
          <ringGeometry args={[1.1, 1.2, 48]} />
          <meshBasicMaterial color={auraColor} transparent opacity={0.14} />
        </mesh>
      </group>

      <mesh position={[0, 0.64, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.72, 6, 18]} />
        <meshStandardMaterial color={skinColor.clone().lerp(new Color(topColor), 0.42)} />
      </mesh>
      <mesh position={[0, 0.65, 0.22]} castShadow>
        <boxGeometry args={[0.56, 0.8, 0.26]} />
        <meshStandardMaterial color={topColor} roughness={0.88} />
      </mesh>

      <group ref={leftArmRef} position={[-0.48, 0.95, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.08, 0.54, 4, 12]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[0, -0.18, 0.08]} castShadow>
          <boxGeometry args={[0.16, 0.34, 0.2]} />
          <meshStandardMaterial color={topColor} />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.48, 0.95, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.08, 0.54, 4, 12]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[0, -0.18, 0.08]} castShadow>
          <boxGeometry args={[0.16, 0.34, 0.2]} />
          <meshStandardMaterial color={topColor} />
        </mesh>
      </group>

      <group ref={leftLegRef} position={[-0.18, -0.02, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.1, 0.64, 4, 14]} />
          <meshStandardMaterial color={pantsColor} />
        </mesh>
        <mesh position={[0, -0.4, 0.06]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.34]} />
          <meshStandardMaterial color={shoeColor} />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[0.18, -0.02, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.1, 0.64, 4, 14]} />
          <meshStandardMaterial color={pantsColor} />
        </mesh>
        <mesh position={[0, -0.4, 0.06]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.34]} />
          <meshStandardMaterial color={shoeColor} />
        </mesh>
      </group>

      <group ref={headRef} position={[0, 1.42, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.31, 24, 24]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <AvatarHair
          hairType={draft.appearance.hair_type}
          hairColor={hairColor}
        />
        <mesh position={[-0.11, 0.02, 0.27]} scale={[0.09, 0.06 * eyeScaleY, 0.05]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color="#f7fafc" />
        </mesh>
        <mesh position={[0.11, 0.02, 0.27]} scale={[0.09, 0.06 * eyeScaleY, 0.05]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color="#f7fafc" />
        </mesh>
        <mesh position={[-0.11, 0.02, 0.31]} scale={[0.04, 0.04, 0.03]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        <mesh position={[0.11, 0.02, 0.31]} scale={[0.04, 0.04, 0.03]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={eyeColor} />
        </mesh>
        <mesh position={[0, -0.14 + mouthCurve, 0.31]}>
          <boxGeometry args={[0.12, 0.025, 0.02]} />
          <meshStandardMaterial color="#7f3422" />
        </mesh>
        {draft.appearance.facial_hair > 0 ? (
          <mesh position={[0, -0.22, 0.25]}>
            <boxGeometry args={[0.16 + draft.appearance.facial_hair * 0.03, 0.1, 0.08]} />
            <meshStandardMaterial color={hairColor} />
          </mesh>
        ) : null}
      </group>

      <AvatarAccessory
        accessory={draft.starter_style.accessory}
        color={accessoryColor}
      />
    </group>
  );
}

function collectBone(group: Group, matcher: string[]): RigBone | null {
  const bones: Bone[] = [];

  group.traverse((object) => {
    if ((object as Bone).isBone) {
      bones.push(object as Bone);
    }
  });

  const bone = bones.find((candidate) => {
    const name = candidate.name.toLowerCase();
    return matcher.every((fragment) => name.includes(fragment));
  });

  if (!bone) return null;

  return {
    bone,
    restX: bone.rotation.x,
    restY: bone.rotation.y,
    restZ: bone.rotation.z,
  };
}

function AssetBackpack({
  accessory,
  color,
}: {
  accessory: string;
  color: string;
}) {
  if (accessory !== "crossbody-tech") return null;

  return (
    <group position={[0.35, 1.08, -0.18]}>
      <mesh castShadow>
        <boxGeometry args={[0.24, 0.34, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.18, 0.1, 0.12]} rotation={[0.3, 0, -0.7]}>
        <boxGeometry args={[0.6, 0.04, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function TexturedAvatarFigure({ draft, locomotion = "idle" }: AvatarFigureProps) {
  const assetKey = draft.appearance.frame_type === 0 ? "masculine" : "feminine";
  const asset = MODEL_LIBRARY[assetKey];
  const texturePaths = useMemo(() => {
    const root = asset.root;
    const entries = Object.values(asset.materials).flatMap((bundle) => [
      `${root}/${bundle.base}`,
      `${root}/${bundle.normal}`,
      `${root}/${bundle.rough}`,
      `${root}/${bundle.metal}`,
    ]);
    return entries;
  }, [asset]);
  const fbx = useFBX(asset.model);
  const textures = useTexture(texturePaths);
  const wrapperRef = useRef<Group>(null);
  const auraRef = useRef<Group>(null);
  const normalizedModel = useMemo(() => {
    const cloned = clone(fbx) as Group;
    const box = new Box3().setFromObject(cloned);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = size.y > 0 ? 2.1 / size.y : 1;

    cloned.scale.setScalar(scale);
    cloned.position.set(-center.x * scale, -box.min.y * scale - 0.95, -center.z * scale);
    return cloned;
  }, [fbx]);
  const leftArm = useMemo(
    () => collectBone(normalizedModel, ["left", "arm"]),
    [normalizedModel]
  );
  const rightArm = useMemo(
    () => collectBone(normalizedModel, ["right", "arm"]),
    [normalizedModel]
  );
  const leftForeArm = useMemo(
    () => collectBone(normalizedModel, ["left", "forearm"]),
    [normalizedModel]
  );
  const rightForeArm = useMemo(
    () => collectBone(normalizedModel, ["right", "forearm"]),
    [normalizedModel]
  );
  const leftUpLeg = useMemo(
    () => collectBone(normalizedModel, ["left", "upleg"]),
    [normalizedModel]
  );
  const rightUpLeg = useMemo(
    () => collectBone(normalizedModel, ["right", "upleg"]),
    [normalizedModel]
  );
  const leftLeg = useMemo(
    () => collectBone(normalizedModel, ["left", "leg"]),
    [normalizedModel]
  );
  const rightLeg = useMemo(
    () => collectBone(normalizedModel, ["right", "leg"]),
    [normalizedModel]
  );
  const spine = useMemo(
    () => collectBone(normalizedModel, ["spine"]),
    [normalizedModel]
  );
  const head = useMemo(
    () => collectBone(normalizedModel, ["head"]),
    [normalizedModel]
  );

  const skinColor = useMemo(
    () =>
      colorFromSwatch(
        SKIN_TONE_OPTIONS[draft.appearance.skin_tone]?.swatch,
        "#d1a27d"
      ),
    [draft.appearance.skin_tone]
  );
  const topColor = TOP_COLORS[draft.starter_style.top] ?? "#426c9e";
  const pantsColor = PANTS_COLORS[draft.starter_style.pants] ?? "#35475f";
  const accessoryColor = ACCESSORY_COLORS[draft.starter_style.accessory] ?? "#b8c0cc";
  const auraColor = AURA_COLORS[draft.starter_style.aura] ?? "#5fd6ff";

  useEffect(() => {
    const materialBundles = Object.keys(asset.materials).reduce<Record<string, {
      base: typeof textures[number];
      normal: typeof textures[number];
      rough: typeof textures[number];
      metal: typeof textures[number];
    }>>((accumulator, key, index) => {
      const start = index * 4;
      const bundle = {
        base: textures[start],
        normal: textures[start + 1],
        rough: textures[start + 2],
        metal: textures[start + 3],
      };

      bundle.base.colorSpace = SRGBColorSpace;
      accumulator[key] = bundle;
      return accumulator;
    }, {});

    normalizedModel.traverse((object) => {
      if (!(object as Mesh).isMesh) return;
      const mesh = object as Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const materialList = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materialList.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return;
        const materialName = material.name.toLowerCase();
        const bundle =
          materialName.includes("armor")
            ? materialBundles.armor
            : materialName.includes("cloth")
              ? materialBundles.cloth
              : materialName.includes("organik") || materialName.includes("organic")
                ? materialBundles.organic
                : materialName.includes("other")
                  ? materialBundles.other
                  : null;

        if (!bundle) return;

        material.map = bundle.base;
        material.normalMap = bundle.normal;
        material.roughnessMap = bundle.rough;
        material.metalnessMap = bundle.metal;

        if (materialName.includes("organik") || materialName.includes("organic")) {
          material.color.copy(skinColor);
        } else if (materialName.includes("cloth")) {
          material.color.set(topColor);
        } else {
          material.color.set(pantsColor);
        }

        material.roughness = 1;
        material.metalness = 0.12;
        material.needsUpdate = true;
      });
    });
  }, [asset, normalizedModel, pantsColor, skinColor, textures, topColor]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const moving = locomotion === "walk";
    const sway = moving ? Math.sin(t * 7) * 0.45 : Math.sin(t * 1.8) * 0.08;

    if (wrapperRef.current) {
      wrapperRef.current.position.y = MathUtils.damp(
        wrapperRef.current.position.y,
        moving ? Math.sin(t * 6) * 0.04 : Math.sin(t * 2) * 0.02,
        8,
        delta
      );
    }

    if (leftArm) {
      leftArm.bone.rotation.x = MathUtils.damp(
        leftArm.bone.rotation.x,
        leftArm.restX + sway,
        10,
        delta
      );
    }

    if (rightArm) {
      rightArm.bone.rotation.x = MathUtils.damp(
        rightArm.bone.rotation.x,
        rightArm.restX - sway,
        10,
        delta
      );
    }

    if (leftForeArm) {
      leftForeArm.bone.rotation.z = MathUtils.damp(
        leftForeArm.bone.rotation.z,
        leftForeArm.restZ - 0.08,
        10,
        delta
      );
    }

    if (rightForeArm) {
      rightForeArm.bone.rotation.z = MathUtils.damp(
        rightForeArm.bone.rotation.z,
        rightForeArm.restZ + 0.08,
        10,
        delta
      );
    }

    if (leftUpLeg) {
      leftUpLeg.bone.rotation.x = MathUtils.damp(
        leftUpLeg.bone.rotation.x,
        leftUpLeg.restX - sway * 0.9,
        10,
        delta
      );
    }

    if (rightUpLeg) {
      rightUpLeg.bone.rotation.x = MathUtils.damp(
        rightUpLeg.bone.rotation.x,
        rightUpLeg.restX + sway * 0.9,
        10,
        delta
      );
    }

    if (leftLeg) {
      leftLeg.bone.rotation.x = MathUtils.damp(
        leftLeg.bone.rotation.x,
        leftLeg.restX + Math.max(0, sway) * 0.4,
        10,
        delta
      );
    }

    if (rightLeg) {
      rightLeg.bone.rotation.x = MathUtils.damp(
        rightLeg.bone.rotation.x,
        rightLeg.restX + Math.max(0, -sway) * 0.4,
        10,
        delta
      );
    }

    if (spine) {
      spine.bone.rotation.y = MathUtils.damp(
        spine.bone.rotation.y,
        spine.restY + Math.sin(t * 0.8) * 0.08,
        8,
        delta
      );
    }

    if (head) {
      head.bone.rotation.y = MathUtils.damp(
        head.bone.rotation.y,
        head.restY + Math.sin(t * 0.7 + draft.behavior.expression_profile) * 0.12,
        8,
        delta
      );
    }

    if (auraRef.current) {
      auraRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group ref={wrapperRef}>
      <primitive object={normalizedModel} />
      <group ref={auraRef} position={[0, 0.02, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[1.0, 1.44, 64]} />
          <meshBasicMaterial color={auraColor} transparent opacity={0.18} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <ringGeometry args={[1.7, 1.94, 64]} />
          <meshBasicMaterial color={auraColor} transparent opacity={0.1} />
        </mesh>
      </group>
      <AssetBackpack accessory={draft.starter_style.accessory} color={accessoryColor} />
    </group>
  );
}

export function AvatarFigure({ draft, locomotion = "idle" }: AvatarFigureProps) {
  return (
    <Suspense fallback={<ProceduralAvatarFigure draft={draft} locomotion={locomotion} />}>
      <TexturedAvatarFigure draft={draft} locomotion={locomotion} />
    </Suspense>
  );
}

export function AvatarRenderer({
  draft,
  focus,
  zoom,
  locomotion = "idle",
  className = "",
}: {
  draft: AvatarDraft;
  focus: CameraFocus;
  zoom: number;
  locomotion?: "idle" | "walk";
  className?: string;
}) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.4, 4.2], fov: 34 }}
      >
        <color attach="background" args={["#07111b"]} />
        <fog attach="fog" args={["#07111b", 8, 18]} />
        <ambientLight intensity={1.1} />
        <hemisphereLight intensity={0.8} color="#d7efff" groundColor="#07111b" />
        <directionalLight
          castShadow
          position={[4, 7, 5]}
          intensity={2.4}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Environment preset="city" />
        <PreviewCameraRig focus={focus} zoom={zoom} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.98, 0]} receiveShadow>
          <circleGeometry args={[3.8, 64]} />
          <meshStandardMaterial color="#0b1726" roughness={0.95} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.97, 0]}>
          <ringGeometry args={[1.2, 2.2, 64]} />
          <meshBasicMaterial color="#5fd6ff" transparent opacity={0.14} />
        </mesh>
        <PresentationControls
          global
          rotation={[0, 0.25, 0]}
          polar={[-0.15, 0.2]}
          azimuth={[-0.8, 0.8]}
          config={{ mass: 1.2, tension: 180 }}
        >
          <group position={[0, -0.05, 0]}>
            <AvatarFigure draft={draft} locomotion={locomotion} />
          </group>
        </PresentationControls>
        <ContactShadows
          position={[0, -0.98, 0]}
          opacity={0.34}
          scale={4.6}
          blur={2.2}
          far={5}
        />
      </Canvas>
    </div>
  );
}

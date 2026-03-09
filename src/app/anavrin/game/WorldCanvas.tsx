import { Environment, Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef } from "react";

import { ANAVRIN_CONFIG } from "../config/anavrinConfig";
import type { AvatarDraft, WorldSpawn } from "../types";
import { CameraController } from "./CameraController";
import { PlayerController, type PlayerMotionState } from "./PlayerController";

function CityBlockout() {
  const buildings = useMemo(
    () =>
      [
        [-18, 2.6, 24, 8, 5.2, 10, "#17293a"],
        [18, 2.8, 24, 8, 5.6, 10, "#233a54"],
        [-26, 3.6, 2, 10, 7.2, 9, "#15202d"],
        [26, 3.4, -2, 10, 6.8, 9, "#223247"],
        [-16, 4.4, -24, 8, 8.8, 9, "#1a2430"],
        [16, 4.1, -24, 8, 8.2, 9, "#24384b"],
        [-34, 2.2, 14, 7, 4.4, 7, "#0f1a25"],
        [34, 2.2, -14, 7, 4.4, 7, "#1f3142"],
      ] as const,
    []
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#0f1a24" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[18, 140]} />
        <meshStandardMaterial color="#24262b" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]} receiveShadow>
        <planeGeometry args={[140, 18]} />
        <meshStandardMaterial color="#24262b" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[8, 140]} />
        <meshStandardMaterial color="#51616f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]} receiveShadow>
        <planeGeometry args={[140, 8]} />
        <meshStandardMaterial color="#51616f" />
      </mesh>

      {Array.from({ length: 12 }).map((_, index) => (
        <mesh
          key={`lane-x-${index}`}
          position={[0, 0.035, -54 + index * 9]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.5, 3.5]} />
          <meshBasicMaterial color="#f0d37a" />
        </mesh>
      ))}

      {Array.from({ length: 12 }).map((_, index) => (
        <mesh
          key={`lane-z-${index}`}
          position={[-54 + index * 9, 0.035, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[0.5, 3.5]} />
          <meshBasicMaterial color="#f0d37a" />
        </mesh>
      ))}

      {buildings.map(([x, y, z, width, height, depth, color]) => (
        <group key={`${x}-${z}`}>
          <mesh position={[x, y, z]} castShadow receiveShadow>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
          <mesh position={[x, height + 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width * 0.75, depth * 0.75]} />
            <meshBasicMaterial color="#60b8ff" transparent opacity={0.08} />
          </mesh>
        </group>
      ))}

      {[
        [-6, 1.2, 6],
        [6, 1.2, 6],
        [-6, 1.2, -6],
        [6, 1.2, -6],
      ].map(([x, y, z], index) => (
        <group key={`light-${index}`} position={[x, 0, z]}>
          <mesh position={[0, y * 0.5, 0]}>
            <cylinderGeometry args={[0.06, 0.06, y, 10]} />
            <meshStandardMaterial color="#d3dae5" />
          </mesh>
          <mesh position={[0, y, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial
              color="#ffecb3"
              emissive="#ffecb3"
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SpawnBeacon({ spawn }: { spawn: WorldSpawn }) {
  return (
    <group position={[spawn.position[0], 0.08, spawn.position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.8, 64]} />
        <meshBasicMaterial color="#5fd6ff" transparent opacity={0.24} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.0, 2.4, 64]} />
        <meshBasicMaterial color="#ffb54d" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export function WorldCanvas({
  draft,
  spawn,
  className = "",
}: {
  draft: AvatarDraft;
  spawn: WorldSpawn;
  className?: string;
}) {
  const playerStateRef = useRef<PlayerMotionState>({
    position: [...spawn.position],
    heading: spawn.heading,
    moving: false,
  });

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 5, 12], fov: 52 }}
      >
        <color attach="background" args={["#8cb8db"]} />
        <fog attach="fog" args={["#8cb8db", 38, 120]} />
        <ambientLight intensity={0.85} />
        <directionalLight
          castShadow
          position={[18, 24, 14]}
          intensity={1.8}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Sky
          distance={450000}
          sunPosition={[12, 9, 4]}
          inclination={0.52}
          azimuth={0.18}
        />
        <Environment preset="city" />
        <CityBlockout />
        <SpawnBeacon spawn={spawn} />
        <PlayerController
          draft={draft}
          spawn={spawn}
          bounds={ANAVRIN_CONFIG.world.bounds}
          playerStateRef={playerStateRef}
        />
        <CameraController playerStateRef={playerStateRef} zoom={1} />
      </Canvas>
    </div>
  );
}

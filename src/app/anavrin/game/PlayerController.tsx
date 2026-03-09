import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Group, MathUtils, Vector3 } from "three";

import type { AvatarDraft, WorldSpawn } from "../types";
import { AvatarFigure } from "./AvatarRenderer";

export type PlayerMotionState = {
  position: [number, number, number];
  heading: number;
  moving: boolean;
};

function useMovementKeys() {
  const keysRef = useRef({
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code in keysRef.current) {
        keysRef.current[event.code as keyof typeof keysRef.current] = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code in keysRef.current) {
        keysRef.current[event.code as keyof typeof keysRef.current] = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return keysRef;
}

export function PlayerController({
  draft,
  spawn,
  bounds,
  playerStateRef,
}: {
  draft: AvatarDraft;
  spawn: WorldSpawn;
  bounds: number;
  playerStateRef: MutableRefObject<PlayerMotionState>;
}) {
  const groupRef = useRef<Group>(null);
  const movementKeys = useMovementKeys();
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const velocity = useRef(new Vector3());

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(...spawn.position);
    groupRef.current.rotation.y = spawn.heading;
    playerStateRef.current = {
      position: [...spawn.position],
      heading: spawn.heading,
      moving: false,
    };
  }, [playerStateRef, spawn]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const keys = movementKeys.current;
    const inputX =
      (keys.KeyD || keys.ArrowRight ? 1 : 0) -
      (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const inputZ =
      (keys.KeyS || keys.ArrowDown ? 1 : 0) -
      (keys.KeyW || keys.ArrowUp ? 1 : 0);

    const movingNow = inputX !== 0 || inputZ !== 0;
    const direction = new Vector3(inputX, 0, inputZ);
    if (movingNow) {
      direction.normalize();
      velocity.current.lerp(direction.multiplyScalar(4.6), 0.18);
      const heading = Math.atan2(velocity.current.x, velocity.current.z);
      groupRef.current.rotation.y = MathUtils.damp(
        groupRef.current.rotation.y,
        heading,
        10,
        delta
      );
    } else {
      velocity.current.lerp(new Vector3(0, 0, 0), 0.12);
    }

    groupRef.current.position.x = MathUtils.clamp(
      groupRef.current.position.x + velocity.current.x * delta,
      -bounds,
      bounds
    );
    groupRef.current.position.z = MathUtils.clamp(
      groupRef.current.position.z + velocity.current.z * delta,
      -bounds,
      bounds
    );

    if (movingRef.current !== movingNow) {
      movingRef.current = movingNow;
      setMoving(movingNow);
    }

    playerStateRef.current = {
      position: [
        groupRef.current.position.x,
        groupRef.current.position.y,
        groupRef.current.position.z,
      ],
      heading: groupRef.current.rotation.y,
      moving: movingNow,
    };
  });

  return (
    <group ref={groupRef}>
      <AvatarFigure draft={draft} locomotion={moving ? "walk" : "idle"} />
    </group>
  );
}

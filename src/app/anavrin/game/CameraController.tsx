import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import { MathUtils, Vector3 } from "three";

import type { PlayerMotionState } from "./PlayerController";

export function CameraController({
  playerStateRef,
  zoom = 1,
}: {
  playerStateRef: MutableRefObject<PlayerMotionState>;
  zoom?: number;
}) {
  const desiredPosition = new Vector3();
  const lookTarget = new Vector3();

  useFrame(({ camera }, delta) => {
    const player = playerStateRef.current;
    const [x, y, z] = player.position;
    const distance = 6.8 / zoom;
    const lift = 3.4;

    desiredPosition.set(
      x - Math.sin(player.heading) * distance,
      y + lift,
      z - Math.cos(player.heading) * distance
    );
    lookTarget.set(x, y + 1.25, z);

    camera.position.x = MathUtils.damp(camera.position.x, desiredPosition.x, 5, delta);
    camera.position.y = MathUtils.damp(camera.position.y, desiredPosition.y, 5, delta);
    camera.position.z = MathUtils.damp(camera.position.z, desiredPosition.z, 5, delta);
    camera.lookAt(lookTarget);
  });

  return null;
}

"use client"

import { useRef } from "react"
import type * as THREE from "three"

interface SceneLightingProps {
  intensity: number
  ambientIntensity: number
  position: [number, number, number]
  color: string
  ambientColor: string
}

export default function SceneLighting({
  intensity = 0.5,
  ambientIntensity = 0.3,
  position = [5, 5, 5],
  color = "#ffffff",
  ambientColor = "#404060",
}: SceneLightingProps) {
  const lightRef = useRef<THREE.DirectionalLight>(null)

  // Optional: animate the light position
  // useFrame(({ clock }) => {
  //   if (lightRef.current) {
  //     const t = clock.getElapsedTime() * 0.2
  //     lightRef.current.position.x = Math.sin(t) * 8
  //     lightRef.current.position.z = Math.cos(t) * 8
  //   }
  // })

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={position}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize={[1024, 1024]}
      >
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10, 0.1, 50]} />
      </directionalLight>

      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {/* Add a secondary fill light from the opposite direction */}
      <directionalLight
        position={[-position[0], -position[1], -position[2]]}
        intensity={intensity * 0.4}
        color={color}
      />
    </>
  )
}


"use client"

import { useEffect, useRef, useMemo } from "react"
import { useThree } from "@react-three/fiber"
import { MaterialCreator, MTLLoader, OBJLoader } from "three-stdlib"
import * as THREE from "three"

interface MeshModelProps {
  objUrl: string
  mtlUrl?: string
  textureUrl?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  doubleSided?: boolean
}

export default function MeshModel({
  objUrl,
  mtlUrl,
  textureUrl,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  doubleSided = true,
}: MeshModelProps) {
  const { scene } = useThree()
  const modelRef = useRef<THREE.Group | null>(null)
  const resourcesToCleanup = useRef<Array<{ dispose: () => void }>>([])

  const quaternion = useMemo(() =>
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2])
    ),
    [rotation]
  )

  useEffect(() => {
    scene.setRotationFromQuaternion(quaternion)
  }, [scene, quaternion])

  const applyDoubleSided = (material: THREE.Material) => {
    if (doubleSided) {
      material.side = THREE.DoubleSide
      material.needsUpdate = true
    }
    return material
  }

  const applyTexture = (obj: THREE.Group, texture?: THREE.Texture) => {
    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return

      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (texture) mat.map = texture
          applyDoubleSided(mat)
        })
      } else {
        if (texture) child.material.map = texture
        applyDoubleSided(child.material)
      }
    })
  }

  const loadTexture = (url: string): Promise<THREE.Texture> => {
    const textureLoader = new THREE.TextureLoader()
    return new Promise((resolve, reject) => {
      textureLoader.load(
        url,
        (texture) => {
          resourcesToCleanup.current.push(texture);
          resolve(texture);
        },
        undefined,
        reject
      )
    })
  }

  useEffect(() => {
    if (!objUrl) return

    const cleanup = () => {
      if (modelRef.current) {
        scene.remove(modelRef.current)
        modelRef.current.traverse(child => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }

            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        modelRef.current = null
      }
      resourcesToCleanup.current.forEach(resource => resource.dispose());
      resourcesToCleanup.current = [];
    }

    cleanup()

    const loadModel = async () => {
      try {
        const objLoader = new OBJLoader()
        let texture: THREE.Texture | undefined;

        if (mtlUrl) {
          const mtlLoader = new MTLLoader()
          const mtl = await new Promise<MaterialCreator>((resolve, reject) => {
            mtlLoader.load(mtlUrl, resolve, undefined, reject)
          })
          mtl.preload()
          objLoader.setMaterials(mtl)

          Object.values(mtl.materials).forEach(material => {
            resourcesToCleanup.current.push(material);
          });
        }

        if (textureUrl) {
          texture = await loadTexture(textureUrl);
        }

        const obj = await new Promise<THREE.Group>((resolve, reject) => {
          objLoader.load(objUrl, resolve, undefined, reject)
        })

        if (texture) {
          applyTexture(obj, texture);
        } else if (doubleSided) {
          applyTexture(obj);
        }

        obj.position.set(position[0], position[1], position[2])
        scene.add(obj)
        modelRef.current = obj
      } catch (error) {
        console.error("Error loading model:", error)
      }
    }

    loadModel()

    return cleanup
  }, [objUrl, mtlUrl, textureUrl, position, scene, doubleSided])

  return null
}
"use client"

import { useEffect, useRef } from "react"
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
  doubleSided = false,
}: MeshModelProps) {
  const { scene } = useThree()
  const modelRef = useRef<THREE.Group | null>(null)
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation[0], rotation[1], rotation[2])
  )
  scene.setRotationFromQuaternion(quaternion)

  useEffect(() => {
    if (!objUrl) return

    // Remove previous model if it exists
    if (modelRef.current) {
      scene.remove(modelRef.current)
      modelRef.current = null
    }

    const loadModel = async () => {
      try {
        if (mtlUrl) {
          const mtlLoader = new MTLLoader()
          const mtl = await new Promise<MaterialCreator>((resolve, reject) => {
            mtlLoader.load(mtlUrl, resolve, undefined, reject)
          })

          mtl.preload()

          const objLoader = new OBJLoader()
          objLoader.setMaterials(mtl)

          const obj = await new Promise<THREE.Group>((resolve, reject) => {
            objLoader.load(objUrl, resolve, undefined, reject)
          })

          // Apply texture if provided
          if (textureUrl) {
            const textureLoader = new THREE.TextureLoader()
            const texture = await new Promise<THREE.Texture>((resolve, reject) => {
              textureLoader.load(textureUrl, resolve, undefined, reject)
            })

            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => {
                      mat.map = texture
                      // Make double-sided if requested
                      if (doubleSided) {
                        mat.side = THREE.DoubleSide
                      }
                      mat.needsUpdate = true
                    })
                  } else {
                    child.material.map = texture
                    // Make double-sided if requested
                    if (doubleSided) {
                      child.material.side = THREE.DoubleSide
                    }
                    child.material.needsUpdate = true
                  }
                }
              }
            })
          } else {
            // Apply double-sided setting without texture
            if (doubleSided) {
              obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((mat) => {
                        mat.side = THREE.DoubleSide
                        mat.needsUpdate = true
                      })
                    } else {
                      child.material.side = THREE.DoubleSide
                      child.material.needsUpdate = true
                    }
                  }
                }
              })
            }
          }

          // Add to scene
          obj.position.set(position[0], position[1], position[2])
          scene.add(obj)
          modelRef.current = obj

          // Center the model
          const box = new THREE.Box3().setFromObject(obj)
          const center = box.getCenter(new THREE.Vector3())
          obj.position.sub(center).add(new THREE.Vector3(position[0], position[1], position[2]))

          // Scale the model to fit in view
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          if (maxDim > 2) {
            const scale = 2 / maxDim
            obj.scale.set(scale, scale, scale)
          }
        } else {
          // Load OBJ without materials
          const objLoader = new OBJLoader()
          const obj = await new Promise<THREE.Group>((resolve, reject) => {
            objLoader.load(objUrl, resolve, undefined, reject)
          })

          // Apply default material or texture if provided
          if (textureUrl) {
            const textureLoader = new THREE.TextureLoader()
            const texture = await new Promise<THREE.Texture>((resolve, reject) => {
              textureLoader.load(textureUrl, resolve, undefined, reject)
            })

            const material = new THREE.MeshStandardMaterial({
              map: texture,
              side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            })

            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = material
              }
            })
          } else {
            // Apply default material
            const material = new THREE.MeshStandardMaterial({
              color: 0xcccccc,
              side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            })

            obj.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = material
              }
            })
          }

          // Add to scene
          obj.position.set(position[0], position[1], position[2])
          scene.add(obj)
          modelRef.current = obj

          // Center the model
          const box = new THREE.Box3().setFromObject(obj)
          const center = box.getCenter(new THREE.Vector3())
          obj.position.sub(center).add(new THREE.Vector3(position[0], position[1], position[2]))

          // Scale the model to fit in view
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          if (maxDim > 2) {
            const scale = 2 / maxDim
            obj.scale.set(scale, scale, scale)
          }
        }
      } catch (error) {
        console.error("Error loading model:", error)
      }
    }

    loadModel()

    return () => {
      if (modelRef.current) {
        scene.remove(modelRef.current)
        modelRef.current = null
      }
    }
  }, [objUrl, mtlUrl, textureUrl, position, scene, doubleSided])

  return null
}


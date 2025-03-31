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
  doubleSided = true,
}: MeshModelProps) {
  const { scene } = useThree()
  const modelRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    if (!objUrl) return


    const cleanupModel = () => {
      if (modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose()
            }
    
            if (child.material) {
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material]
    
              materials.forEach(material => {
                if (material.map) material.map.dispose()
                if (material.normalMap) material.normalMap.dispose()
                if (material.bumpMap) material.bumpMap.dispose()
                if (material.specularMap) material.specularMap.dispose()
                if (material.envMap) material.envMap.dispose()      
                material.dispose()
              })
            }
          }
        })
    
        scene.remove(modelRef.current)
        modelRef.current = null
      }
    }

    cleanupModel()

    const loadModel = async () => {
      try {
        const objLoader = new OBJLoader()

        if (mtlUrl) {
          const mtlLoader = new MTLLoader()
          const materials = await new Promise<MaterialCreator>((resolve, reject) =>
            mtlLoader.load(mtlUrl, resolve, undefined, reject)
          )

          materials.preload()
          objLoader.setMaterials(materials)
        }

        const obj = await new Promise<THREE.Group>((resolve, reject) =>
          objLoader.load(objUrl, resolve, undefined, reject)
        )

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader()
          const texture = await new Promise<THREE.Texture>((resolve, reject) =>
            textureLoader.load(textureUrl, resolve, undefined, reject)
          )

          if (!mtlUrl) {
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            })

            obj.traverse(child => {
              if (child instanceof THREE.Mesh) {
                child.material = material
              }
            })
          } else {
            obj.traverse(child => {
              if (child instanceof THREE.Mesh) {
                if (child.material) {
                  const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material]

                  materials.forEach(mat => {
                    mat.map = texture
                    if (doubleSided) mat.side = THREE.DoubleSide
                    mat.needsUpdate = true
                  })
                }
              }
            })
          }
        } else if (!mtlUrl) {
          const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
          })

          obj.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.material = material
            }
          })
        } else if (doubleSided) {
          obj.traverse(child => {
            if (child instanceof THREE.Mesh && child.material) {
              const materials = Array.isArray(child.material)
                ? child.material
                : [child.material]

              materials.forEach(mat => {
                mat.side = THREE.DoubleSide
                mat.needsUpdate = true
              })
            }
          })
        }

        obj.position.set(...position)
        obj.rotation.set(...rotation)

        scene.add(obj)
        modelRef.current = obj

      } catch (error) {
        console.error("Error loading model:", error)
      }
    }

    loadModel()

    return cleanupModel
  }, [objUrl, mtlUrl, textureUrl, position, rotation, scene, doubleSided])

  return null
}
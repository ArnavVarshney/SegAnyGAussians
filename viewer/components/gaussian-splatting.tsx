"use client"

import { useEffect, useRef } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"

interface GaussianSplattingProps {
  url: string
  pointSize: number
}

export default function GaussianSplatting({ url, pointSize }: GaussianSplattingProps) {
  const { scene } = useThree()
  const pointsRef = useRef<THREE.Points | null>(null)

  useEffect(() => {
    if (!url) return

    const loader = new PLYLoader()
    loader.load(url, (geometry) => {
      // Dispose of previous points if they exist
      if (pointsRef.current) {
        scene.remove(pointsRef.current)
        pointsRef.current.geometry.dispose()
        if (pointsRef.current.material instanceof THREE.Material) {
          pointsRef.current.material.dispose()
        } else if (Array.isArray(pointsRef.current.material)) {
          pointsRef.current.material.forEach((m) => m.dispose())
        }
      }

      // Create material for points - using PointsMaterial instead of ShaderMaterial
      // to avoid shader compilation issues
      const material = new THREE.PointsMaterial({
        size: pointSize,
        vertexColors: true,
        sizeAttenuation: true,
        alphaTest: 0.5,
        transparent: true,
        // This makes the points more visible from all angles
        depthWrite: false,
      })

      // Create points
      const points = new THREE.Points(geometry, material)
      scene.add(points)
      pointsRef.current = points

      // Center the model
      const box = new THREE.Box3().setFromObject(points)
      const center = box.getCenter(new THREE.Vector3())
      points.position.sub(center)

      // Scale the model to fit in view
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 2) {
        const scale = 2 / maxDim
        points.scale.set(scale, scale, scale)
      }
    })

    return () => {
      if (pointsRef.current) {
        scene.remove(pointsRef.current)
        pointsRef.current.geometry.dispose()
        if (pointsRef.current.material instanceof THREE.Material) {
          pointsRef.current.material.dispose()
        } else if (Array.isArray(pointsRef.current.material)) {
          pointsRef.current.material.forEach((m) => m.dispose())
        }
        pointsRef.current = null
      }
    }
  }, [url, scene])

  // Update point size when it changes
  useEffect(() => {
    if (pointsRef.current && pointsRef.current.material instanceof THREE.PointsMaterial) {
      pointsRef.current.material.size = pointSize
    }
  }, [pointSize])

  return null
}

// PLY Loader implementation
class PLYLoader {
  load(url: string, onLoad: (geometry: THREE.BufferGeometry) => void) {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.responseType = "arraybuffer"

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        const geometry = this.parse(xhr.response)
        onLoad(geometry)
      }
    }

    xhr.send(null)
  }

  parse(data: ArrayBuffer): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()

    const textDecoder = new TextDecoder()
    const dataView = new DataView(data)

    // Check if binary or ASCII PLY
    const header = textDecoder.decode(new Uint8Array(data, 0, 100))
    const isBinary = header.indexOf("format binary") !== -1

    if (isBinary) {
      return this.parseBinary(dataView, geometry)
    } else {
      return this.parseASCII(textDecoder.decode(data), geometry)
    }
  }

  parseBinary(dataView: DataView, geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // Find the end of the header
    let headerLength = 0
    const bytes = new Uint8Array(dataView.buffer)

    for (let i = 0; i < bytes.length - 4; i++) {
      if (
        bytes[i] === 10 && // \n
        bytes[i + 1] === 101 && // e
        bytes[i + 2] === 110 && // n
        bytes[i + 3] === 100 && // d
        bytes[i + 4] === 95 && // _
        bytes[i + 5] === 104 && // h
        bytes[i + 6] === 101 && // e
        bytes[i + 7] === 97 && // a
        bytes[i + 8] === 100 && // d
        bytes[i + 9] === 101 && // e
        bytes[i + 10] === 114 // r
      ) {
        // Find the next newline
        for (let j = i + 11; j < bytes.length; j++) {
          if (bytes[j] === 10) {
            // \n
            headerLength = j + 1
            break
          }
        }
        break
      }
    }

    if (headerLength === 0) {
      console.error("PLYLoader: Could not find end of header")
      return geometry
    }

    // Parse header to get vertex count and properties
    const header = new TextDecoder().decode(new Uint8Array(dataView.buffer, 0, headerLength))
    const headerLines = header.split("\n")

    let vertexCount = 0
    const properties: string[] = []

    for (const line of headerLines) {
      if (line.startsWith("element vertex")) {
        vertexCount = Number.parseInt(line.split(" ")[2])
      } else if (line.startsWith("property")) {
        properties.push(line.split(" ")[2])
      }
    }

    if (vertexCount === 0) {
      console.error("PLYLoader: No vertices found")
      return geometry
    }

    // Create arrays for vertex data
    const positions: number[] = []
    const colors: number[] = []

    let offset = headerLength

    // Read vertex data
    for (let i = 0; i < vertexCount; i++) {
      // Read position (x, y, z)
      positions.push(dataView.getFloat32(offset, true))
      offset += 4
      positions.push(dataView.getFloat32(offset, true))
      offset += 4
      positions.push(dataView.getFloat32(offset, true))
      offset += 4

      // Read color (r, g, b)
      if (properties.includes("red") && properties.includes("green") && properties.includes("blue")) {
        colors.push(dataView.getUint8(offset) / 255)
        offset += 1
        colors.push(dataView.getUint8(offset) / 255)
        offset += 1
        colors.push(dataView.getUint8(offset) / 255)
        offset += 1
      }

      // Skip other properties
      for (let j = 6; j < properties.length; j++) {
        offset += 4 // Assuming float32 for other properties
      }
    }

    // Set geometry attributes
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    if (colors.length > 0) {
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    }

    return geometry
  }

  parseASCII(data: string, geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const lines = data.split("\n")
    let vertexCount = 0
    let vertexStartIndex = 0
    const hasColors = false

    // Parse header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith("element vertex")) {
        vertexCount = Number.parseInt(line.split(" ")[2])
      } else if (line === "end_header") {
        vertexStartIndex = i + 1
        break
      } else if (
        line.includes("property") &&
        (line.includes("red") || line.includes("r") || line.includes("diffuse_red"))
      ) {
        // hasColors = true
      }
    }

    if (vertexCount === 0) {
      console.error("PLYLoader: No vertices found")
      return geometry
    }

    // Parse vertices
    const positions: number[] = []
    const colors: number[] = []

    for (let i = 0; i < vertexCount; i++) {
      const vertex = lines[vertexStartIndex + i].trim().split(/\s+/)

      // Position
      positions.push(Number.parseFloat(vertex[0]))
      positions.push(Number.parseFloat(vertex[1]))
      positions.push(Number.parseFloat(vertex[2]))

      // Color (if available)
      if (vertex.length >= 6) {
        colors.push(Number.parseInt(vertex[3]) / 255)
        colors.push(Number.parseInt(vertex[4]) / 255)
        colors.push(Number.parseInt(vertex[5]) / 255)
      }
    }

    // Set geometry attributes
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    if (colors.length > 0) {
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    }

    return geometry
  }
}


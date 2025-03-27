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

    // Parse header to get vertex count and property information
    const header = new TextDecoder().decode(new Uint8Array(dataView.buffer, 0, headerLength))
    const headerLines = header.split("\n")

    let vertexCount = 0
    const properties: Array<{ name: string, type: string }> = []
    let format = "binary_little_endian"

    for (const line of headerLines) {
      if (line.startsWith("element vertex")) {
        vertexCount = Number.parseInt(line.split(" ")[2])
      } else if (line.startsWith("property")) {
        const parts = line.split(" ")
        properties.push({
          type: parts[1],
          name: parts[2]
        })
      } else if (line.startsWith("format")) {
        format = line.split(" ")[1]
      }
    }

    if (vertexCount === 0) {
      console.error("PLYLoader: No vertices found")
      return geometry
    }

    // Prepare arrays for vertex data
    const positions: number[] = []
    const colors: number[] = []
    const opacities: number[] = []
    const scales: number[] = []
    const rotations: number[] = []

    // For SH coefficients
    const hasFeaturesDC = properties.some(p => p.name.startsWith("f_dc_"))
    const hasShFeatures = properties.some(p => p.name.startsWith("f_rest_"))

    const littleEndian = format !== "binary_big_endian"
    let offset = headerLength

    // Helper to read data based on type
    const readData = (type: string): number => {
      let value: number

      switch (type) {
        case "float":
        case "float32":
          value = dataView.getFloat32(offset, littleEndian)
          offset += 4
          break
        case "double":
        case "float64":
          value = dataView.getFloat64(offset, littleEndian)
          offset += 8
          break
        case "int":
        case "int32":
          value = dataView.getInt32(offset, littleEndian)
          offset += 4
          break
        case "uint":
        case "uint32":
          value = dataView.getUint32(offset, littleEndian)
          offset += 4
          break
        case "short":
        case "int16":
          value = dataView.getInt16(offset, littleEndian)
          offset += 2
          break
        case "ushort":
        case "uint16":
          value = dataView.getUint16(offset, littleEndian)
          offset += 2
          break
        case "uchar":
        case "uint8":
          value = dataView.getUint8(offset)
          offset += 1
          break
        case "char":
        case "int8":
          value = dataView.getInt8(offset)
          offset += 1
          break
        default:
          console.warn(`PLYLoader: Unsupported data type: ${type}`)
          value = 0
          offset += 4 // Assume float32
      }

      return value
    }

    // Read vertex data
    for (let i = 0; i < vertexCount; i++) {
      const vertex: Record<string, number> = {}

      // Read all properties for this vertex
      for (const prop of properties) {
        vertex[prop.name] = readData(prop.type)
      }

      // Position (required)
      positions.push(vertex["x"] || 0)
      positions.push(vertex["y"] || 0)
      positions.push(vertex["z"] || 0)

      // Color - try different possible naming conventions
      if (hasFeaturesDC) {
        // Using SH coefficients for color (Gaussian Splatting)
        const r = vertex["f_dc_0"] || 0
        const g = vertex["f_dc_1"] || 0
        const b = vertex["f_dc_2"] || 0

        // Convert to RGB (0-1)
        colors.push(r + 0.5)
        colors.push(g + 0.5)
        colors.push(b + 0.5)
      } else if (vertex["red"] !== undefined) {
        // Standard color format
        const r = vertex["red"] / 255
        const g = vertex["green"] / 255
        const b = vertex["blue"] / 255
        colors.push(r, g, b)
      } else if (vertex["r"] !== undefined) {
        // Alternative color naming
        const r = vertex["r"] / 255
        const g = vertex["g"] / 255
        const b = vertex["b"] / 255
        colors.push(r, g, b)
      }

      // Opacity (for Gaussian splatting)
      if (vertex["opacity"] !== undefined) {
        opacities.push(vertex["opacity"])
      }

      // Scale (for Gaussian splatting)
      if (vertex["scale_0"] !== undefined) {
        scales.push(vertex["scale_0"], vertex["scale_1"] || 0, vertex["scale_2"] || 0)
      }

      // Rotation (for Gaussian splatting)
      if (vertex["rot_0"] !== undefined) {
        rotations.push(
          vertex["rot_0"] || 0,
          vertex["rot_1"] || 0,
          vertex["rot_2"] || 0,
          vertex["rot_3"] || 0
        )
      }
    }

    // Set geometry attributes
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    if (colors.length > 0) {
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    }

    // Add custom attributes for Gaussian Splatting if present
    if (opacities.length > 0) {
      geometry.setAttribute("opacity", new THREE.Float32BufferAttribute(opacities, 1))
    }

    if (scales.length > 0) {
      geometry.setAttribute("scale", new THREE.Float32BufferAttribute(scales, 3))
    }

    if (rotations.length > 0) {
      geometry.setAttribute("rotation", new THREE.Float32BufferAttribute(rotations, 4))
    }

    return geometry
  }

  parseASCII(data: string, geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const lines = data.split("\n")
    let vertexCount = 0
    let vertexStartIndex = 0
    const properties: Array<{ name: string, type: string }> = []

    // Parse header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith("element vertex")) {
        vertexCount = Number.parseInt(line.split(" ")[2])
      } else if (line.startsWith("property")) {
        const parts = line.split(" ")
        properties.push({
          type: parts[1],
          name: parts[2]
        })
      } else if (line === "end_header") {
        vertexStartIndex = i + 1
        break
      }
    }

    if (vertexCount === 0) {
      console.error("PLYLoader: No vertices found")
      return geometry
    }

    // Check if this is a Gaussian Splatting file
    const hasFeaturesDC = properties.some(p => p.name.startsWith("f_dc_"))
    const hasShFeatures = properties.some(p => p.name.startsWith("f_rest_"))

    // Prepare arrays for vertex data
    const positions: number[] = []
    const colors: number[] = []
    const opacities: number[] = []
    const scales: number[] = []
    const rotations: number[] = []

    // Parse vertices
    for (let i = 0; i < vertexCount; i++) {
      const line = lines[vertexStartIndex + i].trim()
      if (!line) continue

      const values = line.split(/\s+/)
      const vertex: Record<string, number> = {}

      // Map values to properties
      for (let j = 0; j < properties.length; j++) {
        if (j < values.length) {
          vertex[properties[j].name] = Number.parseFloat(values[j])
        }
      }

      // Position (required)
      positions.push(vertex["x"] || 0)
      positions.push(vertex["y"] || 0)
      positions.push(vertex["z"] || 0)

      // Color handling
      if (hasFeaturesDC) {
        // Using SH coefficients for color (Gaussian Splatting)
        const r = vertex["f_dc_0"] || 0
        const g = vertex["f_dc_1"] || 0
        const b = vertex["f_dc_2"] || 0

        // Convert to RGB (0-1)
        colors.push(r + 0.5)
        colors.push(g + 0.5)
        colors.push(b + 0.5)
      } else if (vertex["red"] !== undefined) {
        // Standard color format
        const r = vertex["red"] / 255
        const g = vertex["green"] / 255
        const b = vertex["blue"] / 255
        colors.push(r, g, b)
      } else if (vertex["r"] !== undefined) {
        // Alternative color naming
        const r = vertex["r"] / 255
        const g = vertex["g"] / 255
        const b = vertex["b"] / 255
        colors.push(r, g, b)
      }

      // Opacity (for Gaussian splatting)
      if (vertex["opacity"] !== undefined) {
        opacities.push(vertex["opacity"])
      }

      // Scale (for Gaussian splatting)
      if (vertex["scale_0"] !== undefined) {
        scales.push(vertex["scale_0"], vertex["scale_1"] || 0, vertex["scale_2"] || 0)
      }

      // Rotation (for Gaussian splatting)
      if (vertex["rot_0"] !== undefined) {
        rotations.push(
          vertex["rot_0"] || 0,
          vertex["rot_1"] || 0,
          vertex["rot_2"] || 0,
          vertex["rot_3"] || 0
        )
      }
    }

    // Set geometry attributes
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

    if (colors.length > 0) {
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    }

    // Add custom attributes for Gaussian Splatting if present
    if (opacities.length > 0) {
      geometry.setAttribute("opacity", new THREE.Float32BufferAttribute(opacities, 1))
    }

    if (scales.length > 0) {
      geometry.setAttribute("scale", new THREE.Float32BufferAttribute(scales, 3))
    }

    if (rotations.length > 0) {
      geometry.setAttribute("rotation", new THREE.Float32BufferAttribute(rotations, 4))
    }

    return geometry
  }
}


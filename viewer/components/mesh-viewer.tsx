"use client"

import { useState, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Stats } from "@react-three/drei"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react"
import FileUploader from "./file-uploader"
import MeshModel from "./mesh-model"
import SceneLighting from "./scene-lighting"
import FolderSelector from "./folder-selector"
import { Checkbox } from "@/components/ui/checkbox"

export default function MeshViewer() {
  const [files, setFiles] = useState({
    obj: null as File | null,
    mtl: null as File | null,
    texture: null as File | null,
  })

  const [urls, setUrls] = useState({
    obj: "",
    mtl: "",
    texture: "",
  })

  const [folderData, setFolderData] = useState<{
    refinedMesh: Record<string, { obj: string; mtl: string; png: string }>;
  } | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [useFolder, setUseFolder] = useState(false)

  const [showStats, setShowStats] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [rotation, setRotation] = useState([0, 0, 0] as [number, number, number])
  // Lighting controls
  const [lighting, setLighting] = useState({
    intensity: 0.5,
    ambientIntensity: 0.3,
    lightPosition: [5, 5, 5] as [number, number, number],
    lightColor: "#ffffff",
    ambientColor: "#404060",
  })

  // Create object URLs when files are uploaded
  useEffect(() => {
    if (files.obj) setUrls((prev) => ({ ...prev, obj: URL.createObjectURL(files.obj!) }))
    if (files.mtl) setUrls((prev) => ({ ...prev, mtl: URL.createObjectURL(files.mtl!) }))
    if (files.texture) setUrls((prev) => ({ ...prev, texture: URL.createObjectURL(files.texture!) }))

    // Clean up URLs on unmount
    return () => {
      if (urls.obj) URL.revokeObjectURL(urls.obj)
      if (urls.mtl) URL.revokeObjectURL(urls.mtl)
      if (urls.texture) URL.revokeObjectURL(urls.texture)
    }
  }, [files])

  // Apply dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  const handleFileUpload = (type: keyof typeof files, file: File) => {
    setFiles((prev) => ({ ...prev, [type]: file }))
    setUseFolder(false)
  }

  const handleFolderSelected = (data: {
    refinedMesh: Record<string, { obj: string; mtl: string; png: string }>;
  }) => {
    setFolderData(data);
    const modelNames = Object.keys(data.refinedMesh);
    if (modelNames.length > 0) {
      setSelectedModels([modelNames[0]]);
      setUseFolder(true);
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const updateLighting = (key: keyof typeof lighting, value: any) => {
    setLighting((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={`w-full h-screen flex flex-col ${isDarkMode ? "dark" : ""}`}>
      <div className="flex flex-1 relative">
        {/* Collapsible Sidebar */}
        <div
          className={`h-full bg-background border-r transition-all duration-300 flex flex-col ${sidebarOpen ? "w-80" : "w-0 overflow-hidden"
            }`}
        >
          <div className="p-4 border-b overflow-y-auto h-full">
            <h1 className="text-xl font-bold mb-4">3D Mesh Viewer</h1>

            <div className="space-y-4 mb-4">
              <div>
                <h2 className="text-md font-semibold mb-2">Folder Selection</h2>
                <FolderSelector onFolderSelected={handleFolderSelected} />
                {folderData && Object.keys(folderData.refinedMesh).length > 0 && (
                  <div className="mt-4">
                    <Label className="mb-2 block">
                      Select Models:
                    </Label>
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                      {Object.keys(folderData.refinedMesh)
                        .sort()
                        .map((modelName) => (
                          <div key={modelName} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={`model-${modelName}`}
                              checked={selectedModels.includes(modelName)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedModels(prev => [...prev, modelName]);
                                } else {
                                  setSelectedModels(prev => prev.filter(m => m !== modelName));
                                }
                                setUseFolder(true);
                              }}
                            />
                            <Label htmlFor={`model-${modelName}`} className="cursor-pointer">
                              {modelName}
                            </Label>
                          </div>
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedModels([])}
                      >
                        Clear All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedModels(Object.keys(folderData.refinedMesh))}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {!useFolder &&
                <div>
                  <div>
                    <h2 className="text-md font-semibold mb-2">Mesh Model</h2>
                    <div className="grid grid-cols-1 gap-2">
                      <FileUploader
                        accept=".obj"
                        label="Upload OBJ file"
                        onFileSelected={(file) => handleFileUpload("obj", file)}
                        fileName={files.obj?.name}
                      />
                      <FileUploader
                        accept=".mtl"
                        label="Upload MTL file"
                        onFileSelected={(file) => handleFileUpload("mtl", file)}
                        fileName={files.mtl?.name}
                      />
                      <FileUploader
                        accept=".png,.jpg,.jpeg"
                        label="Upload texture"
                        onFileSelected={(file) => handleFileUpload("texture", file)}
                        fileName={files.texture?.name}
                      />
                    </div>
                  </div>
                </div>
              }
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-md font-semibold mb-2">Lighting</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="light-intensity" className="w-24">
                      Light:
                    </Label>
                    <Slider
                      id="light-intensity"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[lighting.intensity]}
                      onValueChange={(value) => updateLighting("intensity", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{lighting.intensity.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="ambient-intensity" className="w-24">
                      Ambient:
                    </Label>
                    <Slider
                      id="ambient-intensity"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[lighting.ambientIntensity]}
                      onValueChange={(value) => updateLighting("ambientIntensity", value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{lighting.ambientIntensity.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="light-color" className="w-24">
                      Light Color:
                    </Label>
                    <input
                      type="color"
                      id="light-color"
                      value={lighting.lightColor}
                      onChange={(e) => updateLighting("lightColor", e.target.value)}
                      className="w-8 h-8 rounded-md border"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="ambient-color" className="w-24">
                      Ambient Color:
                    </Label>
                    <input
                      type="color"
                      id="ambient-color"
                      value={lighting.ambientColor}
                      onChange={(e) => updateLighting("ambientColor", e.target.value)}
                      className="w-8 h-8 rounded-md border"
                    />
                  </div>
                </div>

                <h2 className="text-md font-semibold mb-2 mt-4">Rotation</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="rotation-x" className="w-24">
                      X-axis:
                    </Label>
                    <Slider
                      id="rotation-x"
                      min={0}
                      max={Math.PI * 2}
                      step={0.01}
                      value={[rotation[0]]}
                      onValueChange={(value) => setRotation([value[0], rotation[1], rotation[2]])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{rotation[0].toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="rotation-y" className="w-24">
                      Y-axis:
                    </Label>
                    <Slider
                      id="rotation-y"
                      min={0}
                      max={Math.PI * 2}
                      step={0.01}
                      value={[rotation[1]]}
                      onValueChange={(value) => setRotation([rotation[0], value[0], rotation[2]])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{rotation[1].toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="rotation-z" className="w-24">
                      Z-axis:
                    </Label>
                    <Slider
                      id="rotation-z"
                      min={0}
                      max={Math.PI * 2}
                      step={0.01}
                      value={[rotation[2]]}
                      onValueChange={(value) => setRotation([rotation[0], rotation[1], value[0]])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{rotation[2].toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="show-stats" checked={showStats} onCheckedChange={setShowStats} />
                <Label htmlFor="show-stats">Show Stats</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative">
          {/* Sidebar Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-sm"
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </Button>

          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun /> : <Moon />}
          </Button>

          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            className="w-full h-full"
            style={{ background: isDarkMode ? "#111" : "#f5f5f5" }}
          >
            {showStats && <Stats />}

            <SceneLighting
              intensity={lighting.intensity}
              ambientIntensity={lighting.ambientIntensity}
              position={lighting.lightPosition}
              color={lighting.lightColor}
              ambientColor={lighting.ambientColor}
            />

            {useFolder && folderData &&
              selectedModels.map((modelName) => (
                folderData.refinedMesh[modelName] && (
                  <MeshModel
                    key={`mesh-${modelName}`}
                    objUrl={folderData.refinedMesh[modelName].obj}
                    mtlUrl={folderData.refinedMesh[modelName].mtl}
                    textureUrl={folderData.refinedMesh[modelName].png}
                  />
                )
              ))
            }

            {!useFolder && urls.obj && (
              <MeshModel
                objUrl={urls.obj}
                mtlUrl={urls.mtl}
                textureUrl={urls.texture}
                position={[0, 0, 0]}
                rotation={rotation}
                doubleSided={true}
              />
            )}

            <OrbitControls />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
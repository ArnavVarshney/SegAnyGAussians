"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from 'next/dynamic'
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
import ModelList from "./model-list"

const LazyCanvas = dynamic(
  () => import('@react-three/fiber').then(mod => mod.Canvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-lg">Loading 3D viewer...</div>
      </div>
    )
  }
)

type LightingSettings = {
  intensity: number;
  ambientIntensity: number;
  lightPosition: [number, number, number];
  lightColor: string;
  ambientColor: string;
};

type MeshFiles = {
  obj: File | null;
  mtl: File | null;
  texture: File | null;
};

type FileUrls = {
  obj: string;
  mtl: string;
  texture: string;
};

type MeshData = {
  obj: string;
  mtl: string;
  png: string;
};

type FolderData = {
  refinedMesh: Record<string, MeshData>;
};

export default function MeshViewer() {
  const [files, setFiles] = useState<MeshFiles>({
    obj: null,
    mtl: null,
    texture: null,
  })

  const [urls, setUrls] = useState<FileUrls>({
    obj: "",
    mtl: "",
    texture: "",
  })

  const [folderData, setFolderData] = useState<FolderData | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [useFolder, setUseFolder] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0])\
  const [lighting, setLighting] = useState<LightingSettings>({
    intensity: 1.0,
    ambientIntensity: 0.0,
    lightPosition: [5, 5, 5],
    lightColor: "#ffffff",
    ambientColor: "#404060",
  })

  useEffect(() => {
    if (urls.obj) URL.revokeObjectURL(urls.obj);
    if (urls.mtl) URL.revokeObjectURL(urls.mtl);
    if (urls.texture) URL.revokeObjectURL(urls.texture);

    const newUrls = { obj: "", mtl: "", texture: "" };
    if (files.obj) newUrls.obj = URL.createObjectURL(files.obj);
    if (files.mtl) newUrls.mtl = URL.createObjectURL(files.mtl);
    if (files.texture) newUrls.texture = URL.createObjectURL(files.texture);

    setUrls(newUrls);

    return () => {
      if (newUrls.obj) URL.revokeObjectURL(newUrls.obj);
      if (newUrls.mtl) URL.revokeObjectURL(newUrls.mtl);
      if (newUrls.texture) URL.revokeObjectURL(newUrls.texture);
    };
  }, [files]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  const handleFileUpload = useCallback((type: keyof typeof files, file: File) => {
    setFiles((prev) => ({ ...prev, [type]: file }))
    setUseFolder(false)
  }, []);

  const handleFolderSelected = useCallback((data: FolderData) => {
    setFolderData(data);
    const modelNames = Object.keys(data.refinedMesh);
    if (modelNames.length > 0) {
      setSelectedModels([modelNames[0]]);
      setUseFolder(true);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, []);

  const updateLighting = useCallback((key: keyof LightingSettings, value: any) => {
    setLighting(prev => ({ ...prev, [key]: value }))
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, []);

  const handleRotationChange = useCallback((axis: number, value: number) => {
    setRotation(prev => {
      const newRotation = [...prev] as [number, number, number];
      newRotation[axis] = value;
      return newRotation;
    });
  }, []);

  const handleSelectedModelsChange = useCallback((models: string[]) => {
    setSelectedModels(models);
    setUseFolder(true);
  }, []);

  const sortedModelNames = useMemo(() => {
    return folderData ? Object.keys(folderData.refinedMesh).sort() : [];
  }, [folderData]);

  return (
    <div className={`w-full h-screen flex flex-col ${isDarkMode ? "dark" : ""}`}>
      <div className="flex flex-1 relative">
        {/* Collapsible Sidebar */}
        <div
          className={`h-full bg-background border-r transition-all duration-300 flex flex-col ${sidebarOpen ? "w-80" : "w-0 overflow-hidden"}`}
        >
          <div className="p-4 border-b overflow-y-auto h-full">
            <h1 className="text-xl font-bold mb-4">3D Mesh Viewer</h1>

            <div className="space-y-4 mb-4">
              <div>
                <h2 className="text-md font-semibold mb-2">Folder Selection</h2>
                <FolderSelector onFolderSelected={handleFolderSelected} />

                {folderData && sortedModelNames.length > 0 && (
                  <ModelList
                    modelNames={sortedModelNames}
                    selectedModels={selectedModels}
                    onSelectionChange={handleSelectedModelsChange}
                  />
                )}
              </div>

              {!useFolder && (
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
              )}
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
                      onValueChange={(value) => handleRotationChange(0, value[0])}
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
                      onValueChange={(value) => handleRotationChange(1, value[0])}
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
                      onValueChange={(value) => handleRotationChange(2, value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{rotation[2].toFixed(2)}</span>
                  </div>
                </div>
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
            onClick={toggleTheme}
          >
            {isDarkMode ? <Sun /> : <Moon />}
          </Button>

          <LazyCanvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            className="w-full h-full"
            style={{ background: isDarkMode ? "#111" : "#f5f5f5" }}
          >
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
          </LazyCanvas>
        </div>
      </div>
    </div>
  )
}
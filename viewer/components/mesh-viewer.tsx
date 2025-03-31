"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import dynamic from 'next/dynamic'
import { OrbitControls } from "@react-three/drei"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Sun, Moon, Ruler } from "lucide-react"
import MeshModel from "./mesh-model"
import SceneLighting from "./scene-lighting"
import Sidebar from "./sidebar"
import * as THREE from "three"

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

function AxesHelper({ size = 1, visible = true }) {
  const mesh = useRef<THREE.AxesHelper>(null);

  return (
    <axesHelper
      ref={mesh}
      args={[size]}
      visible={visible}
    />
  );
}

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
  const [showAxes, setShowAxes] = useState(false)

  const [lighting, setLighting] = useState<LightingSettings>({
    intensity: 1.0,
    ambientIntensity: 0.0,
    lightPosition: [-5, -5, -5],
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

  const toggleAxes = useCallback(() => {
    setShowAxes(prev => !prev)
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
          <Sidebar
            folderData={folderData}
            useFolder={useFolder}
            files={files}
            lighting={lighting}
            selectedModels={selectedModels}
            sortedModelNames={sortedModelNames}
            onFolderSelected={handleFolderSelected}
            handleFileUpload={handleFileUpload}
            handleSelectedModelsChange={handleSelectedModelsChange}
            updateLighting={updateLighting}
          />
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

          {/* Axes Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-16 z-10 bg-background/80 backdrop-blur-sm"
            onClick={toggleAxes}
            title="Toggle axes"
          >
            <Ruler className={showAxes ? "text-primary" : "text-muted-foreground"} />
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
                doubleSided={true}
              />
            )}

            <AxesHelper
              size={1000}
              visible={showAxes}
            />

            <OrbitControls />
          </LazyCanvas>
        </div>
      </div>
    </div>
  )
}
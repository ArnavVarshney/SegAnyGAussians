"use client"

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react"
import dynamic from 'next/dynamic'
import { OrbitControls } from "@react-three/drei"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Ruler } from "lucide-react"
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

type AxesHelperProps = {
  size?: number;
  visible?: boolean;
};

const AxesHelper = memo(({ size = 1, visible = true }: AxesHelperProps) => {
  const mesh = useRef<THREE.AxesHelper>(null);

  return (
    <axesHelper
      ref={mesh}
      args={[size]}
      visible={visible}
    />
  );
});

type GridHelperProps = {
  size?: number;
  divisions?: number;
  visible?: boolean;
};

const GridHelper = memo(({ size = 10, divisions = 10, visible = true }: GridHelperProps) => {
  const mesh = useRef<THREE.GridHelper>(null);

  return (
    <gridHelper
      ref={mesh}
      args={[size, divisions]}
      visible={visible}
      position={[0, -0.01, 0]}
    />
  );
});

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
  const [fileState, setFileState] = useState({
    files: {
      obj: null as File | null,
      mtl: null as File | null,
      texture: null as File | null,
    },
    urls: {
      obj: "",
      mtl: "",
      texture: "",
    }
  });

  const [folderData, setFolderData] = useState<FolderData | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [useFolder, setUseFolder] = useState(false)

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
    if (fileState.urls.obj) URL.revokeObjectURL(fileState.urls.obj);
    if (fileState.urls.mtl) URL.revokeObjectURL(fileState.urls.mtl);
    if (fileState.urls.texture) URL.revokeObjectURL(fileState.urls.texture);

    const newUrls = {
      obj: "",
      mtl: "",
      texture: ""
    };

    if (fileState.files.obj) newUrls.obj = URL.createObjectURL(fileState.files.obj);
    if (fileState.files.mtl) newUrls.mtl = URL.createObjectURL(fileState.files.mtl);
    if (fileState.files.texture) newUrls.texture = URL.createObjectURL(fileState.files.texture);

    setFileState(prev => ({
      ...prev,
      urls: newUrls
    }));

    return () => {
      if (newUrls.obj) URL.revokeObjectURL(newUrls.obj);
      if (newUrls.mtl) URL.revokeObjectURL(newUrls.mtl);
      if (newUrls.texture) URL.revokeObjectURL(newUrls.texture);
    };
  }, [fileState.files]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  const handleFileUpload = useCallback((type: string, file: File | null) => {
    setFileState(prev => ({
      ...prev,
      files: {
        ...prev.files,
        [type]: file
      }
    }));
    setUseFolder(false);
  }, []);

  const handleFolderSelected = useCallback((data: FolderData) => {
    setFolderData(data);
    const modelNames = Object.keys(data.refinedMesh);
    if (modelNames.length > 0) {
      setSelectedModels([modelNames[0]]);
      setUseFolder(true);
    }
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
        {/* Static Sidebar */}
        <div className="h-full w-80 bg-background border-r flex flex-col">
          <Sidebar
            folderData={folderData}
            useFolder={useFolder}
            files={fileState.files}
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
            camera={{
              position: [0, 0, 5],
              fov: 90
            }}
            className="w-full h-full"
            style={{
              background: isDarkMode ? "#111" : "#f5f5f5"
            }}
            frameloop="demand"
            gl={{
              powerPreference: "high-performance",
              antialias: true,
              // alpha: false,
              // stencil: false,
              // depth: true,
            }}
            // dpr={[1, 2]}
            // performance={{ min: 0.5 }}
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

            {!useFolder && fileState.urls.obj && (
              <MeshModel
                objUrl={fileState.urls.obj}
                mtlUrl={fileState.urls.mtl}
                textureUrl={fileState.urls.texture}
                position={[0, 0, 0]}
                doubleSided={true}
              />
            )}

            <AxesHelper
              size={1000}
              visible={showAxes}
            />

            <GridHelper
              size={1000}
              divisions={1000}
              visible={showAxes}
            />

            <OrbitControls />
          </LazyCanvas>
        </div>
      </div>
    </div>
  )
}
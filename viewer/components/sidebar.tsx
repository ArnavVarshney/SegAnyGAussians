import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import FileUploader from "./file-uploader"
import FolderSelector from "./folder-selector"
import ModelList from "./model-list"

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

type MeshData = {
  obj: string;
  mtl: string;
  png: string;
};

type FolderData = {
  refinedMesh: Record<string, MeshData>;
};

interface SidebarProps {
  folderData: FolderData | null;
  useFolder: boolean;
  files: MeshFiles;
  lighting: LightingSettings;
  selectedModels: string[];
  sortedModelNames: string[];
  onFolderSelected: (data: FolderData) => void;
  handleFileUpload: (type: keyof MeshFiles, file: File) => void;
  handleSelectedModelsChange: (models: string[]) => void;
  updateLighting: (key: keyof LightingSettings, value: any) => void;
}

export default function Sidebar({
  folderData,
  useFolder,
  files,
  lighting,
  selectedModels,
  sortedModelNames,
  onFolderSelected,
  handleFileUpload,
  handleSelectedModelsChange,
  updateLighting,
}: SidebarProps) {
  return (
    <div className="p-4 border-b overflow-y-auto h-full">
      <h1 className="text-xl font-bold mb-4">3D Mesh Viewer</h1>
      <div className="space-y-4 mb-4">
        <div>
          <h2 className="text-md font-semibold mb-2">Folder Selection</h2>
          <FolderSelector onFolderSelected={onFolderSelected} />

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
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Folder } from "lucide-react";

interface FolderSelectorProps {
  onFolderSelected: (folderStructure: {
    refinedMesh: Record<string, { obj: string; mtl: string; png: string }>;
    refinedPly: Record<string, string>;
  }) => void;
}

export default function FolderSelector({ onFolderSelected }: FolderSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFolderSelect = async () => {
    try {
      setIsLoading(true);
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true; // Non-standard but widely supported

      input.oncancel = () => {
        setIsLoading(false);
      };

      input.onchange = (e) => {
        const files = Array.from(input.files || []);
        const refinedMesh: Record<string, { obj: string; mtl: string; png: string }> = {};
        const refinedPly: Record<string, string> = {};

        files.forEach((file) => {
          const path = file.webkitRelativePath || "";
          const pathParts = path.split("/");

          const mainFolder = pathParts[1];
          const objectType = pathParts[2];
          const fileName = pathParts[3];

          if (mainFolder === "refined_mesh") {
            if (!refinedMesh[objectType]) {
              refinedMesh[objectType] = { obj: "", mtl: "", png: "" };
            }

            const extension = file.name.split(".").pop()?.toLowerCase();
            if (extension === "obj") {
              refinedMesh[objectType].obj = URL.createObjectURL(file);
            } else if (extension === "mtl") {
              refinedMesh[objectType].mtl = URL.createObjectURL(file);
            } else if (extension === "png") {
              refinedMesh[objectType].png = URL.createObjectURL(file);
            }
          } else if (mainFolder === "refined_ply" && fileName.endsWith(".ply")) {
            refinedPly[objectType] = URL.createObjectURL(file);
          }
        });

        if (Object.keys(refinedMesh).length === 0 || Object.keys(refinedPly).length === 0) {
          setIsLoading(false);
          alert("Please select a folder with refined mesh and ply files.");
          return;
        }

        onFolderSelected({ refinedMesh, refinedPly });
        setIsLoading(false);
      };

      input.click();
    } catch (error) {
      console.error("Error selecting folder:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleFolderSelect}
        disabled={isLoading}
        variant="secondary"
        className="flex-1 flex items-center gap-2"
      >
        <Folder className="h-4 w-4" />
        {isLoading ? "Processing..." : "Select Models Folder"}
      </Button>
    </div>
  );
}
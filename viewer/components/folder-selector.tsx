import { useState } from "react";

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
      
      // Create a file input element programmatically
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true; // Non-standard but widely supported
    //   input.directory = true; // Non-standard
      
      input.onchange = (e) => {
        const files = Array.from(input.files || []);
        const refinedMesh: Record<string, { obj: string; mtl: string; png: string }> = {};
        const refinedPly: Record<string, string> = {};
        
        // Process the files
        files.forEach(file => {
          const path = file.webkitRelativePath || '';
          const pathParts = path.split('/');
          
          if (pathParts.length >= 3) {
            const mainFolder = pathParts[0];
            const objectType = pathParts[1];
            const objectName = pathParts[2];
            
            if (mainFolder === 'refined_mesh') {
              if (!refinedMesh[objectName]) {
                refinedMesh[objectName] = { obj: '', mtl: '', png: '' };
              }
              
              const extension = file.name.split('.').pop()?.toLowerCase();
              if (extension === 'obj') {
                refinedMesh[objectName].obj = URL.createObjectURL(file);
              } else if (extension === 'mtl') {
                refinedMesh[objectName].mtl = URL.createObjectURL(file);
              } else if (extension === 'png') {
                refinedMesh[objectName].png = URL.createObjectURL(file);
              }
            } else if (mainFolder === 'refined_ply' && file.name.endsWith('.ply')) {
              refinedPly[objectName] = URL.createObjectURL(file);
            }
          }
        });
        
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
    <div className="mb-6 w-full max-w-xl">
      <button
        onClick={handleFolderSelect}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        {isLoading ? "Processing..." : "Select Models Folder"}
      </button>
      <p className="mt-2 text-sm text-gray-500">
        Select a folder containing refined_mesh and refined_ply subdirectories
      </p>
    </div>
  );
}
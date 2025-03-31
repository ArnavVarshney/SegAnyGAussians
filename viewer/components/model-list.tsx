import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { memo } from "react"

type ModelListProps = {
  modelNames: string[];
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
};

function ModelList({ modelNames, selectedModels, onSelectionChange }: ModelListProps) {
  return (
    <div className="mt-4">
      <Label className="mb-2 block">
        Select Models:
      </Label>
      <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
        {modelNames.map((modelName) => (
          <div key={modelName} className="flex items-center space-x-2 py-1">
            <Checkbox
              id={`model-${modelName}`}
              checked={selectedModels.includes(modelName)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectionChange([...selectedModels, modelName]);
                } else {
                  onSelectionChange(selectedModels.filter(m => m !== modelName));
                }
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
          onClick={() => onSelectionChange([])}
        >
          Clear All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectionChange(modelNames)}
        >
          Select All
        </Button>
      </div>
    </div>
  );
}

export default memo(ModelList);
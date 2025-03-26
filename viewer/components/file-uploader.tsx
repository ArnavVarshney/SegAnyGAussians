"use client"

import type React from "react"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface FileUploaderProps {
  accept: string
  label: string
  onFileSelected: (file: File) => void
  fileName?: string
}

export default function FileUploader({ accept, label, onFileSelected, fileName }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelected(files[0])
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleClick} variant="secondary" className="flex-1 flex items-center gap-2">
        <Upload className="h-4 w-4" />
        {label}
      </Button>
      {fileName && <span className="text-sm text-muted-foreground truncate max-w-[200px]">{fileName}</span>}
      <input type="file" ref={inputRef} onChange={handleFileChange} accept={accept} className="hidden" />
    </div>
  )
}


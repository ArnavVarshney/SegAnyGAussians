import GaussianSplattingViewer from "@/components/gaussian-splatting-viewer"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <GaussianSplattingViewer />
    </main>
  )
}


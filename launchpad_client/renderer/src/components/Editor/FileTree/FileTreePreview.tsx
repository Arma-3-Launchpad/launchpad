import { useCallback, useEffect, useRef, useState } from 'react'

export type PreviewData = {
  type: 'image' | 'text' | 'config' | 'none'
  content?: string
  imageData?: { width: number; height: number; data: Uint8Array }
  lineCount?: number
  classCount?: number
}

export type FileTreePreviewProps = {
  rel: string | null
  anchorRect: DOMRect | null
  previewData: PreviewData | null
  loading?: boolean
}

export function FileTreePreview({
  rel,
  anchorRect,
  previewData,
  loading,
}: FileTreePreviewProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let x = anchorRect.right + 8
    let y = anchorRect.top

    if (x + rect.width > viewportW - 8) {
      x = anchorRect.left - rect.width - 8
    }
    if (y + rect.height > viewportH - 8) {
      y = viewportH - rect.height - 8
    }

    setPosition({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [anchorRect])

  useEffect(() => {
    if (!previewData?.imageData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height, data } = previewData.imageData
    canvas.width = width
    canvas.height = height

    const imageData = ctx.createImageData(width, height)
    imageData.data.set(data)
    ctx.putImageData(imageData, 0, 0)
  }, [previewData?.imageData])

  if (!rel || !anchorRect) return null

  return (
    <div
      ref={tooltipRef}
      className="file-tree-preview"
      style={{ left: position.x, top: position.y }}
    >
      {loading ? (
        <div className="file-tree-preview-loading">Loading...</div>
      ) : previewData?.type === 'image' && previewData.imageData ? (
        <div className="file-tree-preview-image">
          <canvas
            ref={canvasRef}
            className="file-tree-preview-canvas"
            style={{
              maxWidth: 160,
              maxHeight: 120,
              width: 'auto',
              height: 'auto',
            }}
          />
          <div className="file-tree-preview-meta">
            {previewData.imageData.width} × {previewData.imageData.height}
          </div>
        </div>
      ) : previewData?.type === 'text' && previewData.content ? (
        <div className="file-tree-preview-text">
          <pre className="file-tree-preview-code">{previewData.content}</pre>
          {previewData.lineCount != null && (
            <div className="file-tree-preview-meta">{previewData.lineCount} lines</div>
          )}
        </div>
      ) : previewData?.type === 'config' ? (
        <div className="file-tree-preview-config">
          <div className="file-tree-preview-meta">
            {previewData.classCount != null
              ? `${previewData.classCount} classes`
              : 'Config file'}
          </div>
          {previewData.content && (
            <pre className="file-tree-preview-code">{previewData.content}</pre>
          )}
        </div>
      ) : (
        <div className="file-tree-preview-none">No preview available</div>
      )}
    </div>
  )
}

export type UseFileTreePreviewProps = {
  getPreviewData: (rel: string) => Promise<PreviewData>
  enabled?: boolean
  delay?: number
}

export type UseFileTreePreviewResult = {
  previewRel: string | null
  previewData: PreviewData | null
  previewLoading: boolean
  previewAnchorRect: DOMRect | null
  onMouseEnter: (rel: string, element: HTMLElement) => void
  onMouseLeave: () => void
}

export function useFileTreePreview({
  getPreviewData,
  enabled = true,
  delay = 500,
}: UseFileTreePreviewProps): UseFileTreePreviewResult {
  const [previewRel, setPreviewRel] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewAnchorRect, setPreviewAnchorRect] = useState<DOMRect | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRelRef = useRef<string | null>(null)

  const onMouseEnter = useCallback(
    (rel: string, element: HTMLElement) => {
      if (!enabled) return

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      currentRelRef.current = rel

      timeoutRef.current = setTimeout(() => {
        if (currentRelRef.current !== rel) return

        setPreviewRel(rel)
        setPreviewAnchorRect(element.getBoundingClientRect())
        setPreviewLoading(true)

        void getPreviewData(rel).then((data) => {
          if (currentRelRef.current === rel) {
            setPreviewData(data)
            setPreviewLoading(false)
          }
        })
      }, delay)
    },
    [enabled, delay, getPreviewData],
  )

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    currentRelRef.current = null
    setPreviewRel(null)
    setPreviewData(null)
    setPreviewLoading(false)
    setPreviewAnchorRect(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    previewRel,
    previewData,
    previewLoading,
    previewAnchorRect,
    onMouseEnter,
    onMouseLeave,
  }
}

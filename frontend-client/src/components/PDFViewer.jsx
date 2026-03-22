import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function PDFViewer({ pdfUrl, findings, activeFinding }) {
  const [numPages, setNumPages] = useState(null)
  const [pageWidth, setPageWidth] = useState(550)
  const containerRef = useRef(null)
  const pageRefs = useRef({})

  useEffect(() => {
    if (containerRef.current) {
      setPageWidth(containerRef.current.offsetWidth - 16)
    }
  }, [])

  useEffect(() => {
    if (!activeFinding?.bboxList?.length) return
    const pageNum = activeFinding.bboxList[0].pageNumber
    const pageEl = pageRefs.current[pageNum]
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeFinding])

  const riskColors = {
    red: 'rgba(239,68,68,0.3)',
    yellow: 'rgba(234,179,8,0.3)',
    green: 'rgba(34,197,94,0.25)',
  }

  const riskBorders = {
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
  }

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        className="flex flex-col items-center gap-2"
      >
        {Array.from({ length: numPages || 0 }, (_, i) => {
          const pageNum = i + 1
          const scale = pageWidth / 595.28

          return (
            <div
              key={pageNum}
              ref={el => pageRefs.current[pageNum] = el}
              className="relative"
              style={{ width: pageWidth }}
            >
              <Page
                pageNumber={pageNum}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />

              {/* Highlight all bbox blocks for active finding */}
              {activeFinding?.bboxList
                ?.filter(b => b.pageNumber === pageNum)
                .map((b, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: b.x * scale,
                      top: b.y * scale,
                      width: b.width * scale,
                      height: (b.height + 4) * scale,
                      backgroundColor: riskColors[activeFinding.riskLevel],
                      border: `2px solid ${riskBorders[activeFinding.riskLevel]}`,
                      borderRadius: 3,
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  />
                ))}
            </div>
          )
        })}
      </Document>
    </div>
  )
}
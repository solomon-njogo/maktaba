"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { isbnFromBarcode } from "@/lib/isbn"

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a"] as const

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorCtor = {
  new (options?: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

type IsbnBarcodeScannerProps = {
  onDetect: (isbn: string) => void
  onCancel: () => void
  onError: (message: string) => void
  onInvalid: () => void
}

export function cameraAvailable() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export function useCameraAvailable() {
  return useSyncExternalStore(
    () => () => {},
    cameraAvailable,
    () => false
  )
}

function barcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null
  const ctor = (
    window as Window & { BarcodeDetector?: BarcodeDetectorCtor }
  ).BarcodeDetector
  return ctor ?? null
}

async function nativeFormats(): Promise<string[]> {
  const ctor = barcodeDetectorCtor()
  if (!ctor) return []
  try {
    const supported = ctor.getSupportedFormats
      ? await ctor.getSupportedFormats()
      : [...NATIVE_FORMATS]
    return NATIVE_FORMATS.filter((format) => supported.includes(format))
  } catch {
    return []
  }
}

export function IsbnBarcodeScanner({
  onDetect,
  onCancel,
  onError,
  onInvalid,
}: IsbnBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectRef = useRef(onDetect)
  const onErrorRef = useRef(onError)
  const onInvalidRef = useRef(onInvalid)

  useEffect(() => {
    onDetectRef.current = onDetect
    onErrorRef.current = onError
    onInvalidRef.current = onInvalid
  }, [onDetect, onError, onInvalid])

  const [status, setStatus] = useState<"starting" | "live" | "error">("starting")

  useEffect(() => {
    const preview = videoRef.current
    if (!preview) return

    let cancelled = false
    let stream: MediaStream | undefined
    let rafId = 0
    let zxingStop: (() => void) | undefined
    let lastInvalidAt = 0
    let lastIsbn = ""
    let lastIsbnAt = 0

    const stopStream = () => {
      stream?.getTracks().forEach((track) => track.stop())
      stream = undefined
      preview.srcObject = null
    }

    const accept = (isbn: string) => {
      if (cancelled) return
      const now = Date.now()
      if (isbn === lastIsbn && now - lastIsbnAt < 1800) return
      lastIsbn = isbn
      lastIsbnAt = now
      onDetectRef.current(isbn)
    }

    const noteInvalid = () => {
      const now = Date.now()
      if (now - lastInvalidAt < 2000) return
      lastInvalidAt = now
      onInvalidRef.current()
    }

    const handleRaw = (text: string) => {
      const isbn = isbnFromBarcode(text)
      if (isbn) {
        accept(isbn)
        return
      }
      noteInvalid()
    }

    const startNative = async (formats: string[]) => {
      const Ctor = barcodeDetectorCtor()
      if (!Ctor) return false
      const detector = new Ctor({ formats })

      const tick = async () => {
        if (cancelled) return
        if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const codes = await detector.detect(preview)
            for (const code of codes) {
              handleRaw(code.rawValue)
            }
          } catch {
            // Frame dropped; keep scanning.
          }
        }
        if (!cancelled) {
          rafId = window.requestAnimationFrame(() => {
            void tick()
          })
        }
      }

      rafId = window.requestAnimationFrame(() => {
        void tick()
      })
      return true
    }

    const startZxing = async () => {
      const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ])
      if (cancelled) return

      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatOneDReader(hints)
      const controls = await reader.decodeFromVideoElement(preview, (result) => {
        if (cancelled || !result) return
        handleRaw(result.getText())
      })
      zxingStop = () => controls.stop()
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
        if (cancelled) {
          stopStream()
          return
        }
        preview.srcObject = stream
        preview.setAttribute("playsinline", "true")
        await preview.play()
        if (cancelled) {
          stopStream()
          return
        }
        setStatus("live")

        const formats = await nativeFormats()
        if (cancelled) return
        if (formats.length > 0) {
          const started = await startNative(formats)
          if (started) return
        }
        await startZxing()
      } catch (error) {
        if (cancelled) return
        setStatus("error")
        const denied =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
        onErrorRef.current(
          denied
            ? "Camera permission was denied. Paste the ISBN instead."
            : "Could not open the camera. Paste the ISBN instead."
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      zxingStop?.()
      stopStream()
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/4] max-h-[50dvh] w-full overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <div
          className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0_/_0.35)]"
          aria-hidden
        />
        {status === "starting" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="flex items-center gap-2 text-sm text-white">
              <Spinner />
              Starting camera…
            </p>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Keep pointing at ISBN barcodes. Tap Done when you are finished.
      </p>
      <Button type="button" variant="outline" onClick={onCancel}>
        Done
      </Button>
    </div>
  )
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  onCapture: (dataUrl: string) => void;
  busy?: boolean;
}

const MAX_EDGE = 1600;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

// Vista de cámara real para el comprobante. Si el dispositivo/navegador no
// concede permisos, queda disponible la entrada de archivo con `capture`
// (`environment`) como respaldo.
export function ReceiptCamera({ onCapture, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const openingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => setError("No se pudo iniciar la vista de cámara."));
  }, [active]);

  const startCamera = async () => {
    setError("");
    if (active || openingRef.current || streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("La cámara no está disponible en este dispositivo. Usa Subir archivo.");
      return;
    }
    openingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      // Si el componente se desmontó mientras el navegador pedía el permiso,
      // hay que liberar el stream aquí o la cámara queda encendida para siempre.
      if (!mountedRef.current || streamRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("No se pudo abrir la cámara. Revisa los permisos o usa Subir archivo.");
    } finally {
      openingRef.current = false;
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    onCapture(dataUrl);
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("La imagen no debe superar los 8MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      stopStream();
      onCapture(String(reader.result ?? ""));
    };
    reader.onerror = () => setError("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  };

  if (active) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800">
          <video ref={videoRef} playsInline muted className="w-full max-h-[60vh] object-contain" />
          <button
            type="button"
            onClick={stopStream}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 hover:text-white"
            aria-label="Cerrar cámara"
          >
            <X size={16} />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <Button type="button" onClick={capture} disabled={busy} className="w-full">
              <Camera size={16} /> Tomar foto
            </Button>
          </div>
        </div>
        <p className="text-xs text-zinc-500 text-center">Encuadra el comprobante completo y con buena luz.</p>
        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startCamera} disabled={busy} className="w-full">
        <Camera size={16} /> Abrir cámara
      </Button>
      <label className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800/60 border border-dashed border-zinc-700/50 p-4 cursor-pointer hover:bg-zinc-800 transition-colors">
        <Upload size={18} className="text-zinc-400" />
        <span className="text-sm text-zinc-400">Subir archivo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          disabled={busy}
        />
      </label>
      {error && <p className="text-xs text-amber-400">{error}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import { ArrowRight, Camera, FileInput, Wrench, X } from "lucide-react";

export default function EquipmentQrScanPage() {
  const router = useRouter();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<Record<string, string> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    readerRef.current = new BrowserQRCodeReader();
    return () => {
      scannerControlsRef.current?.stop();
    };
  }, []);

  async function startCameraScan() {
    setError(null);
    setScanResult(null);
    setScanInfo(null);

    if (!videoRef.current || !readerRef.current) {
      setError("Câmera indisponível.");
      return;
    }

    setScanning(true);

    try {
      const controls = await readerRef.current.decodeFromVideoDevice(undefined, videoRef.current, (result, decodeError) => {
        if (result?.getText()) {
          const rawText = result.getText();
          setScanResult(rawText);
          setScanning(false);
          controls.stop();
          scannerControlsRef.current = null;

          try {
            const parsed = JSON.parse(rawText) as Record<string, string>;
            if (parsed.equipmentId) {
              router.push(`/equipamentos/${parsed.equipmentId}`);
            } else if (parsed.url) {
              router.push(parsed.url);
            }
          } catch {
            // mantém o comportamento atual se o QR não for JSON válido
          }
        }

        if (decodeError) {
          console.debug(decodeError);
        }
      });
      scannerControlsRef.current = controls;
    } catch (exception) {
      setError("Não foi possível iniciar a leitura pela câmera.");
      setScanning(false);
      console.error(exception);
    }
  }

  function stopCameraScan() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanning(false);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !readerRef.current) {
      return;
    }

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);

    image.onload = async () => {
      try {
        const result = await readerRef.current?.decodeFromImageElement(image);
        if (result?.getText()) {
          const rawText = result.getText();
          setScanResult(rawText);
          setError(null);

          try {
            const parsed = JSON.parse(rawText) as Record<string, string>;
            if (parsed.equipmentId) {
              router.push(`/equipamentos/${parsed.equipmentId}`);
            } else if (parsed.url) {
              router.push(parsed.url);
            }
          } catch {
            // mantém o resultado atual se não for JSON válido
          }
        } else {
          setError("QR Code não encontrado na imagem.");
        }
      } catch (err) {
        setError("Falha ao ler o QR Code. Verifique a imagem e tente novamente.");
      } finally {
        URL.revokeObjectURL(image.src);
      }
    };
  }

  useEffect(() => {
    if (!scanResult) {
      setScanInfo(null);
      return;
    }

    try {
      const parsed = JSON.parse(scanResult) as Record<string, string>;
      setScanInfo(parsed);
    } catch {
      setScanInfo(null);
    }
  }, [scanResult]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-semibold text-foreground">Leitor de QR Code</p>
          <p className="mt-1 text-sm text-muted-foreground">Use câmera ou envie imagem para abrir o histórico do equipamento.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Leitura por câmera</p>
              <p>Ideal para celular e tablet.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startCameraScan}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                disabled={scanning}
              >
                <Camera className="w-4 h-4" /> Iniciar câmera
              </button>
              <button
                onClick={stopCameraScan}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted"
                disabled={!scanning}
              >
                <X className="w-4 h-4" /> Parar
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <video ref={videoRef} className="h-72 w-full rounded-lg bg-black/5 object-cover" autoPlay muted playsInline />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Leitura por imagem</p>
            <p>Envie uma foto do QR Code do equipamento.</p>
          </div>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <FileInput className="mr-2 h-4 w-4" /> Selecionar imagem
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Resultado</p>
            {scanResult ? (
              <div className="space-y-3">
                {scanInfo ? (
                  <>
                    <div className="space-y-2">
                      {scanInfo.url ? (
                        <a href={scanInfo.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                          <ArrowRight className="w-4 h-4" /> Abrir equipamento
                        </a>
                      ) : scanInfo.equipmentId ? (
                        <Link href={`/equipamentos/${scanInfo.equipmentId}`} className="inline-flex items-center gap-2 text-primary hover:underline">
                          <ArrowRight className="w-4 h-4" /> Abrir equipamento
                        </Link>
                      ) : null}

                      {scanInfo.equipmentId ? (
                        <Link href={`/ordens?equipmentId=${scanInfo.equipmentId}&action=register`} className="inline-flex items-center gap-2 text-primary hover:underline">
                          <Wrench className="w-4 h-4" /> Registrar manutenção
                        </Link>
                      ) : null}
                    </div>

                    <div className="rounded-lg bg-surface p-3 text-xs text-muted-foreground space-y-2">
                      <div className="flex justify-between gap-2"><span className="font-medium">ID</span><span>{scanInfo.equipmentId ?? "-"}</span></div>
                      <div className="flex justify-between gap-2"><span className="font-medium">Tag</span><span>{scanInfo.tag ?? "-"}</span></div>
                      <div className="flex justify-between gap-2"><span className="font-medium">Setor</span><span>{scanInfo.setor ?? "-"}</span></div>
                      <div className="flex justify-between gap-2"><span className="font-medium">Linha</span><span>{scanInfo.linha ?? "-"}</span></div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-foreground">QR Code lido, mas o conteúdo não corresponde ao formato esperado.</p>
                )}

                <details className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Mostrar JSON bruto</summary>
                  <pre className="mt-2 break-words text-[10px] text-foreground/80">{scanResult}</pre>
                </details>
              </div>
            ) : (
              <p>Nenhum QR Code lido ainda.</p>
            )}
          </div>

          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        </div>
      </div>
    </div>
  );
}

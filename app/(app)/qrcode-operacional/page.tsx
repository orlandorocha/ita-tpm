"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Camera, FileInput, QrCode, Shield, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { recordAuditLog } from "@/lib/audit";

export default function QRCodeOperacionalPage() {
  const router = useRouter();
  const { state, completeOperationalAuth } = useApp();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<Record<string, string> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    readerRef.current = new BrowserQRCodeReader();
    return () => {
      scannerControlsRef.current?.stop();
    };
  }, []);

  async function processQRCode(rawText: string) {
    setScanResult(rawText);
    setIsProcessing(true);

    try {
      const parsed = JSON.parse(rawText) as Record<string, string>;
      setScanInfo(parsed);

      if (parsed.equipmentId) {
        // Registra auditoria da autenticação operacional
        await recordAuditLog({
          timestamp: new Date().toISOString(),
          resource: "authentication",
          resourceId: parsed.equipmentId,
          action: "operational_auth_completed",
          userId: state.currentUser?.id,
          userName: state.currentUser?.name ?? "Desconhecido",
          details: `Autenticação operacional concluída via QR Code do equipamento ${parsed.equipmentId}`,
          metadata: {
            equipmentId: parsed.equipmentId,
            tag: parsed.tag,
            setor: parsed.setor,
            linha: parsed.linha,
            userRole: state.currentUser?.role,
          },
        });

        // Completa autenticação operacional
        completeOperationalAuth(parsed.equipmentId);

        // Redireciona para o histórico de manutenção após breve delay
        setTimeout(() => {
          startTransition(() => {
            router.push("/ordens?authCompleted=1");
          });
        }, 1500);
      } else {
        setError("QR Code inválido. O QR Code deve conter informações de um equipamento.");
        setIsProcessing(false);
      }
    } catch {
      setError("QR Code inválido. O formato do QR Code não corresponde ao esperado.");
      setScanInfo(null);
      setIsProcessing(false);
    }
  }

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
      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, decodeError) => {
          if (result?.getText()) {
            const rawText = result.getText();
            setScanning(false);
            controls.stop();
            scannerControlsRef.current = null;
            void processQRCode(rawText);
          }

          if (decodeError) {
            console.debug(decodeError);
          }
        }
      );
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
          setError(null);
          void processQRCode(rawText);
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

  // Se já completou auth operacional, não deveria estar aqui
  if (state.operationalAuthCompleted) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Autenticação Operacional</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Olá, <span className="font-medium text-foreground">{state.currentUser?.name}</span>!
              Para acessar o sistema, escaneie o QR Code de um equipamento.
            </p>
          </div>
        </div>

        {/* Card principal */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
          {/* Status do processamento */}
          {isProcessing && scanInfo?.equipmentId && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <QrCode className="h-5 w-5" />
                <span className="font-medium">Equipamento identificado!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecionando para o sistema...
              </p>
            </div>
          )}

          {/* Leitura por câmera */}
          {!isProcessing && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Leitura por câmera</p>
                  <div className="flex gap-2">
                    <button
                      onClick={startCameraScan}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      disabled={scanning}
                    >
                      <Camera className="h-4 w-4" /> Iniciar
                    </button>
                    {scanning && (
                      <button
                        onClick={stopCameraScan}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-4 w-4" /> Parar
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background overflow-hidden">
                  <video
                    ref={videoRef}
                    className="h-52 w-full bg-muted/50 object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                </div>
              </div>

              {/* Divisor */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Leitura por imagem */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Leitura por imagem</p>
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
                  <FileInput className="mr-2 h-4 w-4" /> Selecionar imagem do QR Code
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </>
          )}

          {/* Erro */}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Informações adicionais */}
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Esta etapa é obrigatória para perfis <span className="font-medium">Manutentor</span> e{" "}
            <span className="font-medium">Operador</span>. O QR Code vincula sua sessão ao equipamento de trabalho.
          </p>
        </div>
      </div>
    </div>
  );
}

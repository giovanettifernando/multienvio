"use client";

/**
 * Hook para geração assíncrona de documentos PDF.
 *
 * Fluxo:
 * 1. Chama POST /api/documents/generate com tipo + params
 * 2. Recebe documentId + statusUrl
 * 3. Faz polling em statusUrl a cada 2s
 * 4. Quando COMPLETED, disponibiliza downloadUrl
 *
 * Uso:
 *   const { status, downloadUrl, error, generate, reset } = useDocumentGeneration();
 *   await generate('label', { labelId: '...' });
 */

import { useState, useCallback, useRef } from "react";
import { apiFetch } from "@/shared/utils/api-fetch";

type DocumentStatus = "idle" | "queued" | "pending" | "processing" | "completed" | "failed";

interface GenerateResponse {
  documentId: string;
  jobId: string;
  status: string;
  statusUrl: string;
  downloadUrl: string;
}

interface StatusResponse {
  id: string;
  status: string;
  documentType: string;
  fileName: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  completedAt: string | null;
  downloadUrl: string | null;
}

interface UseDocumentGenerationReturn {
  status: DocumentStatus;
  documentId: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  error: string | null;
  generate: (documentType: string, params: Record<string, unknown>) => Promise<string | null>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90; // 3 min max

export function useDocumentGeneration(): UseDocumentGenerationReturn {
  const [status, setStatus] = useState<DocumentStatus>("idle");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setDocumentId(null);
    setDownloadUrl(null);
    setFileName(null);
    setError(null);
  }, []);

  const generate = useCallback(
    async (documentType: string, params: Record<string, unknown>): Promise<string | null> => {
      abortRef.current = false;
      setStatus("queued");
      setError(null);
      setDownloadUrl(null);
      setFileName(null);

      try {
        // 1. Enqueue
        const res = await apiFetch<GenerateResponse>("/api/documents/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentType, ...params }),
        });

        setDocumentId(res.documentId);

        // Se já estava completo (idempotência retornou doc existente)
        if (res.status === "completed") {
          setStatus("completed");
          setDownloadUrl(res.downloadUrl);
          return res.downloadUrl;
        }

        // 2. Polling
        for (let i = 0; i < MAX_POLLS; i++) {
          if (abortRef.current) return null;

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          if (abortRef.current) return null;

          const statusRes = await apiFetch<StatusResponse>(
            `/api/documents/${res.documentId}/status`
          );

          if (statusRes.status === "completed") {
            setStatus("completed");
            setDownloadUrl(statusRes.downloadUrl);
            setFileName(statusRes.fileName);
            return statusRes.downloadUrl;
          }

          if (statusRes.status === "failed") {
            setStatus("failed");
            setError(statusRes.errorMessage || "Erro na geração do documento");
            return null;
          }

          setStatus(statusRes.status as DocumentStatus);
        }

        // Timeout
        setStatus("failed");
        setError("Tempo limite excedido aguardando geração do documento");
        return null;
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Erro ao gerar documento");
        return null;
      }
    },
    []
  );

  return { status, documentId, downloadUrl, fileName, error, generate, reset };
}

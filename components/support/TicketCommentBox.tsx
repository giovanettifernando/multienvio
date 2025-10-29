"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Space, Upload, Typography, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { CannedReplySelect } from "@/components/support/CannedReplySelect";

type Props = {
  ticketId: string;
  onSubmitted?: () => void;
  mode?: 'client' | 'admin';
};

async function uploadAttachments(ticketId: string, files: UploadFile[]): Promise<string[]> {
  if (!files.length) {
    return [];
  }

  const payload = files
    .map((file) => ({
      fileName: file.name,
      size: file.size ?? file.originFileObj?.size ?? 0,
    }))
    .filter((file) => file.size > 0);

  if (!payload.length) {
    return [];
  }

  const response = await fetch(`/api/support/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: payload }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.mensagem ?? "Falha ao enviar anexos");
  }

  const data = (await response.json()) as Array<{ id: string }>;
  return data.map((attachment) => attachment.id);
}

async function postComment(ticketId: string, messageText: string, attachmentIds?: string[]) {
  const response = await fetch(`/api/support/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: messageText,
      ...(attachmentIds?.length ? { attachmentsIds: attachmentIds } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.mensagem ?? "Não foi possível enviar o comentário");
  }

  return response.json();
}

export function TicketCommentBox({ ticketId, onSubmitted, mode = 'admin' }: Props) {
  const [messageText, setMessageText] = useState("");
  const [touched, setTouched] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, void>({
  mutationFn: async () => {
    const trimmed = messageText.trim();
    if (!trimmed) {
      throw new Error("Escreva uma mensagem antes de enviar");
    }
      const attachmentIds = await uploadAttachments(ticketId, fileList);
      return postComment(ticketId, trimmed, attachmentIds);
    },
      onSuccess: () => {
        message.success("Comentário enviado");
        setMessageText("");
        setFileList([]);
        setTouched(false);
        queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
        queryClient.invalidateQueries({ queryKey: ["ticket", ticketId, "attachments"] });
        onSubmitted?.();
      },
      onError: (error: unknown) => {
        const text =
          error instanceof Error ? error.message : "Não foi possível enviar o comentário";
        message.error(text);
      },
    });

  const errorMessage =
    touched && messageText.trim().length === 0
      ? "Por favor, escreva uma mensagem."
      : undefined;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      {mode === 'admin' && (
        <CannedReplySelect
          onSelect={(reply) => {
            setMessageText((prev) => `${prev ? `${prev}\n` : ""}${reply}`);
          }}
        />
      )}
      <Input.TextArea
        value={messageText}
        onChange={(event) => setMessageText(event.target.value)}
        onBlur={() => setTouched(true)}
        rows={4}
        placeholder="Escreva uma resposta..."
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={errorMessage ? "ticket-comment-error" : undefined}
        maxLength={2000}
        showCount
        style={{ resize: "vertical" }}
      />
      {errorMessage ? (
        <Typography.Text id="ticket-comment-error" type="danger">
          {errorMessage}
        </Typography.Text>
      ) : null}
      <Upload
        multiple
        fileList={fileList}
        beforeUpload={() => false}
        onRemove={(file) => {
          setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        }}
        onChange={({ fileList: newList }) => {
          setFileList(newList);
        }}
        aria-label="Adicionar anexos"
      >
        <Button variant="outlined">Anexar arquivo</Button>
      </Upload>
      <Button
        type="primary"
        variant="solid"
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
      >
        Enviar
      </Button>
    </Space>
  );
}

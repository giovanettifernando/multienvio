"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Space, Upload, Typography, message, Checkbox } from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import { CannedReplySelect } from "@/components/support/CannedReplySelect";
import { usePostTicketMessage } from "@/hooks/useSupport";

type Props = {
  ticketId: string;
  onSubmitted?: () => void;
  mode?: 'client' | 'admin';
};

export function TicketCommentBox({ ticketId, onSubmitted, mode = 'admin' }: Props) {
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const [messageText, setMessageText] = useState("");
  const [touched, setTouched] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const queryClient = useQueryClient();
  const postMessage = usePostTicketMessage(mode === 'admin' ? 'admin' : 'user');

  const handleBeforeUpload = (file: RcFile) => {
    if (file.size > MAX_FILE_SIZE) {
      message.error("Cada arquivo deve ter no máximo 10 MB.");
      return Upload.LIST_IGNORE;
    }
    if (fileList.length >= MAX_FILES) {
      message.warning(`É permitido enviar até ${MAX_FILES} arquivos por mensagem.`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const mutation = useMutation<void, Error, void>({
  mutationFn: async () => {
    const trimmed = messageText.trim();
    if (!trimmed) {
      throw new Error("Escreva uma mensagem antes de enviar");
    }
      const attachments = fileList
        .map((file) => file.originFileObj)
        .filter((file): file is RcFile => !!file)
        .map((file) => file as File);
      await postMessage.mutateAsync({
        ticketId,
        text: trimmed,
        attachments: attachments.length ? attachments : undefined,
        internal: mode === 'admin' ? isInternal : undefined,
      });
    },
      onSuccess: () => {
        message.success("Comentário enviado");
        setMessageText("");
        setFileList([]);
        setIsInternal(false);
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
        beforeUpload={handleBeforeUpload}
        maxCount={MAX_FILES}
        onRemove={(file) => {
          setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        }}
        onChange={({ fileList: newList }) => {
          setFileList(newList.slice(0, MAX_FILES));
        }}
        aria-label="Adicionar anexos"
      >
        <Button variant="outlined">Anexar arquivo</Button>
      </Upload>
      {mode === 'admin' && (
        <Checkbox
          checked={isInternal}
          onChange={(e) => setIsInternal(e.target.checked)}
        >
          <Typography.Text type="secondary">
            Mensagem interna (visível apenas para a equipe)
          </Typography.Text>
        </Checkbox>
      )}
      <Button
        type="primary"
        variant="solid"
        onClick={() => mutation.mutate()}
        loading={mutation.isPending || postMessage.isPending}
        disabled={!messageText.trim()}
      >
        Enviar
      </Button>
    </Space>
  );
}

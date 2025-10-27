"use client";

import { useState } from "react";
import { App, Button, Card, Flex, Form, Input, Upload } from "antd";
import { PaperClipOutlined, SendOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { useReplyTicket } from "@/lib/support/hooks";

interface ReplyBoxProps {
  ticketId?: string | null;
}

export function ReplyBox({ ticketId }: ReplyBoxProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const replyMutation = useReplyTicket();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!ticketId) {
        message.warning("Selecione um ticket antes de responder.");
        return;
      }

      replyMutation.mutate(
        {
          id: ticketId,
          data: {
            message: values.message as string,
            attachments: fileList.map((file) => file.name),
          },
        },
        {
          onSuccess: () => {
            message.success("Resposta enviada ao cliente.");
            form.resetFields();
            setFileList([]);
          },
          onError: (error) => {
            const text =
              error instanceof Error ? error.message : "Não foi possível enviar a resposta.";
            message.error(text);
          },
        },
      );
    } catch {
      // validation already handled by Form
    }
  };

  return (
    <Card
      title="Responder cliente"
      size="small"
      styles={{ body: { paddingTop: 16 } }}
      extra={
        <Flex align="center" gap={8}>
          <SendOutlined />
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item
          name="message"
          label="Mensagem"
          rules={[{ required: true, message: "Escreva a resposta ao cliente." }]}
        >
          <Input.TextArea
            placeholder="Digite sua resposta (máx. 2000 caracteres)"
            rows={4}
            maxLength={2000}
            showCount
            disabled={replyMutation.isPending}
          />
        </Form.Item>

        <Upload
          multiple
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList: next }) => setFileList(next)}
          onRemove={(file) => {
            setFileList((current) => current.filter((item) => item.uid !== file.uid));
          }}
          disabled={replyMutation.isPending}
        >
          <Button icon={<PaperClipOutlined />} disabled={replyMutation.isPending}>
            Anexar arquivo
          </Button>
        </Upload>

        <Flex justify="flex-end" style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            htmlType="submit"
            loading={replyMutation.isPending}
          >
            Enviar
          </Button>
        </Flex>
      </Form>
    </Card>
  );
}

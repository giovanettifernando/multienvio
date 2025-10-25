"use client";

import { useEffect, useState } from "react";
import { InboxOutlined } from "@ant-design/icons";
import { App, Form, Input, Space, Upload, type UploadFile } from "antd";
import type { RcFile } from "antd/es/upload";
import { Controller, useFormContext } from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";

const readFileAsBase64 = (file: RcFile) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result?.toString() ?? "");
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export function NFeForm() {
  const { message } = App.useApp();
  const {
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<FinalizeFormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const nfeXml = watch("document.nfeXml");

  useEffect(() => {
    if (!nfeXml) {
      setFileList([]);
    }
  }, [nfeXml]);

  const beforeUpload = async (file: RcFile) => {
    try {
      const base64 = await readFileAsBase64(file);
      setValue("document.nfeXml", base64, { shouldDirty: true });
      message.success("XML anexado com sucesso.");
      setFileList([
        {
          uid: file.uid,
          name: file.name,
          status: "done",
        },
      ]);
    } catch {
      message.error("Não foi possível ler o arquivo XML.");
    }
    return false;
  };

  const handleRemove = () => {
    setValue("document.nfeXml", null, { shouldDirty: true });
    setFileList([]);
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Controller
        control={control}
        name="document.nfeKey"
        render={({ field }) => (
          <Form.Item
            label="Digitar chave da nota fiscal"
            validateStatus={errors.document?.nfeKey ? "error" : undefined}
            help={errors.document?.nfeKey?.message as string | undefined}
          >
            <Input
              {...field}
              value={field.value ?? ""}
              maxLength={44}
              placeholder="Digite os 44 dígitos da NF-e"
              onChange={(event) =>
                field.onChange(event.target.value.replace(/\D/g, ""))
              }
            />
          </Form.Item>
        )}
      />

      <Form.Item
        label="Anexar XML"
        validateStatus={errors.document?.nfeXml ? "error" : undefined}
        help={errors.document?.nfeXml?.message as string | undefined}
      >
        <Upload.Dragger
          beforeUpload={beforeUpload}
          fileList={fileList}
          onRemove={handleRemove}
          accept=".xml"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Arraste o arquivo XML da NF-e ou clique para selecionar
          </p>
        </Upload.Dragger>
      </Form.Item>
      <Form.Item>
        <small>Não use a mesma NF em pacotes diferentes.</small>
      </Form.Item>
    </Space>
  );
}

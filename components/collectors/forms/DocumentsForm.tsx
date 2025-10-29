'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Form, Upload, Space, Typography, Alert } from 'antd';
import { UploadOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import type { CollectorFormInput } from '@/lib/collectors/types';

const { Text, Title } = Typography;

const allowedFiles = '.pdf,.png,.jpg,.jpeg';

interface DocumentsFormProps {
  cnhFiles: UploadFile[];
  onCnhChange: (files: UploadFile[]) => void;
  crlvFiles: UploadFile[];
  onCrlvChange: (files: UploadFile[]) => void;
  addressProofFiles: UploadFile[];
  onAddressProofChange: (files: UploadFile[]) => void;
}

export default function DocumentsForm({
  cnhFiles,
  onCnhChange,
  crlvFiles,
  onCrlvChange,
  addressProofFiles,
  onAddressProofChange,
}: DocumentsFormProps) {
  const { formState: { errors } } = useFormContext<CollectorFormInput>();

  const renderStatus = (files: UploadFile[]) => {
    if (files.length === 0) {
      return (
        <Text type="danger">
          <CloseCircleFilled /> Pendente
        </Text>
      );
    }
    return (
      <Text type="success">
        <CheckCircleFilled /> Enviado ({files.length} arquivo{files.length > 1 ? 's' : ''})
      </Text>
    );
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={24}>
      <Alert
        message="Envie os documentos obrigatórios"
        description="Todos os 3 documentos são obrigatórios. Aceito: PDF, JPG, PNG. Os arquivos serão salvos ao submeter o formulário."
        type="info"
        showIcon
      />

      <div>
        <Title level={5}>CNH (frente e verso ou arquivo único)</Title>
        <Form.Item
          validateStatus={errors.documents?.cnhFiles ? 'error' : ''}
          help={errors.documents?.cnhFiles?.message}
        >
          <Upload
            fileList={cnhFiles}
            beforeUpload={() => false}
            onChange={({ fileList }) => onCnhChange(fileList)}
            onRemove={(file) => {
              onCnhChange(cnhFiles.filter((f) => f.uid !== file.uid));
            }}
            accept={allowedFiles}
            multiple
          >
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: 4, background: 'white', cursor: 'pointer' }}>
              <UploadOutlined /> Selecionar arquivo
            </button>
          </Upload>
        </Form.Item>
        {renderStatus(cnhFiles)}
      </div>

      <div>
        <Title level={5}>CRLV (Documento do veículo)</Title>
        <Form.Item
          validateStatus={errors.documents?.crlvFile ? 'error' : ''}
          help={errors.documents?.crlvFile?.message}
        >
          <Upload
            fileList={crlvFiles}
            beforeUpload={() => false}
            onChange={({ fileList }) => onCrlvChange(fileList)}
            onRemove={() => onCrlvChange([])}
            accept={allowedFiles}
            maxCount={1}
          >
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: 4, background: 'white', cursor: 'pointer' }}>
              <UploadOutlined /> Selecionar arquivo
            </button>
          </Upload>
        </Form.Item>
        {renderStatus(crlvFiles)}
      </div>

      <div>
        <Title level={5}>Comprovante de Endereço PF</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Deve estar em nome do coletor (Pessoa Física)
        </Text>
        <Form.Item
          validateStatus={errors.documents?.pfAddressProofFile ? 'error' : ''}
          help={errors.documents?.pfAddressProofFile?.message}
        >
          <Upload
            fileList={addressProofFiles}
            beforeUpload={() => false}
            onChange={({ fileList }) => onAddressProofChange(fileList)}
            onRemove={() => onAddressProofChange([])}
            accept={allowedFiles}
            maxCount={1}
          >
            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: 4, background: 'white', cursor: 'pointer' }}>
              <UploadOutlined /> Selecionar arquivo
            </button>
          </Upload>
        </Form.Item>
        {renderStatus(addressProofFiles)}
      </div>
    </Space>
  );
}

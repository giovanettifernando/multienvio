'use client';

import { useState } from 'react';
import { Card, Steps, Button, App, Result, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import PFForm from '@/components/collectors/forms/PFForm';
import PJForm from '@/components/collectors/forms/PJForm';
import VehicleForm from '@/components/collectors/forms/VehicleForm';
import DocumentsForm from '@/components/collectors/forms/DocumentsForm';
import BankForm from '@/components/collectors/forms/BankForm';
import { publicRegistrationSchema } from '@/lib/collectors/schemas';
import type { PublicRegistrationSchemaInput } from '@/lib/collectors/schemas';
import type { UploadFile } from 'antd/es/upload/interface';
import { useUpload } from '@/lib/collectors/hooks';

const { Step } = Steps;

const defaultValues: PublicRegistrationSchemaInput = {
  pf: {
    nome: '',
    cpf: '',
    email: '',
    password: '',
    confirmPassword: '',
    cnh: {
      number: '',
      category: 'B',
      expiresAt: '',
    },
    endereco: {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
    },
    celular: '',
    whatsapp: null,
    usarMesmoNumero: true,
  },
  pj: {
    razaoSocial: '',
    cnpj: '',
    endereco: {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
    },
    usarEnderecoFisico: false,
  },
  vehicle: {
    plate: '',
    brand: '',
    model: null,
    year: null,
  },
  documents: {
    cnhFiles: [],
    crlvFile: [],
    pfAddressProofFile: [],
  },
  commission: {
    kind: 'fixa',
    amount: 0,
  },
  bank: {
    kind: 'pix',
    pixType: 'cnpj',
    pixKey: '',
  },
};

export default function ColetorCadastroPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const upload = useUpload();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estados para gerenciar arquivos de documentos
  const [cnhFiles, setCnhFiles] = useState<UploadFile[]>([]);
  const [crlvFiles, setCrlvFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);

  const methods = useForm<PublicRegistrationSchemaInput>({
    resolver: zodResolver(publicRegistrationSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { handleSubmit, trigger, setValue } = methods;

  const steps = [
    { title: 'Pessoa Física', fields: ['pf'] },
    { title: 'Pessoa Jurídica', fields: ['pj'] },
    { title: 'Veículo', fields: ['vehicle'] },
    { title: 'Documentos', fields: ['documents'] },
    { title: 'Dados Bancários', fields: ['bank'] },
  ];

  // Handlers para mudanças de arquivos
  const handleCnhChange = (files: UploadFile[]) => {
    setCnhFiles(files);
    setValue('documents.cnhFiles', files as never, { shouldValidate: true });
  };

  const handleCrlvChange = (files: UploadFile[]) => {
    setCrlvFiles(files);
    setValue('documents.crlvFile', files as never, { shouldValidate: true });
  };

  const handleAddressProofChange = (files: UploadFile[]) => {
    setAddressProofFiles(files);
    setValue('documents.pfAddressProofFile', files as never, { shouldValidate: true });
  };

  async function handleNext() {
    const currentFields = steps[currentStep].fields;
    const isValid = await trigger(currentFields as ('pf' | 'pj' | 'vehicle' | 'documents' | 'bank')[]);

    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handlePrev() {
    setCurrentStep(currentStep - 1);
  }

  async function onSubmit(formData: PublicRegistrationSchemaInput) {
    try {
      setLoading(true);

      // Upload de arquivos e criar FileRefs
      // IMPORTANT: Use local state variables (cnhFiles, crlvFiles, addressProofFiles) NOT formData.documents
      // because React Hook Form doesn't properly track UploadFile objects with originFileObj
      console.log('[cadastro] Starting document upload process');
      console.log('[cadastro] Total CNH files from local state:', cnhFiles.length);
      console.log('[cadastro] Total CRLV files from local state:', crlvFiles.length);
      console.log('[cadastro] Total Address files from local state:', addressProofFiles.length);

      const cnhFilesProcessed = [];
      for (const file of cnhFiles) {
        const uploadFile = file as UploadFile;
        console.log('[cadastro] CNH file:', { name: file.name, hasOriginFileObj: !!uploadFile.originFileObj, hasUrl: !!file.url });

        if (uploadFile.originFileObj) {
          console.log('[cadastro] Uploading CNH from originFileObj...');
          const url = await upload(uploadFile.originFileObj as File);
          console.log('[cadastro] CNH uploaded, URL length:', url?.length);
          cnhFilesProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          console.log('[cadastro] CNH already has URL');
          cnhFilesProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        } else {
          console.warn('[cadastro] CNH file SKIPPED - no originFileObj and no url');
        }
      }

      console.log('[cadastro] CNH processed:', cnhFilesProcessed.length, 'files');

      // Upload CRLV
      const crlvFileProcessed = [];
      if (crlvFiles[0]) {
        const file = crlvFiles[0];
        const uploadFile = file as UploadFile;
        console.log('[cadastro] CRLV file:', { name: file.name, hasOriginFileObj: !!uploadFile.originFileObj, hasUrl: !!file.url });

        if (uploadFile.originFileObj) {
          console.log('[cadastro] Uploading CRLV from originFileObj...');
          const url = await upload(uploadFile.originFileObj as File);
          console.log('[cadastro] CRLV uploaded, URL length:', url?.length);
          crlvFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          console.log('[cadastro] CRLV already has URL');
          crlvFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        } else {
          console.warn('[cadastro] CRLV file SKIPPED - no originFileObj and no url');
        }
      }

      console.log('[cadastro] CRLV processed:', crlvFileProcessed.length, 'files');

      // Upload PF Address Proof
      const pfAddressProofFileProcessed = [];
      if (addressProofFiles[0]) {
        const file = addressProofFiles[0];
        const uploadFile = file as UploadFile;
        console.log('[cadastro] Address Proof file:', { name: file.name, hasOriginFileObj: !!uploadFile.originFileObj, hasUrl: !!file.url });

        if (uploadFile.originFileObj) {
          console.log('[cadastro] Uploading Address Proof from originFileObj...');
          const url = await upload(uploadFile.originFileObj as File);
          console.log('[cadastro] Address Proof uploaded, URL length:', url?.length);
          pfAddressProofFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          console.log('[cadastro] Address Proof already has URL');
          pfAddressProofFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        } else {
          console.warn('[cadastro] Address Proof file SKIPPED - no originFileObj and no url');
        }
      }

      console.log('[cadastro] Address Proof processed:', pfAddressProofFileProcessed.length, 'files');

      const payload = {
        pf: formData.pf,
        pj: formData.pj,
        vehicle: formData.vehicle,
        documents: {
          cnhFiles: cnhFilesProcessed,
          crlvFile: crlvFileProcessed,
          pfAddressProofFile: pfAddressProofFileProcessed,
        },
        commission: {
          kind: 'fixa' as const,
          amount: 0,
        },
        bank: formData.bank,
      };

      console.log('[cadastro] PAYLOAD_SUMMARY:', {
        cnhFilesCount: payload.documents.cnhFiles.length,
        crlvFileCount: payload.documents.crlvFile.length,
        pfAddressProofFileCount: payload.documents.pfAddressProofFile.length,
        cnhFilesHaveUrls: payload.documents.cnhFiles.every(f => !!f.url),
        crlvFileHasUrl: payload.documents.crlvFile.every(f => !!f.url),
        pfAddressProofFileHasUrl: payload.documents.pfAddressProofFile.every(f => !!f.url),
      });

      const response = await fetch('/api/coletores/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.message || 'Erro ao criar cadastro');
        setLoading(false);
        return;
      }

      setSuccess(true);
      message.success('Cadastro realizado com sucesso!');
    } catch (error) {
      console.error('Submit error:', error);
      message.error('Erro ao enviar cadastro');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
          padding: 24,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 600 }}>
          <Result
            status="success"
            title="Cadastro enviado com sucesso!"
            subTitle="Enviamos um e-mail de confirmação para você. Por favor, verifique sua caixa de entrada e clique no link para confirmar seu e-mail. Após a confirmação, seu cadastro será analisado pela nossa equipe."
            extra={[
              <Button type="primary" key="login" onClick={() => router.push('/coletores')}>
                Voltar para Login
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: 24,
      }}
    >
      <Card
        title="Cadastro de Coletor Autônomo"
        style={{ maxWidth: 900, margin: '0 auto' }}
      >
        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          {steps.map((item) => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {currentStep === 0 && <PFForm />}
              {currentStep === 1 && <PJForm />}
              {currentStep === 2 && <VehicleForm />}
              {currentStep === 3 && (
                <DocumentsForm
                  cnhFiles={cnhFiles}
                  onCnhChange={handleCnhChange}
                  crlvFiles={crlvFiles}
                  onCrlvChange={handleCrlvChange}
                  addressProofFiles={addressProofFiles}
                  onAddressProofChange={handleAddressProofChange}
                />
              )}
              {currentStep === 4 && <BankForm />}
            </Space>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handlePrev} disabled={currentStep === 0 || loading}>
                Voltar
              </Button>
              {currentStep < steps.length - 1 && (
                <Button type="primary" onClick={handleNext} disabled={loading}>
                  Próximo
                </Button>
              )}
              {currentStep === steps.length - 1 && (
                <Button type="primary" htmlType="submit" loading={loading}>
                  Enviar Cadastro
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </Card>
    </div>
  );
}

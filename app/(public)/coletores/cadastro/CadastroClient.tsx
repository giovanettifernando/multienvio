'use client';

import { useState } from 'react';
import { Card, Steps, Button, App, Result, Row, Col, Typography, theme } from 'antd';
import {
  UserOutlined,
  BankOutlined,
  CarOutlined,
  FileOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SendOutlined,
} from '@ant-design/icons';
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

const { Title, Text, Paragraph } = Typography;

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

const steps = [
  {
    title: 'Pessoa Física',
    icon: <UserOutlined />,
    description: 'Seus dados pessoais',
    fields: ['pf'] as const,
  },
  {
    title: 'Pessoa Jurídica',
    icon: <BankOutlined />,
    description: 'Dados da empresa',
    fields: ['pj'] as const,
  },
  {
    title: 'Veículo',
    icon: <CarOutlined />,
    description: 'Informações do veículo',
    fields: ['vehicle'] as const,
  },
  {
    title: 'Documentos',
    icon: <FileOutlined />,
    description: 'Upload de documentos',
    fields: ['documents'] as const,
  },
  {
    title: 'Dados Bancários',
    icon: <DollarOutlined />,
    description: 'Para receber pagamentos',
    fields: ['bank'] as const,
  },
];

export default function CadastroClient() {
  const { message } = App.useApp();
  const router = useRouter();
  const upload = useUpload();
  const { token } = theme.useToken();
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
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, setValue, formState: { errors } } = methods;

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
    const currentFields = [...steps[currentStep].fields] as ('pf' | 'pj' | 'vehicle' | 'documents' | 'bank')[];
    const isValid = await trigger(currentFields);

    // Log validation errors for debugging
    if (!isValid) {
      console.log('Validation errors:', errors);
      message.error('Por favor, corrija os erros antes de continuar');
      return;
    }

    setCurrentStep(currentStep + 1);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePrev() {
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(formData: PublicRegistrationSchemaInput) {
    try {
      setLoading(true);

      // Upload de arquivos CNH
      const cnhFilesProcessed = [];
      for (const file of cnhFiles) {
        const uploadFile = file as UploadFile;
        if (uploadFile.originFileObj) {
          const url = await upload(uploadFile.originFileObj as File, 'cnh');
          cnhFilesProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          cnhFilesProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        }
      }

      // Upload de arquivo CRLV
      const crlvFileProcessed = [];
      if (crlvFiles[0]) {
        const file = crlvFiles[0];
        const uploadFile = file as UploadFile;
        if (uploadFile.originFileObj) {
          const url = await upload(uploadFile.originFileObj as File, 'crlv');
          crlvFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          crlvFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        }
      }

      // Upload de comprovante de endereço
      const pfAddressProofFileProcessed = [];
      if (addressProofFiles[0]) {
        const file = addressProofFiles[0];
        const uploadFile = file as UploadFile;
        if (uploadFile.originFileObj) {
          const url = await upload(uploadFile.originFileObj as File, 'address_proof');
          pfAddressProofFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url,
            status: 'done' as const,
          });
        } else if (file.url) {
          pfAddressProofFileProcessed.push({
            uid: file.uid,
            name: file.name,
            url: file.url || undefined,
            status: 'done' as const,
          });
        }
      }

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
          background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 100%)`,
          padding: 24,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 600, borderRadius: 12 }}>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
            title="Cadastro enviado com sucesso!"
            subTitle={
              <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
                <Paragraph>
                  Enviamos um e-mail de confirmação para você.
                </Paragraph>
                <Paragraph>
                  Por favor, verifique sua caixa de entrada e clique no link para confirmar seu e-mail.
                </Paragraph>
                <Paragraph type="secondary">
                  Após a confirmação, seu cadastro será analisado pela nossa equipe.
                </Paragraph>
              </div>
            }
            extra={[
              <Button
                type="primary"
                key="login"
                size="large"
                onClick={() => router.push('/coletores/login')}
              >
                Ir para Login
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
        background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 100%)`,
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Cadastro de Coletor Autônomo
          </Title>
          <Text type="secondary">
            Preencha todos os dados para se cadastrar como coletor parceiro
          </Text>
        </div>

        {/* Steps Navigation */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
          styles={{ body: { padding: '24px 16px' } }}
        >
          <Steps
            current={currentStep}
            size="small"
            responsive
            items={steps.map((step, index) => ({
              title: step.title,
              icon: step.icon,
              status: index < currentStep ? 'finish' : index === currentStep ? 'process' : 'wait',
            }))}
          />
        </Card>

        {/* Form Content */}
        <Card
          style={{
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {/* Step Header */}
          <div
            style={{
              marginBottom: 24,
              paddingBottom: 16,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Row align="middle" gutter={16}>
              <Col>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: token.colorPrimaryBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    color: token.colorPrimary,
                  }}
                >
                  {steps[currentStep].icon}
                </div>
              </Col>
              <Col>
                <Title level={4} style={{ marginBottom: 0 }}>
                  {steps[currentStep].title}
                </Title>
                <Text type="secondary">{steps[currentStep].description}</Text>
              </Col>
            </Row>
          </div>

          {/* Form */}
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div style={{ minHeight: 300 }}>
                {currentStep === 0 && <PFForm showPassword={true} />}
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
              </div>

              {/* Navigation Buttons */}
              <div
                style={{
                  marginTop: 32,
                  paddingTop: 24,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <Button
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={handlePrev}
                  disabled={currentStep === 0 || loading}
                >
                  Voltar
                </Button>

                {currentStep < steps.length - 1 ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleNext}
                    disabled={loading}
                  >
                    Próximo <ArrowRightOutlined />
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={loading}
                  >
                    Enviar Cadastro <SendOutlined />
                  </Button>
                )}
              </div>
            </form>
          </FormProvider>
        </Card>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary">
            Já possui cadastro?{' '}
            <a
              onClick={() => router.push('/coletores/login')}
              style={{ cursor: 'pointer' }}
            >
              Faça login
            </a>
          </Text>
        </div>
      </div>
    </div>
  );
}

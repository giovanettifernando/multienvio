'use client';

import { useEffect, useMemo, useState } from 'react';
import { Drawer, Tabs, Button, Space, Spin, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import PFForm from './forms/PFForm';
import PJForm from './forms/PJForm';
import VehicleForm from './forms/VehicleForm';
import DocumentsForm from './forms/DocumentsForm';
import FinanceForm from './forms/FinanceForm';
import { collectorFormSchema } from '@/lib/collectors/schemas';
import type { Collector, CollectorFormData, CollectorFormInput } from '@/lib/collectors/types';
import { useUpload } from '@/lib/collectors/hooks';
import { maskCNPJ, maskCPF, maskPhone, maskCEP } from '@/lib/collectors/masks';

interface CollectorDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CollectorFormData) => Promise<void> | void;
  loading?: boolean;
  editCollector?: Collector | null;
}

const allowedUrlPrefixes = ['data:', 'http://', 'https://', '/uploads/'];

const defaultValues: CollectorFormInput = {
  pf: {
    nome: '',
    cpf: '',
    email: '',
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

function isStoredUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return allowedUrlPrefixes.some((prefix) => value.startsWith(prefix));
}

export default function CollectorDrawer({
  open,
  onClose,
  onSubmit,
  loading = false,
  editCollector = null,
}: CollectorDrawerProps) {
  const upload = useUpload();
  const [cnhFiles, setCnhFiles] = useState<UploadFile[]>([]);
  const [crlvFiles, setCrlvFiles] = useState<UploadFile[]>([]);
  const [addressProofFiles, setAddressProofFiles] = useState<UploadFile[]>([]);

  const resolver = useMemo(() => zodResolver(collectorFormSchema), []);

  const formMethods = useForm<CollectorFormInput, unknown, CollectorFormData>({
    resolver,
    defaultValues,
    mode: 'onBlur',
  });

  const {
    handleSubmit,
    reset,
    setValue,
    getValues,
  } = formMethods;

  useEffect(() => {
    if (open && editCollector) {
      reset({
        pf: {
          nome: editCollector.pf.nome,
          cpf: editCollector.pf.cpf ? maskCPF(editCollector.pf.cpf) : '',
          email: editCollector.pf.email || '',
          cnh: {
            ...editCollector.pf.cnh,
            category: editCollector.pf.cnh.category as 'ACC' | 'A' | 'B' | 'C' | 'D' | 'E',
          },
          endereco: {
            cep: editCollector.pf.endereco.cep ? maskCEP(editCollector.pf.endereco.cep) : null,
            logradouro: editCollector.pf.endereco.logradouro,
            numero: editCollector.pf.endereco.numero,
            complemento: editCollector.pf.endereco.complemento,
            bairro: editCollector.pf.endereco.bairro,
            cidade: editCollector.pf.endereco.cidade,
            uf: editCollector.pf.endereco.uf,
          },
          celular: editCollector.pf.celular ? maskPhone(editCollector.pf.celular) : '',
          whatsapp: editCollector.pf.whatsapp ? maskPhone(editCollector.pf.whatsapp) : null,
          usarMesmoNumero: editCollector.pf.usarMesmoNumero,
        },
        pj: {
          razaoSocial: editCollector.pj.razaoSocial,
          cnpj: maskCNPJ(editCollector.pj.cnpj),
          endereco: {
            cep: editCollector.pj.endereco.cep ? maskCEP(editCollector.pj.endereco.cep) : null,
            logradouro: editCollector.pj.endereco.logradouro,
            numero: editCollector.pj.endereco.numero,
            complemento: editCollector.pj.endereco.complemento,
            bairro: editCollector.pj.endereco.bairro,
            cidade: editCollector.pj.endereco.cidade,
            uf: editCollector.pj.endereco.uf,
          },
          usarEnderecoFisico: editCollector.pj.usarEnderecoFisico || false,
        },
        vehicle: {
          plate: editCollector.vehicle.plate,
          brand: editCollector.vehicle.brand,
          model: editCollector.vehicle.model,
          year: editCollector.vehicle.year,
        },
        documents: editCollector.documents,
        commission: editCollector.commission,
        bank: editCollector.bank,
      });

      setCnhFiles(editCollector.documents.cnhFiles.map(f => ({ ...f, status: 'done' as const })));
      setCrlvFiles(editCollector.documents.crlvFile.map(f => ({ ...f, status: 'done' as const })));
      setAddressProofFiles(editCollector.documents.pfAddressProofFile.map(f => ({ ...f, status: 'done' as const })));
    } else if (open) {
      reset(defaultValues);
      setCnhFiles([]);
      setCrlvFiles([]);
      setAddressProofFiles([]);
    } else {
      reset(defaultValues);
      setCnhFiles([]);
      setCrlvFiles([]);
      setAddressProofFiles([]);
    }
  }, [open, editCollector, reset]);

  const resolveFileUrl = async (files: UploadFile[], fallback?: string | null): Promise<string | null> => {
    const file = files[0];
    if (file?.url) return file.url;
    if (file?.originFileObj) {
      try {
        return await upload(file.originFileObj as File);
      } catch {
        throw new Error('Erro ao processar arquivo selecionado');
      }
    }
    if (typeof file?.response === 'string') return file.response;

    if (fallback && isStoredUrl(fallback)) {
      return fallback;
    }

    return null;
  };

  const processUploads = async () => {
    // Process CNH files
    const cnhFileArray: Array<{ uid: string; name: string; url?: string; status?: 'uploading' | 'done' | 'error' }> = [];
    for (const file of cnhFiles) {
      if (file.url) {
        cnhFileArray.push({ uid: file.uid, name: file.name, url: file.url, status: 'done' });
      } else if (file.originFileObj) {
        try {
          const url = await upload(file.originFileObj as File);
          cnhFileArray.push({ uid: file.uid, name: file.name, url, status: 'done' });
        } catch {
          throw new Error('Erro ao enviar arquivo da CNH');
        }
      }
    }

    if (cnhFileArray.length === 0) {
      throw new Error('É necessário enviar pelo menos 1 arquivo da CNH');
    }

    // Process CRLV file
    const crlvFile = crlvFiles[0];
    let crlvUrl: string | null = null;
    if (crlvFile?.url) {
      crlvUrl = crlvFile.url;
    } else if (crlvFile?.originFileObj) {
      try {
        crlvUrl = await upload(crlvFile.originFileObj as File);
      } catch {
        throw new Error('Erro ao enviar arquivo do CRLV');
      }
    }

    if (!crlvUrl) {
      throw new Error('Arquivo do CRLV é obrigatório');
    }

    const crlvFileArray = [{ uid: crlvFile.uid, name: crlvFile.name, url: crlvUrl, status: 'done' as const }];

    // Process address proof file
    const addressFile = addressProofFiles[0];
    let addressUrl: string | null = null;
    if (addressFile?.url) {
      addressUrl = addressFile.url;
    } else if (addressFile?.originFileObj) {
      try {
        addressUrl = await upload(addressFile.originFileObj as File);
      } catch {
        throw new Error('Erro ao enviar comprovante de endereço');
      }
    }

    if (!addressUrl) {
      throw new Error('Comprovante de endereço PF é obrigatório');
    }

    const addressFileArray = [{ uid: addressFile.uid, name: addressFile.name, url: addressUrl, status: 'done' as const }];

    setValue('documents.cnhFiles', cnhFileArray, { shouldValidate: false });
    setValue('documents.crlvFile', crlvFileArray, { shouldValidate: false });
    setValue('documents.pfAddressProofFile', addressFileArray, { shouldValidate: false });
  };

  const handleFormSubmit = async (formData: CollectorFormData) => {
    await onSubmit(formData);
  };

  const handleSave = async () => {
    try {
      await processUploads();
      await handleSubmit(handleFormSubmit)();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao salvar coletor');
    }
  };

  const tabItems = useMemo(
    () => [
      {
        key: 'pf',
        label: 'Cadastro PF',
        children: <PFForm />,
      },
      {
        key: 'pj',
        label: 'Cadastro PJ',
        children: <PJForm />,
      },
      {
        key: 'veiculo',
        label: 'Veículo',
        children: <VehicleForm />,
      },
      {
        key: 'documentos',
        label: 'Documentos',
        children: (
          <DocumentsForm
            cnhFiles={cnhFiles}
            onCnhChange={setCnhFiles}
            crlvFiles={crlvFiles}
            onCrlvChange={setCrlvFiles}
            addressProofFiles={addressProofFiles}
            onAddressProofChange={setAddressProofFiles}
          />
        ),
      },
      {
        key: 'financeiro',
        label: 'Financeiro',
        children: <FinanceForm />,
      },
    ],
    [cnhFiles, crlvFiles, addressProofFiles]
  );

  return (
    <Drawer
      title={editCollector ? 'Editar coletor' : 'Adicionar coletor'}
      placement="right"
      width={760}
      onClose={onClose}
      open={open}
      destroyOnClose={false}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="primary" onClick={handleSave} loading={loading}>
            {editCollector ? 'Salvar alterações' : 'Criar coletor'}
          </Button>
        </Space>
      }
    >
      <FormProvider {...formMethods}>
        <Spin spinning={loading}>
          <Tabs items={tabItems} tabPosition="top" />
        </Spin>
      </FormProvider>
    </Drawer>
  );
}

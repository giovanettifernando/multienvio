/**
 * API Route para registro de coletores autônomos
 * POST /api/coletores/auth/register - Registra um novo coletor
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { createCollector } from '@/lib/collectors/service';
import { publicRegistrationSchema } from '@/lib/collectors/schemas';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email/mailer';

type CollectorRegisterResponse = {
  message: string;
  collector: {
    id: string;
    pfNome: string;
    pjRazaoSocial: string;
    status: string;
  };
};

/**
 * POST /api/coletores/auth/register
 * Cria um novo coletor com status INATIVO aguardando aprovação
 */
export const POST = withApiHandler<CollectorRegisterResponse>(async (context) => {
  const { req, logger } = context;

  try {
    const body = await req.json();

    // Validate with Zod schema (public registration requires password)
    const validatedData = publicRegistrationSchema.parse(body);

    // Check if CNPJ already exists
    const cnpjDigits = validatedData.pj.cnpj.replace(/\D/g, '');
    const existingCnpj = await prisma.collector.findUnique({
      where: { pjCnpj: cnpjDigits },
    });

    if (existingCnpj) {
      throw new ApiError({
        code: 'CNPJ_EXISTS',
        message: 'Já existe um cadastro com este CNPJ',
        status: 400,
      });
    }

    // Check if CPF already exists
    const cpfDigits = validatedData.pf.cpf.replace(/\D/g, '');
    if (cpfDigits) {
      const existingCpf = await prisma.collector.findUnique({
        where: { pfCpf: cpfDigits },
      });

      if (existingCpf) {
        throw new ApiError({
          code: 'CPF_EXISTS',
          message: 'Já existe um cadastro com este CPF',
          status: 400,
        });
      }
    }

    // Check if Email already exists
    if (validatedData.pf.email) {
      const existingEmail = await prisma.collector.findUnique({
        where: { pfEmail: validatedData.pf.email },
      });

      if (existingEmail) {
        throw new ApiError({
          code: 'EMAIL_EXISTS',
          message: 'Já existe um cadastro com este e-mail',
          status: 400,
        });
      }
    }

    // Hash password from form
    const passwordHash = await bcrypt.hash(validatedData.pf.password, 10);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create collector with BLOCKED status (waiting for email verification)
    const collector = await createCollector(validatedData);

    // Update collector with email verification token and BLOCKED status
    await prisma.collector.update({
      where: { id: collector.id },
      data: {
        status: 'BLOCKED', // Override default ACTIVE status from createCollector
        pfEmailVerificationToken: emailVerificationToken,
        pfEmailVerified: false,
      },
    });

    logger.info('collector_registered', { collectorId: collector.id, status: 'BLOCKED' });

    // Store password hash
    await prisma.collectorCredential.create({
      data: {
        collectorId: collector.id,
        passwordHash,
      },
    });

    // Save documents if provided
    if (validatedData.documents) {
      const documentsToSave = [];

      // CNH files
      if (validatedData.documents.cnhFiles && validatedData.documents.cnhFiles.length > 0) {
        for (const file of validatedData.documents.cnhFiles) {
          if (file.url) {
            documentsToSave.push({
              type: 'cnh',
              filename: file.name || 'cnh',
              url: file.url,
            });
          }
        }
      }

      // CRLV file
      if (validatedData.documents.crlvFile && validatedData.documents.crlvFile.length > 0) {
        const file = validatedData.documents.crlvFile[0];
        if (file.url) {
          documentsToSave.push({
            type: 'crlv',
            filename: file.name || 'crlv',
            url: file.url,
          });
        }
      }

      // PF Address Proof file
      if (validatedData.documents.pfAddressProofFile && validatedData.documents.pfAddressProofFile.length > 0) {
        const file = validatedData.documents.pfAddressProofFile[0];
        if (file.url) {
          documentsToSave.push({
            type: 'pf_address_proof',
            filename: file.name || 'comprovante-endereco',
            url: file.url,
          });
        }
      }

      // Create documents in database
      if (documentsToSave.length > 0) {
        try {
          const result = await prisma.collectorDocument.createMany({
            data: documentsToSave.map(doc => ({
              collectorId: collector.id,
              type: doc.type,
              filename: doc.filename,
              url: doc.url,
            })),
            skipDuplicates: true,
          });
          logger.info('collector_documents_saved', { collectorId: collector.id, count: result.count });
        } catch (docError) {
          logger.error('collector_documents_error', { collectorId: collector.id, err: docError });
          // Don't fail registration if documents fail
        }
      }
    }

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/coletores/auth/confirm-email?token=${emailVerificationToken}`;

    try {
      await sendEmail({
        to: validatedData.pf.email,
        subject: 'Confirme seu e-mail - Envio Legal',
        html: `
          <h2>Bem-vindo ao Envio Legal!</h2>
          <p>Olá ${validatedData.pf.nome},</p>
          <p>Obrigado por se cadastrar como coletor autônomo. Para ativar sua conta, precisamos confirmar seu e-mail.</p>
          <p>Clique no link abaixo para verificar seu e-mail:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Verificar E-mail
          </a>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p>${verificationUrl}</p>
          <p>Após a verificação, seu cadastro será analisado por nossa equipe.</p>
          <p>Atenciosamente,<br/>Equipe Envio Legal</p>
        `,
      });
      logger.info('collector_verification_email_sent', { collectorId: collector.id });
    } catch (emailError) {
      logger.error('collector_verification_email_error', { collectorId: collector.id, err: emailError });
      // Don't fail the registration if email fails
    }

    return {
      data: {
        message: 'Cadastro criado com sucesso! Verifique seu e-mail para confirmar o cadastro.',
        collector: {
          id: collector.id,
          pfNome: collector.pf.nome,
          pjRazaoSocial: collector.pj.razaoSocial,
          status: collector.status,
        },
      },
      status: 201,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        status: 400,
        details: { errors: error },
      });
    }

    logger.error('collector_register_error', { err: error });
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Erro ao criar cadastro',
      status: 500,
    });
  }
});

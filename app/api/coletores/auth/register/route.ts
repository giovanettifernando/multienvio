/**
 * API Route para registro de coletores autônomos
 * POST /api/coletores/auth/register - Registra um novo coletor
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCollector } from '@/lib/collectors/service';
import { publicRegistrationSchema } from '@/lib/collectors/schemas';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email/mailer';

/**
 * POST /api/coletores/auth/register
 * Cria um novo coletor com status INATIVO aguardando aprovação
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema (public registration requires password)
    const validatedData = publicRegistrationSchema.parse(body);

    // Check if CNPJ already exists
    const cnpjDigits = validatedData.pj.cnpj.replace(/\D/g, '');
    const existingCnpj = await prisma.collector.findUnique({
      where: { pjCnpj: cnpjDigits },
    });

    if (existingCnpj) {
      return NextResponse.json(
        { message: 'Já existe um cadastro com este CNPJ' },
        { status: 400 }
      );
    }

    // Check if CPF already exists
    const cpfDigits = validatedData.pf.cpf.replace(/\D/g, '');
    if (cpfDigits) {
      const existingCpf = await prisma.collector.findUnique({
        where: { pfCpf: cpfDigits },
      });

      if (existingCpf) {
        return NextResponse.json(
          { message: 'Já existe um cadastro com este CPF' },
          { status: 400 }
        );
      }
    }

    // Check if Email already exists
    if (validatedData.pf.email) {
      const existingEmail = await prisma.collector.findUnique({
        where: { pfEmail: validatedData.pf.email },
      });

      if (existingEmail) {
        return NextResponse.json(
          { message: 'Já existe um cadastro com este e-mail' },
          { status: 400 }
        );
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

    console.info('[register] COLLECTOR_CREATED: ID', collector.id, '- Status: BLOCKED, awaiting email verification');

    // Store password hash
    await prisma.collectorCredential.create({
      data: {
        collectorId: collector.id,
        passwordHash,
      },
    });

    // Save documents if provided
    console.info('[register] DOCUMENTS_CHECK: Has documents?', !!validatedData.documents);
    if (validatedData.documents) {
      console.info('[register] DOCUMENTS_STRUCTURE:', {
        cnhFiles: validatedData.documents.cnhFiles?.length || 0,
        crlvFile: validatedData.documents.crlvFile?.length || 0,
        pfAddressProofFile: validatedData.documents.pfAddressProofFile?.length || 0,
      });

      const documentsToSave = [];

      // CNH files
      if (validatedData.documents.cnhFiles && validatedData.documents.cnhFiles.length > 0) {
        console.info('[register] DOCUMENTS_CNH: Processing', validatedData.documents.cnhFiles.length, 'files');
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
      console.info('[register] DOCUMENTS_TO_SAVE:', documentsToSave.length, 'total documents with URLs');
      if (documentsToSave.length > 0) {
        console.info('[register] DOCUMENTS_DETAILS:', JSON.stringify(documentsToSave, null, 2));
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
          console.info('[register] DOCUMENTS_SAVED:', result.count, 'documents created for collector', collector.id);
        } catch (docError) {
          console.error('[register] DOCUMENTS_SAVE_ERROR:', docError);
          // Don't fail registration if documents fail
        }
      } else {
        console.warn('[register] DOCUMENTS_EMPTY: No documents have URLs to save');
      }
    } else {
      console.warn('[register] DOCUMENTS_NULL: No documents provided in payload');
    }

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/coletores/auth/confirm-email?token=${emailVerificationToken}`;

    console.info('[register] EMAIL_VERIFICATION_SENDING: to', validatedData.pf.email, 'for collector', collector.id, '- Token:', emailVerificationToken.substring(0, 16) + '...');

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
      console.info('[register] EMAIL_VERIFICATION_SENT: Successfully sent to', validatedData.pf.email);
    } catch (emailError) {
      console.error('[register] EMAIL_VERIFICATION_FAILED: Error sending email to', validatedData.pf.email, ':', emailError);
      // Don't fail the registration if email fails
    }

    return NextResponse.json(
      {
        message: 'Cadastro criado com sucesso! Verifique seu e-mail para confirmar o cadastro.',
        collector: {
          id: collector.id,
          pfNome: collector.pf.nome,
          pjRazaoSocial: collector.pj.razaoSocial,
          status: collector.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/coletores/auth/register] Error:', error);

    // Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Erro ao criar cadastro',
      },
      { status: 500 }
    );
  }
}

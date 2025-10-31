/* eslint-disable @typescript-eslint/no-require-imports */
// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[TEST_EMAIL] Starting email test...');
    console.log('[TEST_EMAIL] Environment check:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPassword: !!process.env.EMAIL_PASSWORD,
      emailUser: process.env.EMAIL_USER,
      passwordLength: process.env.EMAIL_PASSWORD?.length,
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');

    const user = process.env.EMAIL_USER || 'enviolegal@app.neoera.com.br';
    const pass = process.env.EMAIL_PASSWORD || 'Jedi2025@#';

    console.log('[TEST_EMAIL] Creating transporter...');
    const transporter = nodemailer.createTransport({
      host: 'smtp.titan.email',
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
      logger: true, // Enable logging
      debug: true, // Enable debug output
    });

    console.log('[TEST_EMAIL] Verifying connection...');
    await transporter.verify();
    console.log('[TEST_EMAIL] Connection verified!');

    console.log('[TEST_EMAIL] Sending test email...');
    const info = await transporter.sendMail({
      from: `"Envio Legal Test" <${user}>`,
      to: user,
      subject: 'Test Email from Next.js API Route',
      text: 'This is a test email from the Next.js API route.',
      html: '<p>This is a test email from the Next.js API route.</p>',
    });

    console.log('[TEST_EMAIL] Email sent successfully!', info.messageId);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('[TEST_EMAIL] Error:', error);
    const err = error as { message?: string; code?: string; response?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unknown error',
        code: err.code,
        response: err.response,
      },
      { status: 500 }
    );
  }
}

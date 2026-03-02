import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (!env.SMTP_HOST) {
    // Create a test account for development
    console.log('[Email] No SMTP config; using console transport (emails will be logged, not sent)');
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = getTransporter();

    const info = await transport.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    // For stream transport (dev mode), log the email
    if (!env.SMTP_HOST) {
      console.log('[Email] Would send:', {
        to: options.to,
        subject: options.subject,
        text: options.text?.slice(0, 200),
      });
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown email error';
    console.error('[Email] Send failed:', error);
    return { success: false, error };
  }
}

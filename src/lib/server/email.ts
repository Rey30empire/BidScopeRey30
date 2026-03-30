import { randomUUID } from 'node:crypto';

export interface EmailAttachment {
  filename: string;
  contentBase64: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

const DEFAULT_PROVIDER = 'resend';
const DEFAULT_RESEND_FROM = 'BitScopeRey30 <onboarding@resend.dev>';

function getProviderName(): string {
  return (process.env.EMAIL_PROVIDER_NAME || DEFAULT_PROVIDER).trim().toLowerCase();
}

function getFromAddress(): string {
  const provider = getProviderName();
  if (provider === 'resend') {
    return process.env.EMAIL_FROM?.trim() || DEFAULT_RESEND_FROM;
  }

  return process.env.EMAIL_FROM?.trim() || '';
}

export function getEmailConfigurationError(): string | null {
  const provider = getProviderName();

  if (provider !== 'resend') {
    return `Unsupported EMAIL_PROVIDER_NAME "${provider}". Use "resend" for this build.`;
  }

  if (!process.env.EMAIL_PROVIDER_API_KEY?.trim()) {
    return 'EMAIL_PROVIDER_API_KEY is missing.';
  }

  if (!getFromAddress()) {
    return 'EMAIL_FROM is missing.';
  }

  return null;
}

export async function sendEstimateEmail(options: SendEmailOptions): Promise<{ id: string; provider: string }> {
  const provider = getProviderName();
  const configError = getEmailConfigurationError();

  if (configError) {
    throw new Error(configError);
  }

  if (provider !== 'resend') {
    throw new Error(`Unsupported email provider: ${provider}`);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.contentBase64,
      })),
    }),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!response.ok || !payload?.id) {
    const message = payload?.message || `Email provider error (${response.status})`;
    throw new Error(message);
  }

  return {
    id: payload.id,
    provider,
  };
}

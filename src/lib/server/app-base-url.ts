import { EstimateWorkflowValidationError } from '@/lib/server/estimate-preflight-service';

type BaseUrlSource = 'env' | 'request' | 'fallback';

export interface ResolvedAppBaseUrl {
  url: string;
  source: BaseUrlSource;
  isLocal: boolean;
  isSecure: boolean;
}

function normalizeBaseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(hostname.toLowerCase());
}

export function getRequestOrigin(request: Request | { headers: Headers; url: string }) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  if (forwardedProto && forwardedHost) {
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
  }

  try {
    return normalizeBaseUrl(new URL(request.url).origin);
  } catch {
    return null;
  }
}

export function resolveAppBaseUrl(input?: {
  requestOrigin?: string | null;
  fallbackAbsoluteUrl?: string | null;
}) {
  const envUrl = normalizeBaseUrl(process.env.APP_BASE_URL);
  if (envUrl) {
    const parsed = new URL(envUrl);
    return {
      url: envUrl,
      source: 'env' as const,
      isLocal: isLocalHostname(parsed.hostname),
      isSecure: parsed.protocol === 'https:',
    };
  }

  const requestUrl = normalizeBaseUrl(input?.requestOrigin);
  if (requestUrl) {
    const parsed = new URL(requestUrl);
    return {
      url: requestUrl,
      source: 'request' as const,
      isLocal: isLocalHostname(parsed.hostname),
      isSecure: parsed.protocol === 'https:',
    };
  }

  const fallbackUrl = normalizeBaseUrl(input?.fallbackAbsoluteUrl);
  if (fallbackUrl) {
    const parsed = new URL(fallbackUrl);
    return {
      url: fallbackUrl,
      source: 'fallback' as const,
      isLocal: isLocalHostname(parsed.hostname),
      isSecure: parsed.protocol === 'https:',
    };
  }

  return null;
}

function allowLocalDeliveryLinks(recipientEmail?: string | null) {
  void recipientEmail;
  return (process.env.ALLOW_LOCAL_DELIVERY_LINKS || 'false').trim().toLowerCase() === 'true';
}

export function assertSendableAppBaseUrl(
  baseUrl: ResolvedAppBaseUrl | null,
  options?: {
    recipientEmail?: string | null;
  },
) {
  if (!baseUrl) {
    throw new EstimateWorkflowValidationError(
      'Estimate delivery links are not configured. Set APP_BASE_URL or send from the deployed site so secure view links can resolve correctly.',
      { statusCode: 400 },
    );
  }

  if (baseUrl.isLocal && !allowLocalDeliveryLinks(options?.recipientEmail)) {
    throw new EstimateWorkflowValidationError(
      'Estimate delivery is blocked because the secure link base is local-only. Configure APP_BASE_URL to your public HTTPS app URL before sending client estimates.',
      { statusCode: 400 },
    );
  }

  if (!baseUrl.isLocal && !baseUrl.isSecure) {
    throw new EstimateWorkflowValidationError(
      'Estimate delivery is blocked because the secure link base is not HTTPS. Configure APP_BASE_URL to a public HTTPS URL before sending client estimates.',
      { statusCode: 400 },
    );
  }

  return baseUrl;
}

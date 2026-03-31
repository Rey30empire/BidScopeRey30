import type { EstimateDocumentVersion } from '@/lib/estimate';
import type { EstimatePremiumRenderModel } from '@/lib/estimates/estimate-render-model';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function metaValue(model: EstimatePremiumRenderModel, label: string) {
  return model.metaFields.find((field) => field.label === label)?.value || '';
}

export function buildEstimateDeliveryEmailHtml(input: {
  model: EstimatePremiumRenderModel;
  documentVersion: EstimateDocumentVersion;
  recipientName?: string;
  secureViewUrl: string;
  secureDownloadUrl: string;
  pixelUrl?: string | null;
}) {
  const { model } = input;
  const recipientName = input.recipientName?.trim();
  const previewFields = model.infoLeft.slice(0, 5);
  const detailNotes = [...model.clarifications, ...model.qualifications].slice(0, 4);
  const summaryRows = model.summaryRows.slice(0, 4);
  const subtitle = model.branding.subtitle.toUpperCase();

  return `
    <div style="margin:0;padding:30px 16px;background:#f6efe2;color:#24344d;font-family:Arial,sans-serif;">
      <div style="max-width:860px;margin:0 auto;border:1px solid #c6a774;background:#fbf5ea;padding:16px;box-shadow:0 24px 56px rgba(74,53,25,0.16);">
        <div style="border:1px solid rgba(183,146,95,0.64);background:linear-gradient(180deg,rgba(255,255,255,0.42),rgba(251,245,234,0.98));padding:22px 22px 24px 22px;">
          <div style="display:grid;grid-template-columns:1fr 210px;gap:16px;align-items:start;">
            <div style="text-align:center;padding-top:2px;">
              <div style="font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#a17d45;">${escapeHtml(model.branding.companyName)}</div>
              <div style="margin:8px auto 0 auto;height:1px;max-width:240px;background:#d2b88f;"></div>
              <div style="margin-top:12px;font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:1;color:#213351;">${escapeHtml(model.estimateTitle)}</div>
              <div style="margin-top:10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a17d45;">${escapeHtml(subtitle)}</div>
            </div>
            <div style="border:1px solid #d7c4a4;background:rgba(255,255,255,0.45);padding:12px 14px;">
              ${model.metaFields
                .map(
                  (field, index) => `
                    <div style="display:flex;justify-content:space-between;gap:12px;padding:${index === 0 ? '0 0 8px 0' : '8px 0'};${index < model.metaFields.length - 1 ? 'border-bottom:1px solid #dfcfb6;' : ''}">
                      <span style="font-size:12px;color:#7a6342;">${escapeHtml(field.label)}</span>
                      <strong style="font-size:12px;color:#213351;">${escapeHtml(field.value)}</strong>
                    </div>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div style="margin-top:18px;border:1px solid #dccbb1;background:rgba(255,255,255,0.46);padding:14px 16px;">
            <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:18px;">
              <div>
                ${previewFields
                  .map(
                    (field) => `
                      <div style="margin:0 0 8px 0;font-size:13px;line-height:1.55;color:#26344a;">
                        <strong style="display:inline-block;min-width:88px;color:#4d3a1f;">${escapeHtml(field.label)}</strong>
                        <span>${escapeHtml(field.value)}</span>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
              <div style="border:1px solid #dac7ab;background:#fffdf9;padding:12px 14px;">
                <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a17d45;">Estimate Total</div>
                <div style="margin-top:6px;font-size:30px;font-weight:700;color:#213351;">${escapeHtml(model.finalTotal)}</div>
                <div style="margin-top:8px;font-size:12px;color:#6a5738;">${escapeHtml(model.estimateSubtitle)}</div>
              </div>
            </div>
          </div>

          <div style="margin-top:14px;border:1px solid #dfcfb8;background:#fffdf9;padding:12px 16px;text-align:center;font-size:14px;line-height:1.65;color:#6a5738;font-style:italic;">
            ${escapeHtml(model.preliminaryNote)}
          </div>

          <div style="margin-top:18px;display:grid;grid-template-columns:1.05fr 0.95fr;gap:18px;">
            <div style="border:1px solid #d7c4a4;background:rgba(255,255,255,0.42);padding:15px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#213351;">Official Delivery</div>
              <p style="margin:12px 0 0 0;font-size:13px;line-height:1.75;color:#314158;">
                ${recipientName ? `Hello ${escapeHtml(recipientName)}, ` : ''}your estimate package is ready. Open the secure portal to review the official premium estimate in-browser, or download the same PDF attached to this email.
              </p>
              <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
                <a href="${input.secureViewUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #213351;background:#213351;color:#fff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Open Secure View</a>
                <a href="${input.secureDownloadUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #a17d45;background:#f5e6c7;color:#4f3c20;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Download PDF</a>
              </div>
            </div>

            <div style="border:1px solid #d7c4a4;background:rgba(255,255,255,0.42);padding:15px;">
              <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #deceb5;padding-bottom:9px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#213351;">Summary</span>
                <strong style="font-size:22px;color:#213351;">${escapeHtml(model.finalTotal)}</strong>
              </div>
              <div style="margin-top:10px;">
                ${summaryRows
                  .map(
                    (row) => `
                      <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #e5d9c6;font-size:13px;color:#26344a;">
                        <span>${escapeHtml(row.label)}</span>
                        <strong>${escapeHtml(row.value)}</strong>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div style="margin-top:18px;border:1px solid #d7c4a4;background:rgba(255,255,255,0.42);padding:15px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#213351;">Clarifications & Qualifications</div>
            <ul style="margin:12px 0 0 0;padding:0 0 0 18px;font-size:13px;line-height:1.75;color:#314158;">
              ${detailNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>

          <div style="margin-top:16px;border-top:1px solid #dccbb1;padding-top:16px;text-align:center;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#4f3d23;">${escapeHtml(model.signatureName)}</div>
            <div style="margin-top:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8f6e3f;">${escapeHtml(model.footerGeneratedByText)}</div>
            <p style="margin:10px 0 0 0;font-size:11px;line-height:1.6;color:#6a5738;">
              Secure portal opens are treated as direct tracked events. Pixel-based email opens, if enabled, are inferential only and may be affected by image blocking, privacy protections, or caching.
            </p>
          </div>
        </div>
      </div>
      ${input.pixelUrl ? `<img src="${input.pixelUrl}" alt="" width="1" height="1" style="display:block;border:0;outline:none;text-decoration:none;" />` : ''}
    </div>
  `.trim();
}

export function buildEstimateDeliveryEmailText(input: {
  model: EstimatePremiumRenderModel;
  documentVersion: EstimateDocumentVersion;
  secureViewUrl: string;
  secureDownloadUrl: string;
}) {
  const project = input.model.infoLeft.find((field) => field.label === 'Project')?.value || '';
  const client = input.model.infoLeft.find((field) => field.label === 'Client / GC')?.value || '';
  const total = input.model.finalTotal;

  return [
    input.model.branding.companyName,
    input.model.estimateTitle,
    '',
    `Project: ${project}`,
    `Client / GC: ${client}`,
    `Estimate #: ${metaValue(input.model, 'Estimate #')}`,
    `Date: ${metaValue(input.model, 'Date')}`,
    `Version: ${metaValue(input.model, 'Version')}`,
    `Valid for: ${metaValue(input.model, 'Valid for')}`,
    `Total: ${total}`,
    '',
    input.model.preliminaryNote,
    '',
    `Secure view: ${input.secureViewUrl}`,
    `Secure download: ${input.secureDownloadUrl}`,
    '',
    'Secure portal opens are treated as direct tracked events. Pixel-based email opens are inferential only and may be affected by image blocking, privacy protections, or caching.',
    '',
    input.model.footerGeneratedByText,
  ].join('\n');
}

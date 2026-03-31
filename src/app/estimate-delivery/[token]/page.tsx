import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { EstimateDocumentVersion } from '@/lib/estimate';
import { buildEstimatePremiumViewModel } from '@/lib/estimates/estimate-premium-view-model';
import { resolvePremiumBranding } from '@/lib/pdf/pdf-branding';
import { buildEstimateDocumentContext } from '@/lib/server/estimate-document-service';
import { recordEstimateOpenEvent, resolveEstimateSendByToken } from '@/lib/server/open-tracking-service';

export const dynamic = 'force-dynamic';

function metaValue(
  model: ReturnType<typeof buildEstimatePremiumViewModel>,
  label: string,
) {
  return model.metaFields.find((field) => field.label === label)?.value || '';
}

export default async function EstimateDeliveryPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const send = await resolveEstimateSendByToken(token);

  if (!send) {
    notFound();
  }

  const headerList = await headers();
  const trackedOpen = await recordEstimateOpenEvent({
    token,
    sourceType: 'portal',
    requestMeta: {
      ipAddress: headerList.get('x-forwarded-for'),
      userAgent: headerList.get('user-agent'),
      referrer: headerList.get('referer'),
    },
  });

  const context = buildEstimateDocumentContext({
    project: send.estimate.project,
    estimate: send.estimate,
  });
  const branding = resolvePremiumBranding({ companyName: context.companyName });
  const model = buildEstimatePremiumViewModel({
    branding,
    context,
    documentVersion: send.documentVersion as EstimateDocumentVersion,
  });

  const isPixelInferredOnly = trackedOpen?.event.eventType === 'pixel_open';
  const previewUrl = `/api/estimate-delivery/${token}/preview`;
  const downloadUrl = send.secureDownloadUrl || `/api/estimate-delivery/${token}/download`;
  const combinedNotes = [...model.clarifications, ...model.qualifications].slice(0, 6);
  const summaryRows = model.summaryRows.slice(0, 5);
  const primaryInfo = model.infoLeft.slice(0, 6);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ee_0%,#f7eedf_48%,#efdfc2_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-[1180px] border border-[#c8ab7b] bg-[#fbf5ea] p-4 shadow-[0_28px_80px_rgba(74,53,25,0.18)]">
        <div className="border border-[#b7925f]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.48),rgba(251,245,234,0.98))] px-5 py-6 md:px-8 md:py-8">
          <section className="grid gap-6 lg:grid-cols-[1fr_230px]">
            <div className="text-center lg:pl-24">
              <p className="text-xs uppercase tracking-[0.32em] text-[#a17d45]">{model.branding.companyName}</p>
              <div className="mx-auto mt-3 h-px max-w-xs bg-[#d2b88f]" />
              <h1 className="mt-5 font-serif text-4xl leading-none text-[#213351] md:text-6xl">{model.estimateTitle}</h1>
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#a17d45]">{model.branding.subtitle}</p>
            </div>

            <div className="border border-[#cab08a] bg-white/40 p-4 text-sm text-[#213351]">
              <div className="space-y-3">
                {model.metaFields.map((field, index) => (
                  <div
                    key={field.label}
                    className={`flex justify-between gap-4 ${index < model.metaFields.length - 1 ? 'border-b border-[#d9c7ab] pb-2' : ''}`}
                  >
                    <span className="text-[#7d6744]">{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto mt-6 h-px max-w-xl bg-[#d2b88f]" />

          <section className="mt-6 border border-[#d8c7ae] bg-white/40 px-5 py-4 text-center">
            <p className="text-sm italic leading-7 text-[#6a5738]">{model.preliminaryNote}</p>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-6">
              <div className="border border-[#d7c4a4] bg-white/35 p-5">
                <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-2 text-[15px] text-[#26344a]">
                    {primaryInfo.map((field) => (
                      <p key={field.label}>
                        <span className="inline-block min-w-[102px] font-semibold text-[#4d3a1f]">{field.label}</span>
                        <span>{field.value}</span>
                      </p>
                    ))}
                  </div>
                  <div className="border border-[#d8c6a9] bg-[#fffdf9]/80 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#a17d45]">Delivery Status</p>
                    <p className="mt-3 text-3xl font-semibold text-[#213351]">{model.finalTotal}</p>
                    <div className="mt-4 space-y-2 text-sm text-[#4d3a1f]">
                      <p><strong>Portal event:</strong> {trackedOpen?.event.eventType || 'portal_open'}</p>
                      <p><strong>Open count:</strong> {trackedOpen?.openCount || send.openCount || 1}</p>
                      <p><strong>Version:</strong> {model.estimateSubtitle}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[#d7c4a4] bg-white/35 p-5">
                <div className="flex items-center justify-between gap-4 border-b border-[#deceb5] pb-3">
                  <h2 className="font-serif text-3xl text-[#213351]">Summary</h2>
                  <span className="text-2xl font-semibold text-[#8b6938]">{model.finalTotal}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between border-b border-[#e5d9c6] pb-3 text-sm text-[#26344a] last:border-b-0 last:pb-0">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[#d7c4a4] bg-white/35 p-5">
                <h3 className="font-serif text-2xl text-[#213351]">Clarifications & Qualifications</h3>
                <ul className="mt-4 space-y-2 text-sm leading-7 text-[#314158]">
                  {combinedNotes.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950">
                <p>
                  This portal open is recorded as a direct tracked event. Secure downloads are tracked separately. Pixel-based email opens, if present, are inferential only and may be limited by image blocking, caching, or privacy protections.
                </p>
                {isPixelInferredOnly ? (
                  <p className="mt-3">
                    A prior email open may have been inferred through a tracking pixel, which is not treated as a guaranteed human view.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="border border-[#d7c4a4] bg-white/35 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-serif text-3xl text-[#213351]">Official Premium Estimate Preview</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6a5738]">
                      This embedded preview is the same official premium estimate package generated by the app. The portal tracks the real opening event here, and the download button below records a distinct secure download event.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={downloadUrl}
                      className="inline-flex items-center justify-center border border-[#213351] bg-[#213351] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1a2f52]"
                    >
                      Download PDF
                    </Link>
                    <Link
                      href={previewUrl}
                      target="_blank"
                      className="inline-flex items-center justify-center border border-[#a17d45] bg-[#f5e6c7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#4f3c20] transition hover:bg-[#efddb8]"
                    >
                      Open Fullscreen Preview
                    </Link>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden border border-[#c8ab7b] bg-[#f7efe0] shadow-[0_18px_40px_rgba(74,53,25,0.12)]">
                <iframe
                  src={previewUrl}
                  title={`${metaValue(model, 'Estimate #')} preview`}
                  className="h-[980px] w-full bg-white"
                />
              </div>
            </div>
          </section>

          <section className="mt-8 border-t border-[#dbcab0] pt-5 text-center">
            <p className="font-serif text-3xl text-[#4f3d23]">{model.signatureName}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#8f6e3f]">{model.footerGeneratedByText}</p>
          </section>
        </div>
      </div>
    </main>
  );
}

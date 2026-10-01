import type { ActivationPreview } from "@/lib/sign-in";

/**
 * "Is this you?" — whose chart an activation code opens, before it is linked.
 * The email the clinic has is shown masked; when it isn't this login's, a
 * warning, not a refusal: clinic emails go stale, get mistyped, get shared.
 */
export function ActivationConfirm({ preview, signedInAs }: { preview: ActivationPreview; signedInAs?: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-surface-muted p-4">
        <p className="text-sm text-ink-muted">This code is for</p>
        <p className="mt-0.5 text-lg font-semibold">{preview.name}</p>
        <p className="text-sm text-ink-muted">
          Born {preview.born} · {preview.clinicName}
        </p>
      </div>
      {preview.emailDiffers ? (
        <div className="rounded-lg bg-warn-tint p-4 text-sm text-warn-ink">
          The clinic has <strong>{preview.emailOnFile}</strong> on file
          {signedInAs ? (
            <>
              , but you&rsquo;re signed in as <strong>{signedInAs}</strong>
            </>
          ) : null}
          . Only continue if this record is yours.
        </div>
      ) : null}
      <p className="text-sm text-ink-muted">
        Only continue if this is <strong>you</strong>. If it&rsquo;s a family member&rsquo;s record, or not yours,
        cancel and ask the desk.
      </p>
    </div>
  );
}

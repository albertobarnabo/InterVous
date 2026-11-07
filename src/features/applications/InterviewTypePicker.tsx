"use client";
// "What kind of interview?": one tap, optional, and tapping again clears it. The choice becomes the
// interview event's title (lib/core/interviews.mjs reads it back), so Home can show which kind of
// interview goes well and which does not.
import { INTERVIEW_TYPES, interviewTypeLabel, type InterviewType } from "../../../lib/core";
import { Chip } from "@/ui";

export function InterviewTypePicker({ value, onChange }: { value: InterviewType | null; onChange: (v: InterviewType | null) => void }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-small font-medium text-ink">
        What kind of interview? <span className="font-normal text-ink-2">Optional. It shows where you do best.</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {INTERVIEW_TYPES.map((t) => (
          <Chip key={t.id} selected={value === t.id} onClick={() => onChange(value === t.id ? null : t.id)}>
            {t.short}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

/** The event title for a picked kind: its label, or null to leave the title empty. */
export const interviewTitle = (type: InterviewType | null | undefined) => interviewTypeLabel(type);

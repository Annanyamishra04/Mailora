export interface ComposeFormValues {
  recipient: string;
  purpose: string;
}

export type ComposeFormErrors = Partial<Record<keyof ComposeFormValues, string>>;

export function validateComposeForm(
  values: ComposeFormValues,
): { valid: boolean; errors: ComposeFormErrors } {
  const errors: ComposeFormErrors = {};

  if (!values.recipient.trim()) {
    errors.recipient = "Add who this email is for.";
  }

  if (!values.purpose.trim()) {
    errors.purpose = "Describe what the email needs to say.";
  } else if (values.purpose.trim().length < 6) {
    errors.purpose = "Add a little more detail so the draft has something to work with.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function isEmailContentEmpty(body: string): boolean {
  return body.trim().length === 0;
}

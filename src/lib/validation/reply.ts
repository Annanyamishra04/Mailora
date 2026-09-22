export interface ReplyFormValues {
  originalEmail: string;
}

export type ReplyFormErrors = Partial<Record<keyof ReplyFormValues, string>>;

export function validateReplyForm(
  values: ReplyFormValues,
): { valid: boolean; errors: ReplyFormErrors } {
  const errors: ReplyFormErrors = {};

  if (!values.originalEmail.trim()) {
    errors.originalEmail = "Paste or type the email you're replying to.";
  } else if (values.originalEmail.trim().length < 10) {
    errors.originalEmail = "Add a bit more of the original email so the reply has context.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

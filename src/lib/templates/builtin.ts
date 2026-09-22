import type { EmailTemplate } from "@/lib/types";

/**
 * Built-in starter templates.
 *
 * These live in application code rather than the database on purpose:
 * they're identical for every user and never change at runtime, so storing
 * them per-user (or even in one shared table) would be pure overhead for
 * no benefit. `id`s are stable strings (not UUIDs) since they're never
 * inserted into a database row — see `lib/storage/template-*` for the
 * user-owned templates that are.
 *
 * Every body uses `{{recipientName}}` / `{{yourName}}` style placeholders
 * that "Use template" leaves in place for the user to fill in — nothing
 * here invents a specific person, company, or date.
 */
export const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: "builtin-job-application",
    name: "Job Application",
    description: "Introduce yourself for an open role and attach your resume.",
    category: "job-application",
    isBuiltin: true,
    subject: "Application for {{Role Title}} — {{Your Name}}",
    body: `Dear {{Hiring Manager's Name}},

I'm writing to apply for the {{Role Title}} position at {{Company Name}}. {{One or two sentences on your relevant background and why this role interests you.}}

I've attached my resume for your review. I'd welcome the chance to talk about how my experience lines up with what your team needs.

Thank you for your time and consideration.

Best regards,
{{Your Name}}`,
  },
  {
    id: "builtin-follow-up",
    name: "Follow-up",
    description: "A polite nudge after a meeting, application, or previous email.",
    category: "follow-up",
    isBuiltin: true,
    subject: "Following up on {{topic}}",
    body: `Hi {{Name}},

I wanted to follow up on {{what you're following up on}}. {{Any brief context or reminder of the last conversation.}}

Let me know if there's anything you need from me in the meantime, or if it would help to find time to talk.

Thanks,
{{Your Name}}`,
  },
  {
    id: "builtin-meeting-request",
    name: "Meeting Request",
    description: "Ask to schedule time and suggest a purpose and rough timing.",
    category: "meeting-request",
    isBuiltin: true,
    subject: "Meeting request: {{topic}}",
    body: `Hi {{Name}},

Would you have time for a quick call to discuss {{topic}}? {{One sentence on what you'd like to cover.}}

I'm generally free {{your availability}} — happy to work around your schedule if another time is better.

Looking forward to it,
{{Your Name}}`,
  },
  {
    id: "builtin-thank-you",
    name: "Thank You",
    description: "Express thanks after an interview, meeting, or someone's help.",
    category: "thank-you",
    isBuiltin: true,
    subject: "Thank you, {{Name}}",
    body: `Hi {{Name}},

Thank you for {{what you're thanking them for}} — I really appreciate it. {{Optional: one sentence on what stood out or what you took away.}}

Thanks again,
{{Your Name}}`,
  },
  {
    id: "builtin-leave-request",
    name: "Leave Request",
    description: "Request time off and note who will cover while you're away.",
    category: "leave-request",
    isBuiltin: true,
    subject: "Leave request: {{dates}}",
    body: `Hi {{Manager's Name}},

I'd like to request leave from {{start date}} to {{end date}}. {{Optional reason, if you'd like to share one.}}

I'll make sure everything is in good shape before I'm out{{optional: and have arranged for {{colleague's name}} to cover anything urgent}}. Let me know if you'd like to discuss further.

Thank you,
{{Your Name}}`,
  },
  {
    id: "builtin-networking",
    name: "Networking",
    description: "Reach out to someone new to introduce yourself and connect.",
    category: "networking",
    isBuiltin: true,
    subject: "Introduction from {{Your Name}}",
    body: `Hi {{Name}},

{{How you found them or a mutual connection, if any.}} I'm {{brief description of who you are / what you do}}, and I'm reaching out because {{reason for connecting}}.

Would you be open to a short call sometime? No worries at all if you're not able to — I appreciate you reading this either way.

Best,
{{Your Name}}`,
  },
  {
    id: "builtin-internship-inquiry",
    name: "Internship Inquiry",
    description: "Ask about internship opportunities at a company you admire.",
    category: "internship-inquiry",
    isBuiltin: true,
    subject: "Internship inquiry — {{Your Name}}",
    body: `Dear {{Name}},

I'm {{Your Name}}, {{your year/major or background}}, and I'm reaching out to ask whether {{Company Name}} has any internship opportunities coming up{{in {{team/department}}, if relevant}}.

{{One or two sentences on why you're interested and what you'd bring.}} I've attached my resume, and I'd be glad to share more if that's helpful.

Thank you for considering my inquiry.

Best regards,
{{Your Name}}`,
  },
  {
    id: "builtin-project-update",
    name: "Project Update",
    description: "Share progress, blockers, and next steps on a project.",
    category: "project-update",
    isBuiltin: true,
    subject: "{{Project Name}} update — {{date or milestone}}",
    body: `Hi {{Name/team}},

Quick update on {{Project Name}}:

- Progress: {{what's been completed}}
- In progress: {{what's currently underway}}
- Blockers: {{anything blocking progress, or "none right now"}}
- Next steps: {{what's planned next}}

Let me know if you have questions or want to discuss any of this further.

Thanks,
{{Your Name}}`,
  },
];

export function getBuiltinTemplate(id: string): EmailTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

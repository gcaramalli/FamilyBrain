// Feedback sent to Hembrain's owner (feedback table, 0020). Labels are
// translated at display with t(label).
export type FeedbackKind = "idea" | "bug" | "other";
export type FeedbackStatus = "new" | "planned" | "done" | "declined";
export const FEEDBACK_KINDS: { id: FeedbackKind; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "bug", label: "Something's wrong" },
  { id: "other", label: "Other" },
];
export const FEEDBACK_STATUSES: { id: FeedbackStatus; label: string }[] = [
  { id: "new", label: "Sent" },
  { id: "planned", label: "Planned" },
  { id: "done", label: "Done" },
  { id: "declined", label: "Not for now" },
];

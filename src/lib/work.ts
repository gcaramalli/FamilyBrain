import type { WorkItem, WorkMeeting, WorkPerson, WorkProject, WorkRole } from "./types";

// Private work space: how items gather on a person's, a project's or a
// meeting's page. Shared by the app (/work) and the Claude connector.

export const WORK_ROLES: { id: WorkRole; label: string }[] = [
  { id: "boss", label: "Manager" },
  { id: "team", label: "My team" },
  { id: "peer", label: "Peers" },
  { id: "other", label: "Others" },
];

export const WORK_KINDS: { id: WorkItem["kind"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "give", label: "To hand over" },
  { id: "discuss", label: "To discuss" },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Exact name first, then a name starting with it ("#evp" → "EVP intelligence").
export function findByName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return rows.find((r) => norm(r.name) === n) ?? rows.find((r) => norm(r.name).startsWith(n));
}

// Quick capture: "@Anna #EVP send the brief" → person Anna, project EVP.
// "#" matches a project first, then a meeting. Unknown tags stay in the text.
export function parseCapture(line: string, people: WorkPerson[], projects: WorkProject[], meetings: WorkMeeting[]) {
  let person: WorkPerson | undefined;
  let project: WorkProject | undefined;
  let meeting: WorkMeeting | undefined;
  const words = line.split(/\s+/).filter((w) => {
    const m = w.match(/^([@#])(.+)$/);
    if (!m) return true;
    if (m[1] === "@" && !person) return !(person = findByName(people, m[2]));
    if (m[1] === "#") {
      if (!project && (project = findByName(projects.filter((p) => !p.archived), m[2]))) return false;
      if (!meeting && (meeting = findByName(meetings, m[2]))) return false;
    }
    return true;
  });
  return { title: words.join(" ").trim(), person, project, meeting };
}

// A person's page: what is theirs directly, then what sits on their projects.
export function personItems(person: WorkPerson, items: WorkItem[], projects: WorkProject[]) {
  const theirProjects = new Set(projects.filter((p) => p.person_ids.includes(person.id)).map((p) => p.id));
  return {
    direct: items.filter((i) => i.person_id === person.id),
    viaProjects: items.filter((i) => i.person_id !== person.id && !!i.project_id && theirProjects.has(i.project_id)),
  };
}

// A meeting's agenda: what was put on it, what to hand over to or discuss with
// the attendees, and what they still owe (waiting).
export function meetingAgenda(meeting: WorkMeeting, items: WorkItem[]) {
  const attendees = new Set(meeting.person_ids);
  const forAttendee = (i: WorkItem) => !!i.person_id && attendees.has(i.person_id) && !i.meeting_id;
  return {
    onAgenda: items.filter((i) => i.status === "open" && (i.meeting_id === meeting.id || (forAttendee(i) && i.kind !== "todo"))),
    waiting: items.filter((i) => i.status === "waiting" && (i.meeting_id === meeting.id || forAttendee(i))),
  };
}

// Handed over / discussed: a "give" waits on the person, the rest is done.
export function afterMeeting(item: WorkItem): Partial<WorkItem> {
  const now = new Date().toISOString();
  return item.kind === "give" && item.person_id ? { status: "waiting", waiting_since: now } : { status: "done", done_at: now };
}

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

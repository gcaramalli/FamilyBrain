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

// Priority first, then by due date, then oldest first.
export function sortItems(items: WorkItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.priority) - Number(a.priority) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.created_at.localeCompare(b.created_at),
  );
}

// Quick capture: "@Anna #EVP send the brief" → person Anna, project EVP.
// "#" matches a project first, then a meeting; a lone "!" = priority.
// Unknown tags stay in the text.
export function parseCapture(line: string, people: WorkPerson[], projects: WorkProject[], meetings: WorkMeeting[]) {
  let person: WorkPerson | undefined;
  let project: WorkProject | undefined;
  let meeting: WorkMeeting | undefined;
  let priority = false;
  const words = line.split(/\s+/).filter((w) => {
    if (w === "!") return !(priority = true);
    const m = w.match(/^([@#])(.+)$/);
    if (!m) return true;
    if (m[1] === "@" && !person) return !(person = findByName(people, m[2]));
    if (m[1] === "#") {
      if (!project && (project = findByName(projects.filter((p) => !p.archived), m[2]))) return false;
      if (!meeting && (meeting = findByName(meetings, m[2]))) return false;
    }
    return true;
  });
  return { title: words.join(" ").trim(), person, project, meeting, priority };
}

// A person's page: what is theirs directly, then what sits on their projects.
export function personItems(person: WorkPerson, items: WorkItem[], projects: WorkProject[]) {
  const theirProjects = new Set(projects.filter((p) => p.person_ids.includes(person.id)).map((p) => p.id));
  return {
    direct: items.filter((i) => i.person_id === person.id),
    viaProjects: items.filter((i) => i.person_id !== person.id && !!i.project_id && theirProjects.has(i.project_id)),
  };
}

// A meeting's agenda on `today` (YYYY-MM-DD): what was put on it, what to hand
// over to or discuss with the attendees, what they still owe (waiting), and
// what was already set aside for next time (not_before in the future).
// `forMeeting` = the points put on the meeting itself (collective), shown
// first; `byPerson` = each attendee's own points, in attendee order.
export function meetingAgenda(meeting: WorkMeeting, items: WorkItem[], today: string) {
  const attendees = new Set(meeting.person_ids);
  const forAttendee = (i: WorkItem) => !!i.person_id && attendees.has(i.person_id) && !i.meeting_id;
  const later = (i: WorkItem) => !!i.not_before && i.not_before > today;
  const candidate = (i: WorkItem) => i.status === "open" && (i.meeting_id === meeting.id || (forAttendee(i) && i.kind !== "todo"));
  const onAgenda = items.filter((i) => candidate(i) && !later(i));
  return {
    onAgenda,
    forMeeting: onAgenda.filter((i) => i.meeting_id === meeting.id),
    byPerson: meeting.person_ids
      .map((personId) => ({ personId, items: onAgenda.filter((i) => i.meeting_id !== meeting.id && i.person_id === personId) }))
      .filter((g) => g.items.length),
    nextTime: items.filter((i) => candidate(i) && later(i)),
    waiting: items.filter((i) => i.status === "waiting" && (i.meeting_id === meeting.id || forAttendee(i))),
  };
}

// Next day the meeting happens, strictly after `today` (YYYY-MM-DD). No fixed
// day: tomorrow, so it still leaves today's agenda.
export function nextMeetingDate(meeting: WorkMeeting, today: string) {
  const d = new Date(`${today}T12:00:00Z`);
  const iso = ((d.getUTCDay() + 6) % 7) + 1;
  const ahead = meeting.weekday ? (meeting.weekday - iso + 7) % 7 || 7 : 1;
  d.setUTCDate(d.getUTCDate() + ahead);
  return d.toISOString().slice(0, 10);
}

// Handed over / discussed: a "give" waits on the person, the rest is done.
export function afterMeeting(item: WorkItem): Partial<WorkItem> {
  const now = new Date().toISOString();
  return item.kind === "give" && item.person_id ? { status: "waiting", waiting_since: now } : { status: "done", done_at: now };
}

// How far back finished items are kept in view (app and Claude).
export const HISTORY_DAYS = 60;

// Per person: what's open, what they owe and since when, what got done.
export function peopleSummary(people: WorkPerson[], items: WorkItem[], done: WorkItem[]) {
  return people.map((p) => {
    const mine = items.filter((i) => i.person_id === p.id);
    const waiting = mine.filter((i) => i.status === "waiting");
    return {
      person: p.name,
      role: p.role,
      open: mine.filter((i) => i.status === "open").length,
      waiting_on_them: waiting.length,
      oldest_waiting_days: waiting.length ? Math.max(...waiting.map((i) => daysSince(i.waiting_since ?? i.created_at))) : null,
      done_recently: done.filter((i) => i.person_id === p.id).length,
    };
  });
}

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

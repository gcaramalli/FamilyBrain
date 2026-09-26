export type Role = "admin" | "member";

export type Family = { id: string; name: string };

export type Profile = {
  id: string;
  family_id: string;
  display_name: string;
  email: string | null;
  role: Role;
  color: string;
};

export type Member = {
  id: string;
  family_id: string;
  profile_id: string | null;
  name: string;
  emoji: string;
  color: string;
  birthdate: string | null;
  notes: string | null;
};

export type Invite = { email: string; family_id: string; role: Role; created_at: string };

export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  responsible_member_id: string | null;
  for_member_id: string | null;
};

export type List = { id: string; name: string; kind: "grocery" | "todo"; position: number };

export type ListItem = {
  id: string;
  list_id: string;
  title: string;
  quantity: string | null;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  assignee_member_id: string | null;
  created_at: string;
};

export type RestockSuggestion = {
  item_key: string;
  item_name: string;
  times_bought: number;
  last_bought_at: string;
  avg_interval_days: number;
  next_due_on: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  ingredients: string[];
  steps: string | null;
  tags: string[];
  prep_minutes: number | null;
  servings: number | null;
  source_url: string | null;
  favorite: boolean;
  kid_friendly: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
};

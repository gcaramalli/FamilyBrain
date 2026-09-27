# Vision

Where Hembrain is going. Read this before proposing or building a feature; `ROADMAP.md` says what comes next,
this file says why.

## North star

Hembrain is the family's long-term memory: people, dates, places, tastes, milestones and stories, kept in a
structured form that AI agents can read and add to. The calendar and the shopping list are the daily habit that
keeps the memory fed; they are not the point.

In a year, any agent the family uses (Claude on a phone today, others later) should be able to answer
"what do we give Paul's son for his 4th birthday?", "when did Charlie last see the dentist?" or "where did we go
in Provence and did we like it?" from Hembrain, and act on it.

## Principles

1. **No forms.** People say, paste, photograph or forward things; the app files them and asks for a one-tap
   confirmation. Pasting a list of 20 weddings must be enough to import them.
2. **Structured memory, not a pile.** A giant blob of text is useless to an agent. Store who / when / how we know
   them / what they like, and make it searchable. The connector (`src/lib/mcp/tools.ts`) is the agents' door.
3. **The app speaks first, but rarely.** One useful message in the evening beats ten notifications.
4. **It grows with the children.** Modules appear and disappear with age (nappies, naps, school, pocket money).
   The app *proposes* a change; it never rearranges the interface by itself.
5. **The family owns it.** A complete export any AI can read (one structured file), backups, and nothing shared
   with a third-party service without a decision.
6. **Circles of trust.** Family accounts see everything. Guests (grandmothers, the babysitter) get a secret,
   revocable link per person that shows only their pages, no login. Nothing is ever public.
7. **Between partners, consent first.** Features that touch the couple (see "Saying hard things") are built only
   if both want them, and the app never sends anything on someone's behalf.

## The memory model (to build step by step)

- **People**: the family and everyone around it (friends, relatives, friends' children), with how they relate
  to us ("Guillaume's best man", "Charlie's friend from förskola"), the language to write to them in, and notes.
- **Occasions**: birthdays, wedding anniversaries (year, "we were there"), namnsdagar if wanted; reminders a week
  before and on the day, with a message drafted in the right language that recalls a real detail.
- **Tastes**: likes, dislikes, sizes, allergies, gift ideas noted in passing ("Anna loves ceramics").
- **Places**: been there / want to go / what we thought.
- **Memories**: what happened, with whom, when, photos. The family's timeline ("one year ago today…").
- **Measurements**: Charlie's height and weight over time, drawn against the Swedish reference growth curves.
- **Health**: BVC visits, vaccines, medicines, allergies (sensitive; guests only see what is needed).

## Idea box

Not prioritised. Voting page with the first 23 ideas: https://claude.ai/artifact/2mVGsbsmbrvDv3rDaLJM2K

**Memory & social life**
- Import the list of weddings we attended; anniversary reminders with a drafted message.
- Birthdays of friends' children: reminders, gift ideas from their tastes, what we gave last year.
- Birthday parties (ours and Charlie's): guest list from People, invitations, who is coming, what to buy.
- Places map: where we went, where we want to go.
- "One year ago today" and a yearly album generated in December.

**Guests (no login, secret link)**
- A page for each grandmother: Charlie's latest photos and growth curve, what's coming up, a box to leave a
  message or a memory. Big text, nothing to install.
- Babysitter page: Charlie's routine, allergies, numbers, who picks him up; the link expires the next day.

**Between us**
- Saying hard things: I write what I feel, raw; the app helps me put it into words; I choose whether to send it
  to Jennie, from me. Only if we both want this feature.

**Charlie**
- Growth curve against Swedish references; BVC visits and vaccines coming up.
- VAB in one tap (who stays home, days per parent, reminder to declare to Försäkringskassan).
- Sizes and seasonal wardrobe; modules that come and go with age.

**Capture**
- One "+" button: speak, photograph or paste; Claude files it (event, list, person, memory, measurement).
- A family e-mail address to forward förskola/BVC/booking e-mails to.
- Siri shortcut: "Tell Hembrain…".

**Anticipation**
- Evening brief in three sentences (who does what tomorrow, what's missing, weather).
- Childcare gap detector across our calendars (e.g. one parent travelling for a week).
- Meal plans that know the week's schedule.

**Agents**
- Connector tools: `remember`, `recall` (search the memory), `get_person`, `timeline`.
- Full export (people, occasions, tastes, places, memories, events) as one file any AI can read.
- Weekly routine: summary of the week ahead plus what's running out.

## Open questions

- Which förskola app sends the notifications (Tyra, Unikum…)? Decides how we capture them.
- Where photos live (Supabase Storage vs. linking to iCloud/Google Photos).
- How much of a person's record a guest link may show.

# Channels — where we reach people, and how a number comes out

**No user data until #52's dashboard (owner, #75).** Until then, every
"how a number comes out" below is a plan, not a practice.

**This repo is public.** Nothing that names or points to a person goes in
`firm/marketing/`, an issue or a PR: no names, emails, invite codes, code
notes, or a row that is one identifiable learner. Totals only, and any
count of 1 or 2 written into the repo becomes **"<3"** (0 is fine; it points
at nobody). `funnel.sql` prints its pasteable sections that way; its
per-code and per-activity sections are owner's eyes only. Kids use
Langue.

| Channel | Can marketing read it? | Can marketing write it? | How a number comes out | Status (2026-10-15) |
|---|---|---|---|---|
| **Invite codes** (`/learn/invites`, admins only) | No. The owner can, and so can `funnel.sql` run by the owner. | No. The owner mints codes. | Codes made, used, with someone practising (funnel.sql §4, pasteable). Per code: §8, owner's eyes only. | Unmeasured until #52's dashboard exists (owner, #75). |
| **The invite message** (the "Copy invite email" button, `web/src/lib/invite-email.ts`) | Yes (code). | Draft only. The app copy changes via #72, built by night shift. | Codes sent (owner keeps count) → joined → practising after 2 weeks (funnel.sql §3, §4). | Off-message ("AI tutor"); new draft in `drafts/invite-message.md`. |
| **Short invite for chats** (WhatsApp, iMessage) | No. | Draft only; the owner pastes it. | The same as above, if the owner uses a separate code for chat invites. | Draft in `drafts/invite-message.md` §2. |
| **Front page `/`, `/register`, `/login`** | Yes (code). | Draft only, via #72. | None. There are no analytics, by design, until #52. | Off-message ("AI language practice"); new draft in `drafts/what-is-langue.md`. |
| **One-page "What is Langue"** | Yes. | Draft only. | None directly. The owner can tell us who asked for it. | Draft = the front page text. |
| **FAQ** (learners and parents) | Yes. | Draft only. | Questions people still ask after reading it, relayed by the owner. | Draft in `drafts/faq.md`. |
| **Weekly "what's new"** (group chat) | No. | Draft only; the owner posts it. | Replies and feedback the owner relays; each becomes an issue. | First draft: `drafts/whats-new-2026-10-15.md`. |
| **The owner's LinkedIn** (their personal account; the owner's decision, 2026-10-20, #124) | No. The owner reads their post analytics and messages. | Draft only. The owner posts, replies, and sends each invite by private message. Nothing is automated (LinkedIn User Agreement §8.2). | Each post's impressions and reactions, messages asking for an invite, and invites sent, as counts the owner reports → the campaign code's #109 row. | Campaign 002 drafted (`drafts/linkedin-posts.md`); not posted. |
| **Reddit** | No. Marketing's tools can't fetch reddit.com, so the owner pastes threads, with usernames removed. | Nothing yet. Listen only, until two campaigns reach "do more" (PIPELINE's plan). | None yet. | Listening. r/languagelearning reportedly takes resources only in a weekly thread (secondhand; the owner checks each subreddit's rules). |
| **Leaderboards** (per group) | No (in-app, per learner). | No. | Group size per code (funnel.sql §8, owner's eyes only). | Live. |
| **Streak reminders** (web push) | No. | Wording via issue only: #73, decided (gain framing), not shipped yet. | Learners with reminders on (funnel.sql §7). Opens and returns: unmeasured until #52. | Live; wording contradicts "never lost" (#73). |
| **Learning events and dashboard** (#52) | Not built. | Not built. | Who comes back, which features get used. | Until it ships, say "unmeasured"; never estimate. |

## Not channels (on purpose)

- No ads, tracking pixels or third-party analytics, and no Langue social
  accounts. Opening any of these is the owner's decision (`needs-owner`). The
  owner's own LinkedIn is a channel by their decision (2026-10-20, #124): its
  posts are theirs, drafted by marketing.
- Nothing automated on anyone's account: no bot posts, replies, likes or
  messages (LinkedIn User Agreement §8.2; MARKETING.md).
- No email lists. Langue sends no email; invites go person to person.
- Nothing aimed at children. Materials speak to parents and adults.

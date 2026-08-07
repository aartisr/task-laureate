# Task-Laureate Growth Implementation Plan

## Purpose

This is the execution plan for growing Task-Laureate sustainably toward one million users. It prioritizes a trustworthy product, measurable retention, and repeatable distribution over vanity traffic or unsupported marketing claims.

## Product reality and positioning

Task-Laureate already provides private task workspaces, lists, tasks, due dates, progress, search, activity history, undo, account-scoped persistence, invitations, collaboration roles, and reminders. It does **not** yet provide AI task decomposition, public blueprints, a template gallery, GitHub/Slack/Calendar integrations, or browser extensions.

Do not market unshipped capabilities. The initial 90-day positioning is:

> The calm, private task workspace for students and independent builders managing real deadlines.

The product should earn expansion into team workflows, integrations, and AI assistance through repeated user demand and measured retention.

## Definitions and operating metrics

The one-million-user goal means one million registered accounts. It must be paired with an active-user and retention target; registrations alone do not demonstrate product value.

| Metric | Initial target | Definition |
| --- | ---: | --- |
| Activation | Set baseline, then improve weekly | User creates a list, creates at least three tasks, and sets one due date in the first session. |
| Week-4 retention | At least 20% of activated users | Activated users who return and take a meaningful task action in week four. |
| Invite/share rate | At least 10% of activated users | Activated users who send at least one collaboration invite. |
| Qualified-visit conversion | At least 3% | Qualified public visits that create an account. |
| Mutation reliability | At least 99.9% | Successful create, update, complete, delete, restore, and share operations. |
| North-star metric | Improve every week | Weekly active users who update or complete a task on two separate days. |

## Measurement design

Vercel Analytics is installed, but product decisions require privacy-conscious funnel events and error monitoring. Add an analytics adapter so the provider can be changed without rewriting product code.

Required events:

```text
landing_viewed
demo_started
signup_started
signup_completed
first_list_created
first_task_created
first_due_date_set
first_task_completed
first_list_shared
invite_accepted
reminder_enabled
day_1_returned
day_7_returned
sync_failed
```

Rules:

- Do not send task titles, notes, email addresses, raw user identifiers, or secret values as analytics properties.
- Use an anonymous/session identifier before sign-in and a non-PII account identifier after sign-in.
- Record release versions and product errors alongside funnel data.
- Review activation, D1/D7/D28 retention, invite acceptance, source conversion, and reliability weekly.

## Phase 1: Foundation and proof of value (0–1,000 users) — Implementation complete

The repository implementation for this phase is complete. The remaining launch activities—domain ownership/configuration, enabling an approved analytics collector, recruiting participants, interviews, and collecting two weeks of production evidence—require operational authority and cannot truthfully be marked complete in source code. See [CHANGELOG.md](CHANGELOG.md) for the shipped scope and limits.

### Objectives

- Make the public promise accurate and consistent.
- Establish the activation and retention baseline.
- Find 10–20 highly retained users before scaling acquisition.

### Workstream A: public launch surface

1. Select one canonical production domain.
2. Update canonical URLs, sitemap, `robots.txt`, `llms.txt`, Open Graph metadata, README links, and deployment settings to use that exact domain.
3. Publish a concise product page explaining current features, privacy boundaries, and self-hosting.
4. Record a 45–60 second real-product demo: create list, add task/due date, enable reminder, share, complete, and undo.
5. Add a signed-out sample workspace so visitors can understand the product before they are asked to register.
6. Require sign-in only at the persistence boundary; preserve drafts and return users to their original task after authentication.

### Workstream B: product feedback

Recruit 30–50 people from the initial audience: students, student organizations, hackathon teams, makers, and open-source contributors. Hold weekly interviews around:

1. What caused you to try Task-Laureate?
2. What did you expect to achieve in the first ten minutes?
3. What made you return, or stop returning?

Prioritize issues observed repeatedly. Do not build a large roadmap from a single request.

### Workstream C: activation and reliability

- Instrument the full funnel and build a weekly dashboard.
- Audit sign-in, draft recovery, first-list, first-task, due-date, reminder, and invitation paths.
- Add error monitoring, release markers, and an incident owner.
- Publish a lightweight changelog that explains user-visible changes.

### Exit criteria

- The public domain and every public metadata URL agree.
- Funnel data is available for at least two weeks.
- At least 10 users show repeated weekly usage.
- No unresolved high-severity data-loss, sign-in, authorization, or save-state defect exists.

## Phase 2: Repeatable acquisition and retention (1,000–10,000 users)

Build only one distribution loop at a time and keep the winner.

### Loop A: collaboration

Task-Laureate already has invitation and role foundations, making collaboration the first growth loop.

1. Improve invitation copy, recipient preview, role explanations, and post-acceptance onboarding.
2. Track inviter source, invitation sent, invite acceptance, and recipient first action.
3. Ensure shared-list flows work on mobile and across signed-out/sign-in transitions.
4. Add lightweight collaborator activity visibility only after invitation usage validates the need.
5. Measure accepted invites per activated user (K-factor) and recipient activation.

### Loop B: curated templates

Build a small, high-quality template library before accepting arbitrary public content.

Initial templates:

- Exam and assignment planning
- Hackathon project plan
- Research project workflow
- SaaS launch checklist
- Open-source contribution workflow

Each template needs a useful public page, preview, "Use this template" action, structured metadata, and source-to-activation tracking. Avoid mass-producing thin SEO pages.

### Loop C: useful public content

Publish one original, practical resource each week, based on real product use:

- Planning a research project without missing deadlines
- A task system for hackathon teams
- How Task-Laureate protects private workspaces
- Open-source task management with honest sync status

Share where the material is genuinely useful: relevant communities, open-source directories, student/maker networks, Show HN, Product Hunt, Reddit, and developer publications. Do not buy links, automate comments, fabricate testimonials, or promise rankings.

### Exit criteria

- Activation, D7 retention, and invite acceptance are measured by acquisition source.
- At least 15% of newly activated users start from a template, or templates are reprioritized.
- At least 10% of activated users send an invite and at least 30% of recipients activate.
- A content or community channel produces repeatable qualified traffic.

## Phase 3: Product-market expansion (10,000–100,000 users)

Advance only after activation and retention are stable.

### 1. Public blueprint sharing

Implement a deliberate publishing model:

```text
Private list
  -> explicit publication confirmation
  -> sanitized immutable public blueprint
  -> public preview
  -> viewer forks into own workspace
```

Requirements:

- Explicit user confirmation before publication.
- Warnings for sensitive content and secrets.
- Revocation and versioning.
- Abuse reporting, moderation, and rate limits.
- Public pages contain no private account data.
- Track publish, view, fork, and activated-fork events.

### 2. Calendar export

Start with secure ICS export. Add one-way calendar integration only after calendar export adoption is demonstrated. Do not start with two-way synchronization; conflict handling and support cost are disproportionately high.

### 3. GitHub integration

Start with a narrow, reliable integration:

- OAuth application installation for selected repositories.
- One-way import of labeled GitHub Issues into a selected Task-Laureate list.
- Verified webhooks, idempotency keys, retry queues, rate limits, audit records, and revocation support.

### 4. Opt-in AI planning

AI task planning is a distinct feature, not a marketing veneer.

- Offer an editable preview; never silently persist generated tasks.
- Make data use, model provider, limits, and cost controls explicit.
- Add quota management, abuse prevention, evaluations, feedback collection, and failure reporting.
- Require retention and satisfaction evidence before expanding access.

### 5. Slack and Discord

Add chat integrations only after teams repeatedly request the same workflow. Permission scope, support burden, and workspace security must be solved before launch.

### Exit criteria

- Public sharing has clear safety controls and a measurable fork-to-activation loop.
- At least 10 design partners validate a shared integration need.
- Any AI planning feature meets preset quality, reliability, privacy, and gross-margin thresholds.

## Phase 4: Operational scale (100,000–1,000,000 users)

At this stage, reliability and trust are growth features.

### Product

- Team workspaces and organization controls.
- Audit history and real-time collaboration indicators.
- Browser extension for capture only after web capture use proves demand.
- Hosted team plans and self-hosted enterprise support with clear security and support boundaries.
- Locale-aware onboarding and templates, prioritized by observed demand.

### Platform and operations

- Load-test authenticated reads/writes, invitation acceptance, reminder delivery, blueprint forks, and authentication flows.
- Define service-level objectives, error budgets, alerting, on-call ownership, incident runbooks, and post-incident review practices.
- Add rate limits, request backpressure, job retries, dead-letter queues, and idempotency for every externally triggered operation.
- Use production query traces to guide database indexing and data retention.
- Partition or archive high-volume activity and notification data deliberately.
- Maintain privacy reviews, deletion workflows, abuse reporting, and support operations before broad public-sharing expansion.

## First 90 days

| Window | Desired outcome | Concrete work |
| --- | --- | --- |
| Days 1–14 | Truthful, measurable launch surface | Consolidate domain; correct public metadata; ship demo; define events; add error monitoring and funnel dashboard. |
| Days 15–30 | Activation baseline | Sample workspace; onboarding experiments; sign-in/draft recovery audit; recruit and interview 30–50 users. |
| Days 31–45 | First distribution loop | Improve invitations; implement attribution; improve recipient onboarding; measure shared-list activation. |
| Days 46–60 | First organic loop | Ship five curated templates; public template pages; template/fork tracking; verify Search Console and Bing setup. |
| Days 61–75 | Retention improvements | Analyze cohorts; repair first-week friction; improve reminders/progress guidance based on evidence. |
| Days 76–90 | Public launch decision | Prepare demo/video, README, launch post, support rotation, and an evidence-backed channel plan. |

## Decision gates

Do not advance because a calendar date passed. Advance only when evidence supports the next investment.

| Investment | Gate |
| --- | --- |
| Templates | At least 15% of new activated users start with a template. |
| Sharing expansion | At least 10% of activated users invite someone and at least 30% of recipients activate. |
| AI planning | Users return after using it at least as often as comparable manual planners; failure rate and cost remain within preset limits. |
| Integrations | At least 10 design partners repeatedly request the same integration. |
| Paid plans | Teams reach a real collaboration, governance, or support limit; do not create artificial restrictions solely to force upgrades. |

## Weekly operating cadence

1. Review the funnel, cohort retention, reliability, and support issues.
2. Select one bottleneck and one experiment.
3. Ship the smallest safe improvement, behind a feature flag if risk is material.
4. Review the result by source and cohort, not only global averages.
5. Document the decision, keep/kill outcome, and next hypothesis in the changelog or growth log.

## Immediate implementation priority

Build privacy-conscious activation, retention, invitation, and reliability instrumentation first. It makes every later product, content, and acquisition decision measurable rather than speculative.

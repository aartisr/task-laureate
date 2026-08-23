# Backlinks and Interactive Artifact Outreach

## Purpose

Task-Laureate cannot create third-party backlinks by changing repository code.
External links must be earned through useful public work, accurate attribution,
and permission-respecting outreach. This playbook turns the public interactive
sample into a linkable artifact and defines a repeatable outreach process.

## Linkable assets

Use these canonical destinations consistently:

- Interactive demo: https://tasks.ai-aarti.com/sample
- Product overview: https://aartisr.github.io/task-laureate/
- Documentation hub: https://aartisr.github.io/task-laureate/docs/
- Source repository: https://github.com/aartisr/task-laureate
- Project wiki: https://github.com/aartisr/task-laureate/wiki
- AI-readable summary: https://tasks.ai-aarti.com/llms.txt

The sample is non-persistent and uses fictional tasks. It is suitable for
reviews, classroom demonstrations, portfolio references, accessibility
discussions, and open-source project roundups without exposing private data.

## Outreach priorities

### 1. Institutional and academic listings

Potential legitimate destinations:

- School or robotics-team project showcases
- Student developer portfolios and capstone galleries
- Open-source program directories
- University or community maker-space project indexes
- Local technology clubs and competition project pages

Offer a concise project description, the source link, the interactive demo,
creator attribution, and a screenshot only when the publisher requests it.

### 2. Technical writing

Create original, evidence-backed write-ups that naturally reference the
project:

- Building a local-first task workflow with React and TypeScript
- Designing human-reviewed AI task decomposition
- Testing Supabase RLS and collaboration boundaries
- Making a Vite PWA update without interrupting active work
- Designing accessible task completion and recovery states

Publish first-party articles on the project site or repository documentation.
Then submit them to relevant newsletters, community forums, and technical
roundups where self-promotion is allowed.

### 3. Open-source discovery

Keep the repository linkable and useful:

- Maintain a clear README and contribution guide.
- Publish meaningful releases and changelog entries.
- Use issue templates that help contributors reproduce problems.
- Add the demo URL to the repository About section and package metadata where
  the platform supports it.
- Participate in relevant discussions with technical answers, not link drops.

### 4. Accessibility and privacy communities

The strongest differentiated story is the combination of calm task execution,
local-first behavior, explicit sync states, and human-reviewed AI. Share the
interactive sample only alongside a useful explanation or reproducible lesson.

## Outreach message template

> Subject: Free interactive student open-source task-workflow demo
>
> I built Task-Laureate, a free open-source task workspace focused on turning
> broad work into one clear next action. The live sample uses fictional tasks,
> saves nothing to an account, and takes under a minute to try:
> https://tasks.ai-aarti.com/sample
>
> Source and technical documentation are available here:
> https://github.com/aartisr/task-laureate
>
> If it fits your project showcase or resource list, you are welcome to
> reference it. No special attribution format is required beyond linking to
> the project or creator.

Do not send bulk automated messages, request guaranteed placement, exchange
links solely for ranking benefit, or submit the project to irrelevant low-
quality directories.

## Tracking sheet

Track outreach in a private spreadsheet or issue, not in the application:

| Field | Example |
| --- | --- |
| Organization or publication | PCSSII project showcase |
| Contact or submission URL | https://example.org/submit |
| Audience fit | Student software / accessibility |
| Asset offered | Interactive demo + source |
| Date contacted | 2026-08-23 |
| Response | Pending |
| Published URL | Leave blank until confirmed |
| Follow-up date | 2026-09-06 |
| Permission or attribution confirmed | Yes / No |

Measure qualified referring domains, demo visits from referrals, engaged demo
sessions, and source-repository visits. Do not optimize for raw link count.

## Portfolio and demo presentation

The public overview now includes a visible interactive-artifact section that
links to `/sample`. Keep the artifact:

- Non-persistent by default
- Keyboard accessible
- Honest about what it demonstrates
- Fast enough to load without a framework-sized embedded editor
- Clearly separate from authenticated user data

An iframe should only be introduced for a trusted, same-owner deployment when
it provides a meaningful interaction that a direct link cannot. Prefer a
direct linked live sample for resilience, accessibility, performance, and
security. Do not embed arbitrary repositories or third-party pages.

## Success criteria

- The demo is reachable from the product overview, About page, sitemap, and
  README.
- Every public reference uses a canonical destination.
- Outreach is relevant, permission-respecting, and manually reviewed.
- New referring domains are qualified and contextually relevant.
- Demo visitors can understand and try the core workflow without signing in.
- No private task content or personal identifiers enter outreach analytics.

Backlinks remain an external growth activity. Code can make the project clear,
useful, fast, and easy to cite; it cannot guarantee rankings or third-party
coverage.
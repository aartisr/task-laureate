import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

const SHORTCUTS = [
  { keys: ['⌘', 'N'], label: 'New list', category: 'Create' },
  { keys: ['⌘', 'F'], label: 'Focus search', category: 'Navigate' },
  { keys: ['⌘', 'K'], label: 'Command palette', category: 'Navigate' },
  { keys: ['Enter'], label: 'Confirm / submit', category: 'Actions' },
  { keys: ['Esc'], label: 'Cancel / close', category: 'Actions' },
  { keys: ['Tab'], label: 'Next field', category: 'Forms' },
];

const FAQS = [
  {
    q: 'How do I create my first task list?',
    a: 'From the Dashboard, scroll down to the "Current work" panel. Enter a list title (e.g. "Launch planning") and an optional description, then click Create list. Your new list appears instantly.',
  },
  {
    q: 'How do I set task priorities?',
    a: 'When creating or editing a task, use the Priority dropdown: Urgent (🔴), High (🟠), Medium (🟡), or Low (🟢). Tasks are automatically sorted with urgent items first in the Tasks view.',
  },
  {
    q: 'How do I mark a task as complete?',
    a: 'Click the circular checkbox on the left of any task row. It turns green with a checkmark, the task strikes through, and your completion stats update in real time.',
  },
  {
    q: 'What do the stat cards on the dashboard link to?',
    a: 'Each stat card is clickable: Lists → full lists overview with progress rings; Tasks → all tasks across lists with grouping and filters; Completed → your wins timeline; Progress → analytics, leaderboard, and overdue tracking.',
  },
  {
    q: 'Can I search across all my lists and tasks at once?',
    a: 'Yes. Click Search in the sidebar or press ⌘F. The search is instant and covers titles, descriptions, tags, and notes across every list and task.',
  },
  {
    q: 'How do I change the app theme?',
    a: 'Go to Settings (⚙️ in the sidebar) and choose from Dark Pro, Luxury Minimal, or Warm & Community. The theme applies immediately.',
  },
  {
    q: 'Is my data saved if I refresh the page?',
    a: 'The default in-memory storage clears on refresh by design (great for demos). For persistence, connect a Postgres database via the DATABASE_URL environment variable and the data will survive refreshes.',
  },
  {
    q: 'Is Task-Laureate free and open source?',
    a: 'Completely. MIT licensed. No ads, no tracking, no paywalls — ever. Fork it, modify it, deploy it yourself. The code is yours.',
  },
  {
    q: 'How do I deploy my own instance?',
    a: "Fork the GitHub repo (github.com/aartisr/task-laureate), connect it to Vercel, and click Deploy. Zero configuration required. For Postgres, add a DATABASE_URL variable in Vercel's environment settings.",
  },
  {
    q: 'Who built this?',
    a: 'Task-Laureate was designed and built by Aarti S Ravikumar, a high school student at Pioneer Charter School of Science II (PCSSII). It was born from the real frustration of managing research, competitions, and schoolwork across too many disconnected tools.',
  },
];

function AccordionItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}>
      <button className="faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{q}</span>
        <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="faq-answer" role="region">
          <p>{a}</p>
        </div>
      )}
    </div>
  );
}

const QUICK_LINKS = [
  { icon: '📋', title: 'All Lists', desc: 'Browse every list with progress rings and filters', to: '/lists-overview' },
  { icon: '✓', title: 'All Tasks', desc: 'Every task across all lists, grouped and sortable', to: '/tasks' },
  { icon: '🎉', title: 'Completed', desc: 'Celebrate your wins with a timeline of done tasks', to: '/completed' },
  { icon: '📈', title: 'Progress', desc: 'Analytics, leaderboard, overdue tracking, and more', to: '/progress' },
  { icon: '🔍', title: 'Search', desc: 'Instantly find any list or task', to: '/search' },
  { icon: '⚡', title: 'Activity', desc: 'Complete audit trail of every action', to: '/activity' },
];

export function SupportPage() {
  usePageSEO(PAGE_SEO.support);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggle = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <div className="support-page">

      {/* ===== HERO ===== */}
      <div className="support-hero">
        <div className="support-hero__glow" aria-hidden="true" />
        <div className="support-hero__content">
          <p className="eyebrow">Help Center</p>
          <h1 className="support-hero__title">
            We're here for you.<br />
            <span className="support-hero__accent">Every step of the way.</span>
          </h1>
          <p className="support-hero__subtitle">
            Find answers instantly, learn keyboard shortcuts, explore features, and connect with the community.
            Task-Laureate is built with love — and so is this support center.
          </p>
          <div className="support-hero__badges">
            <span className="support-badge">⚡ Instant answers</span>
            <span className="support-badge">🔓 Open source</span>
            <span className="support-badge">🌍 Community-powered</span>
            <span className="support-badge">♿ Accessible</span>
          </div>
        </div>
        <div className="support-hero__visual" aria-hidden="true">
          <div className="support-orb support-orb--1" />
          <div className="support-orb support-orb--2" />
          <div className="support-orb support-orb--3" />
          <div className="support-hero__icon">🏆</div>
        </div>
      </div>

      {/* ===== QUICK NAVIGATION ===== */}
      <section className="support-section" aria-labelledby="quick-nav-heading">
        <div className="support-section__header">
          <p className="eyebrow">Navigate</p>
          <h2 id="quick-nav-heading">Jump to what you need</h2>
          <p className="support-section__desc">Every view in Task-Laureate is one click away.</p>
        </div>
        <div className="quick-links-grid">
          {QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="quick-link-card">
              <span className="quick-link-card__icon">{link.icon}</span>
              <div>
                <strong>{link.title}</strong>
                <p>{link.desc}</p>
              </div>
              <span className="quick-link-card__arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== KEYBOARD SHORTCUTS ===== */}
      <section className="support-section support-section--alt" aria-labelledby="shortcuts-heading">
        <div className="support-section__header">
          <p className="eyebrow">Power User</p>
          <h2 id="shortcuts-heading">Keyboard shortcuts</h2>
          <p className="support-section__desc">Move at the speed of thought — no mouse required.</p>
        </div>
        <div className="shortcuts-grid">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="shortcut-row">
              <div className="shortcut-keys">
                {s.keys.map((k, j) => (
                  <span key={j} className="kbd">{k}</span>
                ))}
              </div>
              <span className="shortcut-label">{s.label}</span>
              <span className="shortcut-category">{s.category}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQS ===== */}
      <section className="support-section" aria-labelledby="faq-heading">
        <div className="support-section__header">
          <p className="eyebrow">FAQs</p>
          <h2 id="faq-heading">Frequently asked questions</h2>
          <p className="support-section__desc">Answers to the questions we hear most often.</p>
        </div>
        <div className="faq-list" role="list">
          {FAQS.map((item, i) => (
            <AccordionItem
              key={i}
              q={item.q}
              a={item.a}
              isOpen={openFaq === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </section>

      {/* ===== COMMUNITY & CONTACT ===== */}
      <section className="support-section support-section--alt" aria-labelledby="community-heading">
        <div className="support-section__header">
          <p className="eyebrow">Community</p>
          <h2 id="community-heading">Connect & contribute</h2>
          <p className="support-section__desc">Task-Laureate is open source and community-powered. Join us.</p>
        </div>
        <div className="community-grid">
          <a
            href="https://github.com/aartisr/task-laureate/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="community-card community-card--github"
          >
            <div className="community-card__icon">🐛</div>
            <div>
              <strong>Report a bug</strong>
              <p>Found something broken? Open an issue on GitHub and we'll fix it fast.</p>
            </div>
            <span className="community-card__arrow">↗</span>
          </a>
          <a
            href="https://github.com/aartisr/task-laureate/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="community-card community-card--discuss"
          >
            <div className="community-card__icon">💬</div>
            <div>
              <strong>Start a discussion</strong>
              <p>Have a feature idea? Want to share how you use it? We'd love to hear from you.</p>
            </div>
            <span className="community-card__arrow">↗</span>
          </a>
          <a
            href="https://github.com/aartisr/task-laureate"
            target="_blank"
            rel="noopener noreferrer"
            className="community-card community-card--star"
          >
            <div className="community-card__icon">⭐</div>
            <div>
              <strong>Star on GitHub</strong>
              <p>If Task-Laureate has helped you, a star means the world to us. It takes 2 seconds.</p>
            </div>
            <span className="community-card__arrow">↗</span>
          </a>
          <a
            href="https://github.com/aartisr/task-laureate/fork"
            target="_blank"
            rel="noopener noreferrer"
            className="community-card community-card--fork"
          >
            <div className="community-card__icon">🍴</div>
            <div>
              <strong>Fork & build</strong>
              <p>Make it yours. The codebase is clean, well-documented, and built to be extended.</p>
            </div>
            <span className="community-card__arrow">↗</span>
          </a>
        </div>
      </section>

      {/* ===== FOOTER CTA ===== */}
      <div className="support-footer-cta">
        <h2>Ready to take back your clarity?</h2>
        <p>Everything you need is already here. Start with a list. Add a task. Check it off.</p>
        <div className="support-footer-cta__actions">
          <Link to="/" className="primary-button">Go to Dashboard →</Link>
          <Link to="/tasks" className="secondary-button">View all tasks</Link>
        </div>
        <p className="support-footer-cta__credit">
          About Task-Laureate · created by{' '}
          <a href="https://ai-aarti.com" target="_blank" rel="noopener noreferrer">Aarti S Ravikumar</a>
          {' '}·{' '}
          <a href="https://saugus.pioneercss.org" target="_blank" rel="noopener noreferrer">PCSSII</a>
          {' '}·{' '}
          <a href="https://github.com/aartisr/task-laureate" target="_blank" rel="noopener noreferrer">Open Source on GitHub</a>
        </p>
      </div>

    </div>
  );
}

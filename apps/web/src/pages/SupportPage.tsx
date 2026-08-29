import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { COMMUNITY_LINKS } from '../config/communityLinks';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

const SUPPORT_TOPICS = [
  { icon: '⚡', title: 'Start with Now', description: 'Choose a feasible next action using your available time and energy.', to: '/now', action: 'Open Now' },
  { icon: '✦', title: 'Capture a thought', description: 'Use Capture or Cmd/Ctrl + Shift + K to save it safely to Inbox.', to: '/now', action: 'Go to Now' },
  { icon: '▦', title: 'Organize work', description: 'Create lists for projects, then turn the next action into a task.', to: '/lists-overview', action: 'View lists' },
  { icon: '⌕', title: 'Find anything', description: 'Search tasks, lists, and notes without having to remember where they live.', to: '/search', action: 'Search workspace' },
];

const SHORTCUTS = [
  { keys: ['⌘/Ctrl', '⇧', 'K'], label: 'Quick Capture', category: 'Capture' },
  { keys: ['⌘/Ctrl', 'N'], label: 'Create a list', category: 'Create' },
  { keys: ['⌘/Ctrl', 'T'], label: 'Create a task', category: 'Create' },
  { keys: ['⌘/Ctrl', 'F'], label: 'Open search', category: 'Navigate' },
  { keys: ['⌘/Ctrl', 'Z'], label: 'Undo last change', category: 'Edit' },
  { keys: ['⌘/Ctrl', '⇧', 'Z'], label: 'Redo last change', category: 'Edit' },
  { keys: ['⌘/Ctrl', ','], label: 'Open settings', category: 'Navigate' },
  { keys: ['⌘/Ctrl', 'B'], label: 'Toggle sidebar', category: 'Navigate' },
  { keys: ['⌘/Ctrl', 'H'], label: 'Go to Dashboard', category: 'Navigate' },
  { keys: ['Esc'], label: 'Close a dialog or cancel', category: 'Navigate' },
];

const FAQS = [
  { q: 'Where should I start when my list feels overwhelming?', a: 'Open Now. Choose your current energy and available time, then add no more than three realistic commitments. If a task is vague, open it and use Plan and deconstruct before committing it.' },
  { q: 'How do I capture something without losing my place?', a: 'Use the Capture button in the sidebar or Cmd/Ctrl + Shift + K. The capture stays safe on your device if you are offline and is delivered to Inbox when a connection is available.' },
  { q: 'How do I make a broad task easier to start?', a: 'Open the task and select Deconstruct task. You can accept only the suggested steps that fit your situation, then edit them as normal tasks.' },
  { q: 'How do I defer something without creating guilt?', a: 'From Now, select Tomorrow to defer a committed task, or Release to remove it from today while keeping it safely in its list. Nothing is deleted by either choice.' },
  { q: 'Where can I review my progress?', a: 'Progress shows completion, status, overdue work, and a weekly reflection. It is designed to help you decide what to change next—not to judge a number.' },
  { q: 'Can I customize pages in Puck?', a: 'Yes. Open the Puck route for the page you want to edit. The editor guide explains available page blocks and how content is saved locally.', to: '/puck/dashboard', label: 'Open Puck editor' },
  { q: 'Is my data private?', a: 'You control syncing in Settings. Capture and daily planning state are stored locally first; privacy controls let you review and remove anti-backlog data. Cloud capabilities require your configured account and storage.' },
];

function AccordionItem({ item, isOpen, onToggle }: { item: typeof FAQS[number]; isOpen: boolean; onToggle: () => void }) {
  return <article className={`support-faq ${isOpen ? 'is-open' : ''}`}><button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={`support-faq-${item.q}`}><span>{item.q}</span><i aria-hidden="true">{isOpen ? '−' : '+'}</i></button>{isOpen ? <div id={`support-faq-${item.q}`} role="region"><p>{item.a}</p>{item.to && item.label ? <Link className="support-faq__link" to={item.to}>{item.label} →</Link> : null}</div> : null}</article>;
}

export function SupportPage() {
  usePageSEO(PAGE_SEO.support);
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const visibleFaqs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return FAQS.map((item, index) => ({ item, index })).filter(({ item }) => !normalized || `${item.q} ${item.a}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  return <main className="support-page" aria-label="Help and support">
    <header className="support-hub-hero"><div><p className="eyebrow">Help & support</p><h1>Get back to clear, quickly.</h1><p>Practical guidance for capturing work, choosing what matters now, and keeping your system calm.</p><label className="support-hub-search"><span className="sr-only">Search support</span><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help topics…" /><button type="button" onClick={() => setQuery('')} aria-label="Clear help search" hidden={!query}>×</button></label></div><aside className="support-hub-hero__card"><span aria-hidden="true">✦</span><strong>Start here</strong><p>Capture the thought. Choose a small commitment. Let the rest wait.</p><Link className="primary-button" to="/now">Open Now</Link></aside></header>

    <section className="support-hub-section" aria-labelledby="support-start"><div className="support-hub-section__heading"><p className="eyebrow">Common paths</p><h2 id="support-start">What would you like to do?</h2><p>Start with the outcome you need, not a manual.</p></div><div className="support-topic-grid">{SUPPORT_TOPICS.map((topic) => <Link key={topic.title} to={topic.to} className="support-topic"><span aria-hidden="true">{topic.icon}</span><div><strong>{topic.title}</strong><p>{topic.description}</p><small>{topic.action} →</small></div></Link>)}</div></section>

    <div className="support-hub-split"><section className="support-hub-section" aria-labelledby="support-faq"><div className="support-hub-section__heading"><p className="eyebrow">Answers</p><h2 id="support-faq">Frequently asked questions</h2><p>{query ? `${visibleFaqs.length} matching answer${visibleFaqs.length === 1 ? '' : 's'}.` : 'The answers people need most often.'}</p></div><div className="support-faq-list">{visibleFaqs.length ? visibleFaqs.map(({ item, index }) => <AccordionItem key={item.q} item={item} isOpen={openFaq === index} onToggle={() => setOpenFaq((current) => current === index ? null : index)} />) : <div className="support-empty">No support topic matches “{query}”. Try a shorter phrase.</div>}</div></section>
      <aside className="support-hub-aside"><section><p className="eyebrow">Keyboard</p><h2>Move without breaking focus</h2><div className="support-shortcuts">{SHORTCUTS.map((shortcut) => <div key={shortcut.label}><span>{shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span><strong>{shortcut.label}</strong><small>{shortcut.category}</small></div>)}</div></section><section><p className="eyebrow">Your workspace</p><h2>Useful places</h2><nav className="support-utility-links"><Link to="/tasks">All tasks <span>→</span></Link><Link to="/progress">Progress & reflection <span>→</span></Link><Link to="/settings">Settings & privacy <span>→</span></Link></nav></section></aside></div>

    <section className="support-community" aria-labelledby="support-community"><div><p className="eyebrow">Community</p><h2 id="support-community">Need a human or want to contribute?</h2><p>Task-Laureate is open source. Share an idea, report a problem, or help shape what comes next.</p><p className="support-community__credit">Built with care by <a href="https://ai-aarti.com" target="_blank" rel="noopener noreferrer">Aarti S Ravikumar<span className="sr-only"> — opens in a new tab</span></a>.</p></div><div className="support-community__links">{COMMUNITY_LINKS.map((link) => <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" className={`community-card ${link.className}`} aria-label={`${link.title} — opens GitHub in a new tab`}><span aria-hidden="true">{link.icon}</span><span><strong>{link.title}</strong><small>{link.description}</small></span><i aria-hidden="true">↗</i><span className="sr-only"> Opens GitHub in a new tab.</span></a>)}</div></section>
  </main>;
}

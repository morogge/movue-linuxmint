import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SHORTCUTS_PLACEHOLDER } from '@shared/help';
import { Icon } from '../components/Icon';
import { HELP_PAGES } from './content';
import { ShortcutTable } from './ShortcutTable';

interface Props {
  page: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        )
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function HelpView({ page, onSelect, onClose }: Props) {
  const current = HELP_PAGES.find((p) => p.id === page) ?? HELP_PAGES[0];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const [before, after] = current.body.includes(SHORTCUTS_PLACEHOLDER)
    ? current.body.split(SHORTCUTS_PLACEHOLDER)
    : [current.body, null];

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="help-panel">
        <nav className="help-nav" aria-label="Hilfeseiten">
          <span className="help-nav-title">Hilfe</span>
          {HELP_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === current.id ? 'help-link active' : 'help-link'}
              aria-current={p.id === current.id ? 'page' : undefined}
              onClick={() => onSelect(p.id)}
            >
              {p.title}
            </button>
          ))}
        </nav>
        <article className="help-content">
          <div className="help-head">
            <h1 id="help-title">{current.title}</h1>
            <button ref={closeRef} type="button" className="icon-button" aria-label="Hilfe schließen (Esc)" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <Markdown text={before} />
          {after !== null && (
            <>
              <ShortcutTable />
              <Markdown text={after} />
            </>
          )}
        </article>
      </div>
    </div>
  );
}

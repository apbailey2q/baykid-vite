// HelpCenter.tsx — BayKid Documentation & Help Center
//
// Views: home, category, article, search, faq, tutorials, support, admin
// All state is local (no context needed); data comes from helpContent.ts.

import { useState, useEffect, useCallback } from 'react'
import {
  HELP_CATEGORIES, HELP_ARTICLES, FAQS, TUTORIALS,
  type HelpArticle, type HelpCategory, type HelpBlock,
  type Tutorial, type TutorialStep, type SupportTicket,
  searchArticles, getArticlesByCategory, getArticleById,
  getRecentlyViewed, trackArticleView, voteArticle, getArticleVote,
  getAllArticles, getOverrides, saveOverride,
  saveCustomArticle, deleteCustomArticle, getSupportTickets,
  saveSupportTicket, updateTicketStatus,
} from '../../../lib/helpContent'

// ── Types ────────────────────────────────────────────────────────────────────

type HelpView =
  | { type: 'home' }
  | { type: 'category';  categoryId: string }
  | { type: 'article';   articleId:  string }
  | { type: 'search';    query:      string }
  | { type: 'faq';       filterCat?: string }
  | { type: 'tutorials' }
  | { type: 'support' }
  | { type: 'admin' }

// ── Shared style tokens ───────────────────────────────────────────────────────

const S = {
  card:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 } as const,
  cardHov: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,200,255,0.25)' } as const,
  chip:    { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 } as const,
  label:   { fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  h2:      { color: '#fff', fontSize: 18, fontWeight: 700, margin: '24px 0 8px' } as const,
  badge:   (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }),
}

const diff_color: Record<string, string> = {
  beginner:     '#22c55e',
  intermediate: '#fbbf24',
  advanced:     '#f87171',
}

// ── Sub-component: Breadcrumb ─────────────────────────────────────────────────

function Breadcrumb({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>›</span>}
          {c.onClick ? (
            <button
              onClick={c.onClick}
              style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
            >
              {c.label}
            </button>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{c.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ── Sub-component: SearchBar ──────────────────────────────────────────────────

function SearchBar({ value, onChange, onSubmit, placeholder = 'Search documentation…' }: {
  value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; placeholder?: string
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()) }}
      style={{ position: 'relative', width: '100%' }}
    >
      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
          padding: '12px 44px 12px 44px', color: '#fff', fontSize: 15,
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(0,200,255,0.4)' }}
        onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >
          ✕
        </button>
      )}
    </form>
  )
}

// ── Sub-component: ArticleCard ────────────────────────────────────────────────

function ArticleCard({ article, cat, onClick }: { article: HelpArticle; cat?: HelpCategory; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...S.card, ...(hov ? S.cardHov : {}),
        display: 'block', width: '100%', textAlign: 'left',
        padding: 16, cursor: 'pointer', border: hov ? '1px solid rgba(0,200,255,0.25)' : S.card.border,
        background: hov ? 'rgba(255,255,255,0.07)' : S.card.background,
        transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {cat && <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{cat.icon}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{article.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5 }}>{article.summary}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            {cat && <span style={{ ...S.badge(`${cat.color}22`, cat.color) }}>{cat.label}</span>}
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{article.readMinutes} min read</span>
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18, flexShrink: 0 }}>›</span>
      </div>
    </button>
  )
}

// ── Sub-component: VideoPlaceholder ──────────────────────────────────────────

function VideoPlaceholder({ title, duration, description }: { title: string; duration: string; description?: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16, cursor: 'pointer' }}
    >
      <div
        style={{
          background: hov
            ? 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(100,60,200,0.15))'
            : 'linear-gradient(135deg, rgba(0,200,255,0.08), rgba(100,60,200,0.08))',
          height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, transition: 'background 0.2s',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 60, height: 60, borderRadius: '50%',
            background: hov ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, transition: 'background 0.2s',
          }}
        >
          ▶
        </div>
        <div style={{ ...S.chip, background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}>
          {duration}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, ...S.chip, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
          Tutorial Video
        </div>
      </div>
      <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
        {description && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{description}</div>}
      </div>
    </div>
  )
}

// ── Sub-component: BlockRenderer ──────────────────────────────────────────────

function BlockRenderer({ block }: { block: HelpBlock }) {
  const base = { fontFamily: 'inherit' }
  switch (block.type) {
    case 'p':
      return <p style={{ ...base, color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>{block.text}</p>
    case 'h2':
      return <h2 style={{ ...base, color: '#fff', fontSize: 18, fontWeight: 700, margin: '28px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>{block.text}</h2>
    case 'h3':
      return <h3 style={{ ...base, color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>{block.text}</h3>
    case 'steps':
      return (
        <ol style={{ margin: '12px 0 16px', paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.6 }}>{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul style={{ margin: '12px 0 16px', paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ flexShrink: 0, color: '#00c8ff', marginTop: 4 }}>•</span>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.6 }}>{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'tip':
      return (
        <div style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 10, padding: '12px 16px', margin: '12px 0', display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>{block.text}</span>
        </div>
      )
    case 'warning':
      return (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '12px 16px', margin: '12px 0', display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>{block.text}</span>
        </div>
      )
    case 'code':
      return (
        <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16, margin: '12px 0', overflow: 'auto', fontSize: 13, color: '#a5f3fc', fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {block.text}
        </pre>
      )
    case 'video':
      return <VideoPlaceholder title={block.title} duration={block.duration} description={block.description} />
    case 'table':
      return (
        <div style={{ overflowX: 'auto', margin: '12px 0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(0,200,255,0.06)' }}>
                {block.headers.map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.7)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

// ── View: Home ────────────────────────────────────────────────────────────────

function HomeView({ onCategory, onArticle, onSearch, onFaq, onTutorials, onSupport }: {
  onCategory: (id: string) => void
  onArticle:  (id: string) => void
  onSearch:   (q: string)  => void
  onFaq:      ()           => void
  onTutorials: ()          => void
  onSupport:  ()           => void
}) {
  const [query, setQuery]         = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => { setRecentIds(getRecentlyViewed()) }, [])

  const featured = HELP_ARTICLES.filter((a) => a.featured && !a.draft).slice(0, 3)
  const recent   = recentIds.map((id) => getArticleById(id)).filter(Boolean) as HelpArticle[]

  return (
    <div>
      {/* Hero search */}
      <div style={{ textAlign: 'center', padding: '32px 0 28px' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8, fontFamily: 'inherit' }}>
          Cyan's Brooklynn Help Center
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24, fontFamily: 'inherit' }}>
          Documentation, tutorials, and support for the AI Marketing Center
        </p>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <SearchBar value={query} onChange={setQuery} onSubmit={onSearch} />
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
        {[
          { label: '❓ FAQ', action: onFaq },
          { label: '🎓 Tutorials', action: onTutorials },
          { label: '🎫 Contact Support', action: onSupport },
        ].map((link) => (
          <button
            key={link.label}
            onClick={link.action}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: '7px 16px',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,200,255,0.1)'; e.currentTarget.style.color = '#00c8ff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* Category grid */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ ...S.label, marginBottom: 14 }}>Browse by Category</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {HELP_CATEGORIES.map((cat) => {
            const count = getArticlesByCategory(cat.id).length
            return <CategoryCard key={cat.id} cat={cat} count={count} onClick={() => onCategory(cat.id)} />
          })}
        </div>
      </div>

      {/* Featured articles */}
      {featured.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Featured Articles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {featured.map((a) => {
              const cat = HELP_CATEGORIES.find((c) => c.id === a.categoryId)
              return <ArticleCard key={a.id} article={a} cat={cat} onClick={() => onArticle(a.id)} />
            })}
          </div>
        </div>
      )}

      {/* Recently viewed */}
      {recent.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...S.label, marginBottom: 14 }}>Recently Viewed</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.slice(0, 3).map((a) => {
              const cat = HELP_CATEGORIES.find((c) => c.id === a.categoryId)
              return <ArticleCard key={a.id} article={a} cat={cat} onClick={() => onArticle(a.id)} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryCard({ cat, count, onClick }: { cat: HelpCategory; count: number; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...S.card,
        border: hov ? `1px solid ${cat.color}50` : S.card.border,
        background: hov ? `${cat.color}10` : S.card.background,
        padding: 16, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{cat.icon}</div>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{cat.label}</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>{cat.description}</div>
      <div style={{ color: cat.color, fontSize: 11, fontWeight: 600 }}>{count} article{count !== 1 ? 's' : ''}</div>
    </button>
  )
}

// ── View: Category ────────────────────────────────────────────────────────────

function CategoryView({ categoryId, onArticle, onHome }: {
  categoryId: string; onArticle: (id: string) => void; onHome: () => void
}) {
  const cat      = HELP_CATEGORIES.find((c) => c.id === categoryId)
  const articles = getArticlesByCategory(categoryId)
  if (!cat) return null

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: cat.label }]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <span style={{ fontSize: 36 }}>{cat.icon}</span>
        <div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: 0, fontFamily: 'inherit' }}>{cat.label}</h1>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 }}>{cat.description}</div>
        </div>
      </div>

      {articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          No articles in this category yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} onClick={() => onArticle(a.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── View: Article ─────────────────────────────────────────────────────────────

function ArticleView({ articleId, onHome, onCategory, onArticle }: {
  articleId: string; onHome: () => void; onCategory: (id: string) => void; onArticle: (id: string) => void
}) {
  const article = getArticleById(articleId)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    setVote(getArticleVote(articleId))
  }, [articleId])

  if (!article) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ color: 'rgba(255,255,255,0.4)' }}>Article not found</div>
        <button onClick={onHome} style={{ marginTop: 16, color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
          ← Back to Help Center
        </button>
      </div>
    )
  }

  const cat = HELP_CATEGORIES.find((c) => c.id === article.categoryId)
  const related = getArticlesByCategory(article.categoryId)
    .filter((a) => a.id !== article.id)
    .slice(0, 3)

  const handleVote = (v: 'up' | 'down') => {
    voteArticle(article.id, v)
    setVote(v)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Breadcrumb crumbs={[
        { label: 'Help Center', onClick: onHome },
        ...(cat ? [{ label: cat.label, onClick: () => onCategory(cat.id) }] : []),
        { label: article.title },
      ]} />

      {/* Article header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.3, fontFamily: 'inherit' }}>{article.title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5, fontFamily: 'inherit' }}>{article.summary}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {cat && <span style={{ ...S.badge(`${cat.color}20`, cat.color) }}>{cat.icon} {cat.label}</span>}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>📖 {article.readMinutes} min read</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Updated {article.updatedAt}</span>
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} style={{ ...S.badge('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.4)') }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
        {article.content.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>

      {/* Was this helpful */}
      <div style={{ ...S.card, padding: '20px 24px', marginTop: 32, textAlign: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 12, fontFamily: 'inherit' }}>Was this article helpful?</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {(['up', 'down'] as const).map((v) => (
            <button
              key={v}
              onClick={() => handleVote(v)}
              style={{
                background: vote === v ? (v === 'up' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.06)',
                border: vote === v ? `1px solid ${v === 'up' ? '#22c55e' : '#ef4444'}` : '1px solid rgba(255,255,255,0.12)',
                color: vote === v ? (v === 'up' ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.5)',
                borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {v === 'up' ? '👍 Yes' : '👎 No'}
            </button>
          ))}
        </div>
        {vote && (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 10, fontFamily: 'inherit' }}>
            {vote === 'up' ? 'Thanks for the feedback!' : 'We\'ll work to improve this article.'}
          </div>
        )}
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>Related Articles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {related.map((a) => <ArticleCard key={a.id} article={a} onClick={() => onArticle(a.id)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── View: Search Results ──────────────────────────────────────────────────────

function SearchView({ query, onQueryChange, onArticle, onHome }: {
  query: string; onQueryChange: (q: string) => void; onArticle: (id: string) => void; onHome: () => void
}) {
  const [input, setInput] = useState(query)
  const results = searchArticles(query)

  useEffect(() => { setInput(query) }, [query])

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: 'Search' }]} />
      <div style={{ marginBottom: 20 }}>
        <SearchBar value={input} onChange={setInput} onSubmit={onQueryChange} />
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}>
        {results.length} result{results.length !== 1 ? 's' : ''} for <span style={{ color: '#00c8ff' }}>"{query}"</span>
      </div>
      {results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontFamily: 'inherit' }}>No results found</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: 'inherit' }}>Try different keywords or browse by category</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((a) => {
            const cat = HELP_CATEGORIES.find((c) => c.id === a.categoryId)
            return <ArticleCard key={a.id} article={a} cat={cat} onClick={() => onArticle(a.id)} />
          })}
        </div>
      )}
    </div>
  )
}

// ── View: FAQ ─────────────────────────────────────────────────────────────────

function FAQView({ onHome }: { onHome: () => void }) {
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [openId,    setOpenId]    = useState<string | null>(null)

  const faqs = filterCat
    ? FAQS.filter((f) => f.categoryId === filterCat)
    : FAQS

  const cats = Array.from(new Set(FAQS.map((f) => f.categoryId).filter(Boolean))) as string[]

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: 'FAQ' }]} />
      <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 6, fontFamily: 'inherit' }}>Frequently Asked Questions</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, fontFamily: 'inherit' }}>{FAQS.length} questions answered</p>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <button
          onClick={() => setFilterCat(null)}
          style={{ ...S.chip, background: !filterCat ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.06)', color: !filterCat ? '#00c8ff' : 'rgba(255,255,255,0.5)', border: `1px solid ${!filterCat ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
        >
          All ({FAQS.length})
        </button>
        {cats.map((catId) => {
          const cat   = HELP_CATEGORIES.find((c) => c.id === catId)
          const count = FAQS.filter((f) => f.categoryId === catId).length
          const active = filterCat === catId
          if (!cat) return null
          return (
            <button
              key={catId}
              onClick={() => setFilterCat(active ? null : catId)}
              style={{ ...S.chip, background: active ? `${cat.color}20` : 'rgba(255,255,255,0.06)', color: active ? cat.color : 'rgba(255,255,255,0.5)', border: `1px solid ${active ? `${cat.color}50` : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {faqs.map((faq) => {
          const isOpen = openId === faq.id
          const cat    = HELP_CATEGORIES.find((c) => c.id === faq.categoryId)
          return (
            <div key={faq.id} style={{ ...S.card, overflow: 'hidden', transition: 'border-color 0.15s', borderColor: isOpen ? 'rgba(0,200,255,0.25)' : S.card.border }}>
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                {cat && <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.icon}</span>}
                <span style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{faq.question}</span>
                <span style={{ color: isOpen ? '#00c8ff' : 'rgba(255,255,255,0.3)', fontSize: 18, flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none', lineHeight: 1 }}>+</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, margin: '12px 0 0', fontFamily: 'inherit' }}>{faq.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-component: TutorialModal ──────────────────────────────────────────────

function TutorialModal({ tutorial, onClose, onNavigate }: {
  tutorial: Tutorial; onClose: () => void; onNavigate?: (section: string) => void
}) {
  const [step, setStep] = useState(0)
  const current = tutorial.steps[step] as TutorialStep
  const isLast  = step === tutorial.steps.length - 1

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#111827', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 16, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{tutorial.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' }}>{tutorial.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'inherit' }}>Step {step + 1} of {tutorial.steps.length}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', background: '#00c8ff', width: `${((step + 1) / tutorial.steps.length) * 100}%`, transition: 'width 0.3s ease', borderRadius: 2 }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, padding: '14px 24px 0', justifyContent: 'center' }}>
          {tutorial.steps.map((_, i) => (
            <div key={i} style={{ height: 6, borderRadius: 3, background: i <= step ? '#00c8ff' : 'rgba(255,255,255,0.1)', width: i === step ? 20 : 6, transition: 'all 0.2s' }} />
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: '20px 24px' }}>
          <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 10px', fontFamily: 'inherit' }}>{current.title}</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px', fontFamily: 'inherit' }}>{current.description}</p>
          {current.tip && (
            <div style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit' }}>{current.tip}</span>
            </div>
          )}
          {current.appSection && onNavigate && (
            <button
              onClick={() => { onNavigate(current.appSection!); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }}
            >
              🔗 Open this section in the app
            </button>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: step === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '10px 20px', cursor: step === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            ← Back
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              style={{ background: '#00c8ff', border: 'none', color: '#000', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
            >
              ✓ Complete
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              style={{ background: '#00c8ff', border: 'none', color: '#000', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── View: Tutorials ───────────────────────────────────────────────────────────

function TutorialsView({ onHome, onNavigate }: { onHome: () => void; onNavigate?: (s: string) => void }) {
  const [active, setActive] = useState<Tutorial | null>(null)

  return (
    <div>
      {active && <TutorialModal tutorial={active} onClose={() => setActive(null)} onNavigate={onNavigate} />}
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: 'Tutorials' }]} />
      <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 6, fontFamily: 'inherit' }}>Interactive Tutorials</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 28, fontFamily: 'inherit' }}>Step-by-step walkthroughs for the most important workflows.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {TUTORIALS.map((tut) => {
          const cat = HELP_CATEGORIES.find((c) => c.id === tut.categoryId)
          return (
            <TutorialCard key={tut.id} tutorial={tut} cat={cat} onStart={() => setActive(tut)} />
          )
        })}
      </div>
    </div>
  )
}

function TutorialCard({ tutorial, cat, onStart }: { tutorial: Tutorial; cat?: HelpCategory; onStart: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...S.card, padding: 20, transition: 'all 0.15s', borderColor: hov ? 'rgba(0,200,255,0.25)' : S.card.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{tutorial.icon}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>{tutorial.title}</div>
          {cat && <div style={{ ...S.badge(`${cat.color}20`, cat.color), display: 'inline-block', marginTop: 4, fontFamily: 'inherit' }}>{cat.label}</div>}
        </div>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5, margin: '0 0 14px', fontFamily: 'inherit' }}>{tutorial.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ ...S.badge(`${diff_color[tutorial.difficulty]}22`, diff_color[tutorial.difficulty]) }}>{tutorial.difficulty}</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'inherit' }}>⏱ {tutorial.estimatedMinutes} min</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'inherit' }}>{tutorial.steps.length} steps</span>
      </div>
      <button
        onClick={onStart}
        style={{ width: '100%', background: '#00c8ff', border: 'none', color: '#000', borderRadius: 8, padding: '10px 0', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
      >
        Start Tutorial →
      </button>
    </div>
  )
}

// ── View: Support ─────────────────────────────────────────────────────────────

function SupportView({ onHome }: { onHome: () => void }) {
  const [tickets, setTickets]   = useState<SupportTicket[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    subject:  '',
    category: 'general',
    priority: 'medium' as SupportTicket['priority'],
    message:  '',
    email:    '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => { setTickets(getSupportTickets()) }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email.trim())         e.email   = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.subject.trim())       e.subject = 'Subject is required'
    if (!form.message.trim())       e.message = 'Message is required'
    else if (form.message.length < 20) e.message = 'Please describe the issue in more detail (min 20 chars)'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const ticket: SupportTicket = {
      id:        `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subject:   form.subject,
      category:  form.category,
      priority:  form.priority,
      message:   form.message,
      email:     form.email,
      status:    'open',
      createdAt: new Date().toISOString(),
    }
    saveSupportTicket(ticket)
    setTickets(getSupportTickets())
    setSubmitted(true)
    setForm({ subject: '', category: 'general', priority: 'medium', message: '', email: '' })
    setErrors({})
  }

  const priorityColor: Record<string, string> = { low: '#6b7280', medium: '#fbbf24', high: '#f97316', urgent: '#ef4444' }
  const statusColor:   Record<string, string> = { open: '#00c8ff', in_progress: '#fbbf24', resolved: '#22c55e' }

  const field = (label: string, key: keyof typeof form, el: React.ReactElement) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ ...S.label, display: 'block', marginBottom: 6, fontFamily: 'inherit' }}>{label}</label>
      {el}
      {errors[key] && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4, fontFamily: 'inherit' }}>{errors[key]}</div>}
    </div>
  )

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: 'Support' }]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* Ticket form */}
        <div>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 6px', fontFamily: 'inherit' }}>Submit a Support Ticket</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 20px', fontFamily: 'inherit' }}>We respond within 2–48 hours depending on priority.</p>

          {submitted && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Ticket submitted!</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'inherit' }}>We'll follow up at the email you provided.</div>
              </div>
            </div>
          )}

          <div style={{ ...S.card, padding: 20 }}>
            {field('Your Email', 'email',
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" style={{ ...inputStyle, borderColor: errors.email ? '#f87171' : 'rgba(255,255,255,0.12)' }} />
            )}
            {field('Subject', 'subject',
              <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of the issue" style={{ ...inputStyle, borderColor: errors.subject ? '#f87171' : 'rgba(255,255,255,0.12)' }} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontFamily: 'inherit' }}>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ ...inputStyle }}>
                  <option value="general">General</option>
                  <option value="ai-generation">AI Generation</option>
                  <option value="billing">Billing</option>
                  <option value="account">Account / Login</option>
                  <option value="publishing">Publishing</option>
                  <option value="automation">Automation</option>
                  <option value="permissions">Permissions</option>
                  <option value="bug">Bug Report</option>
                </select>
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6, fontFamily: 'inherit' }}>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as SupportTicket['priority'] })}
                  style={{ ...inputStyle }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent (production down)</option>
                </select>
              </div>
            </div>
            {field('Message', 'message',
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={6} placeholder="Describe the issue in detail. Include what you were trying to do and what happened instead."
                style={{ ...inputStyle, resize: 'vertical', borderColor: errors.message ? '#f87171' : 'rgba(255,255,255,0.12)' }} />
            )}
            <button onClick={handleSubmit} style={{ width: '100%', background: '#00c8ff', border: 'none', color: '#000', borderRadius: 8, padding: '11px 0', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
              Submit Ticket
            </button>
          </div>
        </div>

        {/* Right column: past tickets + quick links */}
        <div>
          <div style={{ ...S.card, padding: 20, marginBottom: 16 }}>
            <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 4px', fontFamily: 'inherit' }}>Response Time by Priority</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {[
                { priority: 'urgent', label: 'Urgent',  resp: 'Within 2 hours'  },
                { priority: 'high',   label: 'High',    resp: 'Within 4 hours'  },
                { priority: 'medium', label: 'Medium',  resp: 'Within 24 hours' },
                { priority: 'low',    label: 'Low',     resp: 'Within 48 hours' },
              ].map(({ priority, label, resp }) => (
                <div key={priority} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S.badge(`${priorityColor[priority]}22`, priorityColor[priority]) }}>{label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'inherit' }}>{resp}</span>
                </div>
              ))}
            </div>
          </div>

          {tickets.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom: 10 }}>Your Past Tickets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets.slice(0, 5).map((t) => (
                  <div key={t.id} style={{ ...S.card, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1, fontFamily: 'inherit' }}>{t.subject}</div>
                      <span style={{ ...S.badge(`${statusColor[t.status]}20`, statusColor[t.status]), flexShrink: 0 }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4, fontFamily: 'inherit' }}>
                      {new Date(t.createdAt).toLocaleDateString()} · {t.category} · <span style={{ color: priorityColor[t.priority] }}>{t.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── View: Admin ───────────────────────────────────────────────────────────────

function AdminView({ onHome }: { onHome: () => void }) {
  const [tab,    setTab]    = useState<'articles' | 'tickets' | 'create'>('articles')
  const [search, setSearch] = useState('')
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [tickets,  setTickets]  = useState<SupportTicket[]>([])
  const [overrides, setOverrides] = useState(getOverrides())
  const [newArt, setNewArt] = useState({ title: '', categoryId: 'getting-started', summary: '', content: '', tags: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setArticles(getAllArticles())
    setTickets(getSupportTickets())
  }, [tab])

  const toggleDraft = (id: string, cur: boolean) => {
    saveOverride(id, { draft: !cur })
    setOverrides(getOverrides())
    setArticles(getAllArticles())
  }

  const togglePin = (id: string, cur: boolean) => {
    saveOverride(id, { pinned: !cur })
    setOverrides(getOverrides())
  }

  const filtered = articles.filter((a) =>
    !search || a.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = () => {
    if (!newArt.title.trim() || !newArt.summary.trim()) return
    const art: HelpArticle = {
      id:          `custom_${Date.now()}`,
      categoryId:  newArt.categoryId,
      title:       newArt.title,
      summary:     newArt.summary,
      content:     newArt.content ? [{ type: 'p' as const, text: newArt.content }] : [],
      tags:        newArt.tags.split(',').map((t) => t.trim()).filter(Boolean),
      readMinutes: 2,
      updatedAt:   new Date().toISOString().slice(0, 10),
    }
    saveCustomArticle(art)
    setArticles(getAllArticles())
    setNewArt({ title: '', categoryId: 'getting-started', summary: '', content: '', tags: '' })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setTab('articles')
  }

  const statusColor: Record<string, string> = { open: '#00c8ff', in_progress: '#fbbf24', resolved: '#22c55e' }
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none' }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Help Center', onClick: onHome }, { label: 'Admin Tools' }]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>🛠</span>
        <div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0, fontFamily: 'inherit' }}>Documentation Admin</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0, fontFamily: 'inherit' }}>Manage articles, overrides, and support tickets</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        {[
          { id: 'articles', label: `Articles (${articles.length})` },
          { id: 'tickets',  label: `Support Tickets (${tickets.length})` },
          { id: 'create',   label: '+ New Article' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? '#00c8ff' : 'transparent'}`, color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.45)', padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Articles tab */}
      {tab === 'articles' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title…" style={{ ...inputStyle, maxWidth: 340 }} />
          </div>
          <div style={{ ...S.card, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Title', 'Category', 'Status', 'Pinned', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const isDraft  = overrides[a.id]?.draft  ?? a.draft  ?? false
                  const isPinned = overrides[a.id]?.pinned ?? false
                  const isCustom = a.id.startsWith('custom_')
                  const cat = HELP_CATEGORIES.find((c) => c.id === a.categoryId)
                  return (
                    <tr key={a.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <td style={{ padding: '10px 14px', color: '#fff', maxWidth: 280 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{a.id}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {cat && <span style={{ ...S.badge(`${cat.color}20`, cat.color) }}>{cat.icon} {cat.label}</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ ...S.badge(isDraft ? 'rgba(255,255,255,0.07)' : 'rgba(34,197,94,0.12)', isDraft ? 'rgba(255,255,255,0.4)' : '#22c55e') }}>
                          {isDraft ? 'Draft' : 'Published'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 16 }}>{isPinned ? '📌' : '—'}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => toggleDraft(a.id, isDraft)}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                            {isDraft ? 'Publish' : 'Draft'}
                          </button>
                          <button onClick={() => togglePin(a.id, isPinned)}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                            {isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          {isCustom && (
                            <button onClick={() => { deleteCustomArticle(a.id); setArticles(getAllArticles()) }}
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tickets tab */}
      {tab === 'tickets' && (
        <div>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: 'inherit' }}>
              No support tickets yet.
            </div>
          ) : (
            <div style={{ ...S.card, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Subject', 'Category', 'Priority', 'Status', 'Submitted', 'Action'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => {
                    const pColor: Record<string, string> = { low: '#6b7280', medium: '#fbbf24', high: '#f97316', urgent: '#ef4444' }
                    return (
                      <tr key={t.id} style={{ borderBottom: i < tickets.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{t.subject}</div>
                          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{t.email}</div>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.55)' }}>{t.category}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ ...S.badge(`${pColor[t.priority]}22`, pColor[t.priority]) }}>{t.priority}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ ...S.badge(`${statusColor[t.status]}20`, statusColor[t.status]) }}>{t.status.replace('_', ' ')}</span>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <select
                            value={t.status}
                            onChange={(e) => {
                              updateTicketStatus(t.id, e.target.value as SupportTicket['status'])
                              setTickets(getSupportTickets())
                            }}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create article tab */}
      {tab === 'create' && (
        <div style={{ maxWidth: 560 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 16px', fontFamily: 'inherit' }}>Create New Article</h3>
          {saved && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#22c55e', fontSize: 13, fontFamily: 'inherit' }}>
              ✅ Article saved and published.
            </div>
          )}
          <div style={{ ...S.card, padding: 20 }}>
            {[
              { label: 'Title', key: 'title', type: 'input', placeholder: 'Article title' },
              { label: 'Summary', key: 'summary', type: 'input', placeholder: 'One-line summary shown in article cards' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ ...S.label, display: 'block', marginBottom: 5, fontFamily: 'inherit' }}>{label}</label>
                <input type="text" value={newArt[key as keyof typeof newArt]} onChange={(e) => setNewArt({ ...newArt, [key]: e.target.value })}
                  placeholder={placeholder} style={{ ...inputStyle }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...S.label, display: 'block', marginBottom: 5, fontFamily: 'inherit' }}>Category</label>
              <select value={newArt.categoryId} onChange={(e) => setNewArt({ ...newArt, categoryId: e.target.value })} style={{ ...inputStyle }}>
                {HELP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...S.label, display: 'block', marginBottom: 5, fontFamily: 'inherit' }}>Tags (comma-separated)</label>
              <input type="text" value={newArt.tags} onChange={(e) => setNewArt({ ...newArt, tags: e.target.value })}
                placeholder="e.g. scheduling, calendar, tips" style={{ ...inputStyle }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...S.label, display: 'block', marginBottom: 5, fontFamily: 'inherit' }}>Content</label>
              <textarea value={newArt.content} onChange={(e) => setNewArt({ ...newArt, content: e.target.value })}
                rows={8} placeholder="Article body text. Full rich content editing coming soon." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newArt.title.trim() || !newArt.summary.trim()}
              style={{ width: '100%', background: !newArt.title.trim() || !newArt.summary.trim() ? 'rgba(255,255,255,0.08)' : '#00c8ff', border: 'none', color: !newArt.title.trim() || !newArt.summary.trim() ? 'rgba(255,255,255,0.3)' : '#000', borderRadius: 8, padding: '11px 0', cursor: !newArt.title.trim() || !newArt.summary.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
            >
              Publish Article
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────

export function HelpCenter({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [view, setView]         = useState<HelpView>({ type: 'home' })
  const [searchQuery, setQuery] = useState('')

  const goHome     = useCallback(() => setView({ type: 'home' }), [])
  const goCategory = useCallback((id: string) => setView({ type: 'category', categoryId: id }), [])
  const goArticle  = useCallback((id: string) => {
    trackArticleView(id)
    setView({ type: 'article', articleId: id })
  }, [])
  const goSearch   = useCallback((q: string) => { setQuery(q); setView({ type: 'search', query: q }) }, [])
  const goFaq      = useCallback(() => setView({ type: 'faq' }), [])
  const goTutorials = useCallback(() => setView({ type: 'tutorials' }), [])
  const goSupport  = useCallback(() => setView({ type: 'support' }), [])
  const goAdmin    = useCallback(() => setView({ type: 'admin' }), [])

  // Persistent top search bar
  const showTopSearch = view.type !== 'home' && view.type !== 'search'

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Top navigation bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Mini nav tabs */}
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          {[
            { id: 'home',      label: '🏠 Home',     action: goHome },
            { id: 'faq',       label: '❓ FAQ',       action: goFaq },
            { id: 'tutorials', label: '🎓 Tutorials', action: goTutorials },
            { id: 'support',   label: '🎫 Support',   action: goSupport },
            { id: 'admin',     label: '🛠 Admin',     action: goAdmin },
          ].map((item) => {
            const active = view.type === item.id || (item.id === 'home' && view.type === 'home')
            return (
              <button
                key={item.id}
                onClick={item.action}
                style={{
                  background: active ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: active ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                  borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12,
                  fontWeight: active ? 700 : 500, fontFamily: 'inherit', transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Inline search for non-home views */}
        {showTopSearch && (
          <div style={{ width: 260 }}>
            <SearchBar value={searchQuery} onChange={setQuery} onSubmit={goSearch} placeholder="Search docs…" />
          </div>
        )}
      </div>

      {/* View content */}
      {view.type === 'home'     && <HomeView onCategory={goCategory} onArticle={goArticle} onSearch={goSearch} onFaq={goFaq} onTutorials={goTutorials} onSupport={goSupport} />}
      {view.type === 'category' && <CategoryView categoryId={view.categoryId} onArticle={goArticle} onHome={goHome} />}
      {view.type === 'article'  && <ArticleView articleId={view.articleId} onHome={goHome} onCategory={goCategory} onArticle={goArticle} />}
      {view.type === 'search'   && <SearchView query={view.query} onQueryChange={goSearch} onArticle={goArticle} onHome={goHome} />}
      {view.type === 'faq'      && <FAQView onHome={goHome} />}
      {view.type === 'tutorials' && <TutorialsView onHome={goHome} onNavigate={onNavigate} />}
      {view.type === 'support'  && <SupportView onHome={goHome} />}
      {view.type === 'admin'    && <AdminView onHome={goHome} />}
    </div>
  )
}

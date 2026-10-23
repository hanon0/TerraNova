import { useState } from 'react'
import { loadCommunitySubmissions, saveCommunitySubmissions } from './lib/community.js'
import './CommunityPages.css'

const COPY = {
  en: {
    title: 'Community review',
    note: 'Demo only; production needs a backend and peer review.',
    language: 'العربية',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    approve: 'Approve',
    reject: 'Reject',
    noSubmissions: 'No community submissions are stored in this browser.',
    source: 'Required source',
    tags: 'Tags',
    storageError: 'Community data could not be read or saved',
    back: 'Explorer',
  },
  ar: {
    title: 'مراجعة المساهمات',
    note: 'نسخة تجريبية فقط؛ يتطلب الإنتاج خادماً ومراجعة علمية.',
    language: 'English',
    pending: 'قيد المراجعة',
    approved: 'مقبولة',
    rejected: 'مرفوضة',
    approve: 'قبول',
    reject: 'رفض',
    noSubmissions: 'لا توجد مساهمات محفوظة في هذا المتصفح.',
    source: 'المصدر المطلوب',
    tags: 'الوسوم',
    storageError: 'تعذرت قراءة بيانات المجتمع أو حفظها',
    back: 'المستكشف',
  },
}

function isHttpUrl(source) {
  return /^https?:\/\//i.test(source)
}

function initialCommunityState() {
  try {
    return { submissions: loadCommunitySubmissions(), error: '' }
  } catch (error) {
    return {
      submissions: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export default function ReviewPage() {
  const [language, setLanguage] = useState('en')
  const [state, setState] = useState(initialCommunityState)
  const text = COPY[language]

  function review(id, status) {
    const submissions = state.submissions.map((submission) =>
      submission.id === id ? { ...submission, status } : submission,
    )
    try {
      saveCommunitySubmissions(submissions)
      setState({ submissions, error: '' })
    } catch (error) {
      setState({
        ...state,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <main className="community-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="community-header">
        <a href="/" className="community-brand">
          <img src="/terranovalogo.jpeg" alt="TerraNova logo" />
          <strong>TerraNova</strong>
        </a>
        <button
          type="button"
          className="community-language"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
        >
          {text.language}
        </button>
      </header>
      <div className="community-content">
        <p className="eyebrow">TERRANOVA / REVIEW</p>
        <h1>{text.title}</h1>
        <p className="community-demo-note">{text.note}</p>
        <a className="community-back" href="/">
          {text.back}
        </a>
        {state.error && (
          <p className="community-error" role="alert">
            {text.storageError}: {state.error}
          </p>
        )}
        {state.submissions.length === 0 ? (
          <p>{text.noSubmissions}</p>
        ) : (
          <div className="review-list">
            {state.submissions.map((submission) => (
              <article className="review-card" key={submission.id}>
                <div>
                  <span className={`review-status ${submission.status}`}>
                    {text[submission.status]}
                  </span>
                  <h2>
                    {submission.nameEn} · {submission.nameAr}
                  </h2>
                </div>
                <p>
                  {submission.lat.toFixed(5)}, {submission.lon.toFixed(5)} ·{' '}
                  {submission.targetBodies}
                </p>
                <p>
                  {text.tags}: {submission.tags.join(', ')}
                </p>
                <p>
                  {text.source}:{' '}
                  {isHttpUrl(submission.source) ? (
                    <a href={submission.source} target="_blank" rel="noreferrer">
                      {submission.source}
                    </a>
                  ) : (
                    submission.source
                  )}
                </p>
                <p>{submission.geology}</p>
                <p>{submission.environment}</p>
                {submission.status === 'pending' && (
                  <div className="review-actions">
                    <button type="button" onClick={() => review(submission.id, 'approved')}>
                      {text.approve}
                    </button>
                    <button type="button" onClick={() => review(submission.id, 'rejected')}>
                      {text.reject}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

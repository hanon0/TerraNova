import { useState } from 'react'
import { TAGS } from './data/tag-definitions.js'
import {
  communitySubmissionSchema,
  formatGitHubIssue,
  loadCommunitySubmissions,
  saveCommunitySubmissions,
} from './lib/community.js'
import './CommunityPages.css'

const COPY = {
  en: {
    title: 'Community contribution',
    demo: 'Demo only; production needs a backend and peer review.',
    nameAr: 'Site name (Arabic)',
    nameEn: 'Site name (English)',
    pick: 'Click the map to pick coordinates.',
    target: 'Target body',
    geology: 'Geology description',
    environment: 'Environment description',
    source: 'Required source (URL or DOI)',
    tags: 'Characteristics',
    submit: 'Save pending contribution',
    downloadJson: 'Export JSON',
    downloadIssue: 'Export GitHub issue text',
    pending: 'Pending submissions',
    noSubmissions: 'No contributions saved in this browser.',
    coordinateError: 'Pick coordinates on the map first.',
    validation: 'Please correct the form fields.',
    saveError: 'Could not access local storage',
    saved: 'Saved as pending for local review.',
    language: 'العربية',
    bodyLabels: { moon: 'Moon', mars: 'Mars', both: 'Both' },
    communityStorageError: 'Stored contributions could not be read',
    location: 'Picked coordinates',
  },
  ar: {
    title: 'مساهمة مجتمعية',
    demo: 'نسخة تجريبية فقط؛ يتطلب الإنتاج خادماً ومراجعة علمية.',
    nameAr: 'اسم الموقع (بالعربية)',
    nameEn: 'اسم الموقع (بالإنجليزية)',
    pick: 'انقر على الخريطة لاختيار الإحداثيات.',
    target: 'الجرم المستهدف',
    geology: 'وصف الجيولوجيا',
    environment: 'وصف البيئة',
    source: 'مصدر مطلوب (رابط أو DOI)',
    tags: 'الخصائص',
    submit: 'حفظ المساهمة للمراجعة',
    downloadJson: 'تصدير JSON',
    downloadIssue: 'تصدير نص GitHub issue',
    pending: 'المساهمات قيد المراجعة',
    noSubmissions: 'لا توجد مساهمات محفوظة في هذا المتصفح.',
    coordinateError: 'اختر الإحداثيات على الخريطة أولاً.',
    validation: 'يرجى تصحيح حقول النموذج.',
    saveError: 'تعذر الوصول إلى التخزين المحلي',
    saved: 'حُفظت المساهمة للمراجعة المحلية.',
    language: 'English',
    bodyLabels: { moon: 'القمر', mars: 'المريخ', both: 'كلاهما' },
    communityStorageError: 'تعذرت قراءة المساهمات المحفوظة',
    location: 'الإحداثيات المختارة',
  },
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

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function nextSubmissionId(submissions) {
  const usedIds = new Set(submissions.map(({ id }) => id))
  let id = Date.now()
  while (usedIds.has(id)) id += 1
  return id
}

export default function ContributePage() {
  const [language, setLanguage] = useState('en')
  const [communityState, setCommunityState] = useState(initialCommunityState)
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    lat: null,
    lon: null,
    targetBodies: 'moon',
    tags: [],
    geology: '',
    environment: '',
    source: '',
  })
  const [errors, setErrors] = useState([])
  const [success, setSuccess] = useState('')
  const text = COPY[language]
  const disabled = Boolean(communityState.error)

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function pickCoordinates(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top))
    setField('lon', (x / bounds.width) * 360 - 180)
    setField('lat', 90 - (y / bounds.height) * 180)
  }

  function toggleTag(tag) {
    setField(
      'tags',
      form.tags.includes(tag)
        ? form.tags.filter((current) => current !== tag)
        : [...form.tags, tag],
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSuccess('')
    if (form.lat === null || form.lon === null) {
      setErrors([text.coordinateError])
      return
    }
    const result = communitySubmissionSchema.safeParse({
      ...form,
      id: nextSubmissionId(communityState.submissions),
      status: 'pending',
    })
    if (!result.success) {
      setErrors(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
      return
    }
    const submissions = [result.data, ...communityState.submissions]
    try {
      saveCommunitySubmissions(submissions)
      setCommunityState({ submissions, error: '' })
      setErrors([])
      setSuccess(text.saved)
    } catch (error) {
      setErrors([`${text.saveError}: ${error instanceof Error ? error.message : String(error)}`])
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
        <p className="eyebrow">TERRANOVA / COMMUNITY</p>
        <h1>{text.title}</h1>
        <p className="community-demo-note">{text.demo}</p>
        {communityState.error && (
          <p className="community-error" role="alert">
            {text.communityStorageError}: {communityState.error}
          </p>
        )}
        <form className="community-form" onSubmit={handleSubmit}>
          <label>
            {text.nameAr}
            <input
              required
              value={form.nameAr}
              onChange={(event) => setField('nameAr', event.target.value)}
            />
          </label>
          <label>
            {text.nameEn}
            <input
              required
              value={form.nameEn}
              onChange={(event) => setField('nameEn', event.target.value)}
            />
          </label>
          <fieldset className="community-map-picker">
            <legend>{text.pick}</legend>
            <button
              type="button"
              className="contribution-map"
              onClick={pickCoordinates}
              disabled={disabled}
              aria-label={text.pick}
            >
              <svg viewBox="0 0 720 320" preserveAspectRatio="none" aria-hidden="true">
                <rect width="720" height="320" />
                <g>
                  <path d="M52 68 85 46 135 42 171 58 190 86 171 106 145 112 134 136 105 143 88 124 63 118Z" />
                  <path d="m168 157 31 13 13 30-9 33-12 38-15-30-6-38-14-22Z" />
                  <path d="m339 73 29-17 25 12-7 21-29 8Z" />
                  <path d="m374 103 42-3 31 18 9 35-20 38-16 41-21-12-10-39-21-33-9-29Z" />
                  <path d="m437 63 52-21 60 7 41 20 42 2 30 23-24 20-38 1-24 19-32-11-20 21-36-18-32-3-28-20Z" />
                </g>
                {form.lat !== null && form.lon !== null && (
                  <circle
                    cx={((form.lon + 180) / 360) * 720}
                    cy={((90 - form.lat) / 180) * 320}
                    r="8"
                  />
                )}
              </svg>
            </button>
            {form.lat !== null && form.lon !== null && (
              <output>
                {text.location}: {form.lat.toFixed(5)}, {form.lon.toFixed(5)}
              </output>
            )}
          </fieldset>
          <label>
            {text.target}
            <select
              value={form.targetBodies}
              onChange={(event) => setField('targetBodies', event.target.value)}
            >
              {['moon', 'mars', 'both'].map((body) => (
                <option key={body} value={body}>
                  {text.bodyLabels[body]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="community-tag-picker">
            <legend>{text.tags}</legend>
            <div>
              {TAGS.map(([id, nameEn, nameAr]) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={form.tags.includes(id)}
                    onChange={() => toggleTag(id)}
                  />
                  {language === 'ar' ? nameAr : nameEn}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            {text.geology}
            <textarea
              required
              value={form.geology}
              onChange={(event) => setField('geology', event.target.value)}
            />
          </label>
          <label>
            {text.environment}
            <textarea
              required
              value={form.environment}
              onChange={(event) => setField('environment', event.target.value)}
            />
          </label>
          <label>
            {text.source}
            <input
              required
              value={form.source}
              onChange={(event) => setField('source', event.target.value)}
            />
          </label>
          {errors.length > 0 && (
            <ul className="community-error" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {success && (
            <p className="community-success" role="status">
              {success}
            </p>
          )}
          <button type="submit" className="community-submit" disabled={disabled}>
            {text.submit}
          </button>
        </form>
        <section className="community-submissions">
          <h2>{text.pending}</h2>
          {communityState.submissions.length === 0 ? (
            <p>{text.noSubmissions}</p>
          ) : (
            communityState.submissions.map((submission) => (
              <article key={submission.id}>
                <strong>{language === 'ar' ? submission.nameAr : submission.nameEn}</strong>
                <span>{submission.status}</span>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      download(
                        `terranova-community-${submission.id}.json`,
                        JSON.stringify(submission, null, 2),
                        'application/json;charset=utf-8',
                      )
                    }
                  >
                    {text.downloadJson}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      download(
                        `terranova-community-issue-${submission.id}.md`,
                        formatGitHubIssue(submission),
                        'text/markdown;charset=utf-8',
                      )
                    }
                  >
                    {text.downloadIssue}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

/* global React */
/*
  SAFE direction — "Quiet Editorial"
  ──────────────────────────────────
  Same shadcn vocabulary as today but tightened, asymmetric, generous
  whitespace, kicker labels, hairline dividers, no ambient glow blurs.
  Authored hierarchy instead of card-stacking.
*/

const { useState } = React;

// ── Shared bits ─────────────────────────────────────────
function SafeKicker({ children }) {
  return <div className="safe-kicker">{children}</div>;
}
function SafeMetaTag({ children, accent }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999,
      border: '1px solid var(--border)',
      background: accent ? 'var(--primary)' : 'var(--card)',
      color: accent ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
      fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
    }}>{children}</span>
  );
}

// ════════════════════════════════════════════════════════
// 1. RA LAUNCH — small operational dashboard
// ════════════════════════════════════════════════════════
window.SafeLaunch = function SafeLaunch() {
  return (
    <div className="surface safe" style={{ width: '100%', height: '100%', padding: '56px 64px', overflow: 'hidden' }}>
      {/* ── Masthead ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', gap: 32, marginBottom: 36 }}>
        <div>
          <SafeKicker>Misokinesia Study · Lab Operations</SafeKicker>
          <h1 className="safe-h1" style={{ marginTop: 10 }}>Misokinesia Task</h1>
          <p className="safe-body" style={{ marginTop: 8, maxWidth: 540 }}>
            Launch a participant session, run a rehearsal trial, or review recent activity for this lab module.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          <button className="safe-btn">
            <PlayIcon /> Start Misokinesia Session
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="safe-btn safe-btn-ghost">
              <FlaskIcon /> Short Trial
            </button>
            <button className="safe-btn safe-btn-ghost">
              <FlaskIcon /> Full Trial
            </button>
          </div>
          <div className="safe-meta" style={{ marginTop: 4 }}>Trials use fake ids · no data is written</div>
        </div>
      </div>

      {/* ── Metric strip ─────────────────────────── */}
      <div className="safe-card" style={{ padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
          {[
            { label: 'Total participants', value: '147', delta: '+12 this week' },
            { label: 'Completed sessions', value: '132', delta: '89.8% completion' },
            { label: 'Avg session', value: '18m 42s', delta: 'across last 30' },
            { label: 'Active stimuli', value: '25', delta: '4 decommissioned' },
          ].map((m, i) => (
            <div key={i} style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--border)', paddingLeft: i === 0 ? 0 : 32 }}>
              <div className="safe-meta">{m.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6, color: 'var(--foreground)' }} className="tabular">{m.value}</div>
              <div className="safe-meta" style={{ marginTop: 4, color: 'var(--ink-45)' }}>{m.delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column: Sessions list + Trial/Prod split ─ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 24 }}>
        {/* Recent sessions */}
        <div className="safe-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <SafeKicker>Recent sessions</SafeKicker>
            <button className="safe-btn safe-btn-ghost" style={{ height: 32, fontSize: 11, padding: '0 12px' }}>
              <UndoIcon /> Undo last session
            </button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {[
              { id: 'MKP-0149', stamp: '2 min ago', clips: '25/25', kind: 'production', status: 'complete' },
              { id: 'MKP-0148', stamp: '1h 12m ago', clips: '25/25', kind: 'production', status: 'complete' },
              { id: 'MKP-—', stamp: '2h 04m ago', clips: '5/5', kind: 'short trial', status: 'rehearsal' },
              { id: 'MKP-0147', stamp: '3h 51m ago', clips: '12/25', kind: 'production', status: 'incomplete' },
              { id: 'MKP-0146', stamp: 'Yesterday · 16:22', clips: '25/25', kind: 'production', status: 'complete' },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 110px 110px',
                gap: 16, alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }} className="tabular">{row.id}</div>
                <div className="safe-meta" style={{ textTransform: 'none', letterSpacing: 0 }}>{row.stamp}</div>
                <div className="safe-meta tabular" style={{ textTransform: 'none', letterSpacing: 0 }}>{row.clips}</div>
                <div>
                  <SafeMetaTag accent={row.status === 'complete'}>{row.kind}</SafeMetaTag>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trial vs Production split */}
        <div className="safe-card" style={{ padding: '20px 24px' }}>
          <SafeKicker>Trial vs production · 30 days</SafeKicker>
          <div style={{ marginTop: 18 }}>
            {/* split bar */}
            <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--muted)' }}>
              <div style={{ width: '72%', background: 'var(--primary)' }} />
              <div style={{ width: '28%', background: 'var(--ubc-blue-300)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--primary)' }} />
                  <span className="safe-meta">Production</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }} className="tabular">42</div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ubc-blue-300)' }} />
                  <span className="safe-meta">Trial runs</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }} className="tabular">16</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 22, paddingTop: 18 }}>
            <SafeKicker>Module health</SafeKicker>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { k: 'API', v: 'Online', ok: true },
                { k: 'Stimuli CDN', v: '25 active', ok: true },
                { k: 'Survey order', v: 'Randomised', ok: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: row.ok ? '#16a34a' : 'var(--destructive)' }} />
                    <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{row.k}</span>
                  </div>
                  <span className="safe-meta" style={{ textTransform: 'none', letterSpacing: 0 }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// 2. SAFE — Demographics
// ════════════════════════════════════════════════════════
window.SafeDemographics = function SafeDemographics() {
  const [age, setAge] = useState('25-31');
  const [gender, setGender] = useState('Woman');
  const [country, setCountry] = useState('Canada');

  return (
    <div className="surface safe" style={{ width: '100%', height: '100%', padding: '64px 0', overflow: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
        {/* Quiet step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <span className="safe-meta tabular">01 / 04</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="safe-meta">Demographics → Intro → Task → Surveys</span>
        </div>

        <SafeKicker>Before we begin</SafeKicker>
        <h1 className="safe-h1" style={{ marginTop: 10 }}>About you</h1>
        <p className="safe-body" style={{ marginTop: 10, maxWidth: 520 }}>
          All questions are optional. You can skip any you prefer not to answer. Your answers are stored anonymously.
        </p>

        {/* Form sections separated by hairlines, not cards within cards */}
        <div className="safe-card" style={{ marginTop: 36, padding: '8px 28px' }}>
          {[
            {
              label: 'Age group',
              control: (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Under 18', '18-24', '25-31', '32-38', 'Over 38'].map((o) => (
                    <button key={o} className="safe-chip" data-selected={age === o} onClick={() => setAge(o)}>{o}</button>
                  ))}
                </div>
              )
            },
            {
              label: 'Gender identity',
              control: (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Woman', 'Man', 'Nonbinary person', 'Prefer not to say', 'Not listed'].map((o) => (
                    <button key={o} className="safe-chip" data-selected={gender === o} onClick={() => setGender(o)}>{o}</button>
                  ))}
                </div>
              )
            },
            {
              label: 'Country of current residence',
              control: (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Canada', 'South Korea', 'Not listed'].map((o) => (
                    <button key={o} className="safe-chip" data-selected={country === o} onClick={() => setCountry(o)}>{o}</button>
                  ))}
                </div>
              )
            },
            {
              label: 'Nationality',
              hint: 'Free text',
              control: (
                <input placeholder="Optional"
                  style={{
                    width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--border)',
                    background: 'var(--background)', padding: '0 14px', fontFamily: 'inherit', fontSize: 13,
                    color: 'var(--foreground)', outline: 'none',
                  }} />
              )
            },
          ].map((row, i, arr) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32,
              padding: '22px 0',
              borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              alignItems: 'start',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{row.label}</div>
                {row.hint && <div className="safe-meta" style={{ marginTop: 4, textTransform: 'none', letterSpacing: 0 }}>{row.hint}</div>}
              </div>
              {row.control}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <span className="safe-meta">Roughly 18 minutes to complete</span>
          <button className="safe-btn" style={{ minWidth: 160 }}>Continue →</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// 3. SAFE — Per-clip questionnaire (after each clip)
// ════════════════════════════════════════════════════════
window.SafePerClip = function SafePerClip() {
  const QUESTIONS = [
    'I find this video unpleasant',
    'I felt physical discomfort during the video',
    'I felt upset during the video',
    'I wanted to stop the video early / or close my eyes',
  ];
  const SCALE = [
    { v: 1, l: 'Strongly Disagree' },
    { v: 2, l: 'Disagree' },
    { v: 3, l: 'Neutral' },
    { v: 4, l: 'Agree' },
    { v: 5, l: 'Strongly Agree' },
  ];
  const [answers, setAnswers] = useState({ 0: 4, 1: 3, 2: 4 });
  const answered = Object.keys(answers).length;

  return (
    <div className="surface safe" style={{ width: '100%', height: '100%', padding: '56px 0', overflow: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
        {/* Progress strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <span className="safe-meta tabular">Clip 12 of 25</span>
          <div style={{ flex: 1, height: 2, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '48%', height: '100%', background: 'var(--primary)' }} />
          </div>
          <span className="safe-meta tabular">48%</span>
        </div>

        <SafeKicker>Post-clip · 4 questions</SafeKicker>
        <h2 className="safe-h2" style={{ marginTop: 10 }}>How did you feel about that clip?</h2>
        <p className="safe-body" style={{ marginTop: 8 }}>
          Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree). There are no right answers.
        </p>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {QUESTIONS.map((q, i) => (
            <div key={i} className="safe-fieldset">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                <span className="safe-meta tabular" style={{ minWidth: 24 }}>Q{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.45 }}>{q}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 36 }}>
                {SCALE.map((opt) => (
                  <button key={opt.v}
                    className="safe-chip"
                    data-selected={answers[i] === opt.v}
                    onClick={() => setAnswers((p) => ({ ...p, [i]: opt.v }))}
                    style={{ minWidth: 64, flexDirection: 'column', height: 'auto', padding: '8px 12px', gap: 2 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.v}</span>
                    <span style={{ fontSize: 10, opacity: 0.8, letterSpacing: 0, textTransform: 'none' }}>{opt.l}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <span className="safe-meta tabular">{answered}/4 answered</span>
          <button className="safe-btn" style={{ minWidth: 160 }} disabled={answered < 4}>Continue →</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// 4. SAFE — MkAQ paned carousel (Part 3 of 4)
// ════════════════════════════════════════════════════════
window.SafeMkaq = function SafeMkaq() {
  const ITEMS = [
    'My visual issues currently make me feel frustrated.',
    'My visual issues currently impact my entire life negatively.',
    'My visual issues have recently made me feel guilty.',
    'My visual issues are classified as ‘crazy’.',
    'I feel that no one can help me with my visual issues.',
  ];
  const SCALE = [
    { v: 0, l: 'Not at all' },
    { v: 1, l: 'A little of the time' },
    { v: 2, l: 'A good deal of the time' },
    { v: 3, l: 'Almost all the time' },
  ];
  const [answers, setAnswers] = useState({ 0: 2, 1: 1, 2: 0 });
  const answered = Object.keys(answers).length;

  return (
    <div className="surface safe" style={{ width: '100%', height: '100%', padding: '56px 0', overflow: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
        {/* Paginated header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <span className="safe-meta">MkAQ · Misokinesia Assessment</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 28, height: 4, borderRadius: 999,
                background: i === 2 ? 'var(--primary)' : i < 2 ? 'var(--ubc-blue-300)' : 'var(--muted)',
              }} />
            ))}
          </div>
          <span className="safe-meta tabular">Part 3 / 4</span>
        </div>

        <SafeKicker>Items 11–15 of 21</SafeKicker>
        <h2 className="safe-h2" style={{ marginTop: 10 }}>Please rate each statement</h2>
        <p className="safe-body" style={{ marginTop: 8 }}>
          0&nbsp;·&nbsp;Not at all &nbsp;·&nbsp; 1&nbsp;·&nbsp;A little &nbsp;·&nbsp; 2&nbsp;·&nbsp;A good deal &nbsp;·&nbsp; 3&nbsp;·&nbsp;Almost all the time
        </p>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ITEMS.map((q, i) => (
            <div key={i} className="safe-fieldset" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 16, alignItems: 'center' }}>
                <span className="safe-meta tabular" style={{ alignSelf: 'start', marginTop: 4 }}>{(11 + i).toString().padStart(2, '0')}</span>
                <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>{q}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SCALE.map((opt) => (
                    <button key={opt.v} className="safe-chip"
                      data-selected={answers[i] === opt.v}
                      onClick={() => setAnswers((p) => ({ ...p, [i]: opt.v }))}
                      title={opt.l}
                      style={{ minWidth: 40, padding: '0 10px', fontWeight: 600 }}
                    >{opt.v}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <span className="safe-meta tabular">{answered}/5 answered on this part · 13/21 overall</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="safe-btn safe-btn-ghost" style={{ minWidth: 120 }}>← Previous</button>
            <button className="safe-btn" style={{ minWidth: 120 }} disabled={answered < 5}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// 5. SAFE — Transition card (between video loop and a post-survey)
//    Reference template; MkAQ shown. GAD-7/MAQ swap title + copy.
// ════════════════════════════════════════════════════════
window.SafeTransition = function SafeTransition() {
  const NEXT = {
    kicker: 'Up next · Survey 1 of 3',
    title: 'Misokinesia Assessment',
    description:
      'A short questionnaire about how certain visual stimuli affect you. Answer based on the past two weeks. There are no right or wrong answers.',
    meta: [
      { k: 'Items', v: '21 statements' },
      { k: 'Format', v: '4 panes · Previous available' },
      { k: 'Scale', v: '0–3 · Not at all → Almost all' },
      { k: 'Estimated', v: '≈ 5 minutes' },
    ],
  };

  return (
    <div className="surface safe" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        {/* Block-stage step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <span className="safe-meta tabular">Clips complete</span>
          <CheckGlyph />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 24, height: 4, borderRadius: 999,
                background: i === 0 ? 'var(--primary)' : 'var(--muted)',
              }} />
            ))}
          </div>
          <span className="safe-meta tabular">1 / 3 surveys</span>
        </div>

        <div className="safe-card" style={{ padding: '40px 44px' }}>
          <SafeKicker>{NEXT.kicker}</SafeKicker>
          <h1 className="safe-h1" style={{ marginTop: 12, fontSize: 34 }}>{NEXT.title}</h1>
          <p className="safe-body" style={{ marginTop: 14, fontSize: 14 }}>{NEXT.description}</p>

          <div style={{ marginTop: 28, borderTop: '1px solid var(--border)' }}>
            {NEXT.meta.map((row, i, arr) => (
              <div key={row.k} style={{
                display: 'grid', gridTemplateColumns: '140px 1fr', gap: 24,
                padding: '12px 0',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              }}>
                <span className="safe-meta">{row.k}</span>
                <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{row.v}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, padding: '12px 14px',
            background: 'var(--fieldset-bg)', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <PauseGlyph />
            <span className="safe-body" style={{ fontSize: 12 }}>
              Take a breath before continuing — you can pause between questions.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="safe-btn" style={{ minWidth: 200 }}>Begin assessment →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

function CheckGlyph() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: 999, background: 'var(--primary)',
      color: 'var(--primary-foreground)',
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 13l4 4L19 7"/>
      </svg>
    </span>
  );
}
function PauseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>
  );
}

// ── Icons (tiny inline SVG so we don't ship lucide) ──
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function FlaskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3"/>
      <path d="M9 3h6"/>
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15.5-6.36L3 13"/>
    </svg>
  );
}

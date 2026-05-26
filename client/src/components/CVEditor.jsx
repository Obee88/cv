import { useState, useEffect, useCallback, useRef } from 'react';

// ── Utility: section card wrapper ────────────────────────────────────────────
function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card section-card">
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <div className="section-title-row">
          <div className="section-icon">{icon}</div>
          <span className="section-name">{title}</span>
        </div>
        <span className={`section-chevron ${open ? 'open' : ''}`}>▼</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// ── Skills tag input ─────────────────────────────────────────────────────────
function SkillsInput({ skills, onChange }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef();

  function addSkill(val) {
    const trimmed = val.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setDraft('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(draft);
    } else if (e.key === 'Backspace' && !draft && skills.length) {
      onChange(skills.slice(0, -1));
    }
  }

  return (
    <div className="skills-input-wrap" onClick={() => inputRef.current?.focus()}>
      {skills.map((s, i) => (
        <span key={i} className="skill-tag">
          {s}
          <button type="button" onClick={() => onChange(skills.filter((_, idx) => idx !== i))}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="skills-text-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (draft.trim()) addSkill(draft); }}
        placeholder={skills.length ? '' : 'Type a skill and press Enter…'}
      />
    </div>
  );
}

// ── Language dots picker ─────────────────────────────────────────────────────
function DotsPicker({ value = 4, onChange }) {
  return (
    <div className="dots-select">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`dot-btn ${n <= value ? 'filled' : ''}`}
          onClick={() => onChange(n)}
          title={`${n}/5`}
        />
      ))}
    </div>
  );
}

// ── Photo upload ─────────────────────────────────────────────────────────────
function PhotoUpload({ photo, onChange }) {
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }
  return (
    <div className="photo-upload">
      {photo
        ? <img className="photo-preview" src={photo} alt="Profile" />
        : <div className="photo-placeholder">👤</div>
      }
      <div>
        <label
          htmlFor="photo-file"
          className="btn btn-secondary btn-sm"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          📷 {photo ? 'Change photo' : 'Upload photo'}
        </label>
        <input
          id="photo-file"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        {photo && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => onChange('')}
          >
            Remove
          </button>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Shown as a circular photo in the PDF
        </p>
      </div>
    </div>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────────
export default function CVEditor({ token, email, onLogout }) {
  const [cv, setCv] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const [pdfLoading, setPdfLoading] = useState(false);
  const saveTimer = useRef(null);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Load CV on mount
  useEffect(() => {
    fetch('/api/cv', { headers: headers() })
      .then(r => {
        if (r.status === 401) { onLogout(); return null; }
        return r.json();
      })
      .then(data => { if (data) setCv(data); })
      .catch(() => setSaveStatus('error'));
  }, []);

  // Auto-save after 1.5s of inactivity
  useEffect(() => {
    if (!cv) return;
    clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => {
      fetch('/api/cv', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ data: cv }),
      })
        .then(r => r.ok ? setSaveStatus('saved') : setSaveStatus('error'))
        .catch(() => setSaveStatus('error'));
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [cv]);

  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch('/api/cv/pdf', { headers: headers() });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cv.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  // Generic updater helpers
  function update(path, value) {
    setCv(prev => {
      const parts = path.split('.');
      const next = { ...prev };
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }

  function updatePi(field, value) {
    setCv(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
  }

  function addItem(key, template) {
    setCv(prev => ({ ...prev, [key]: [...(prev[key] || []), template] }));
  }

  function removeItem(key, idx) {
    setCv(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  }

  function updateItem(key, idx, field, value) {
    setCv(prev => ({
      ...prev,
      [key]: prev[key].map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  }

  function addBullet(expIdx) {
    setCv(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIdx ? { ...exp, bullets: [...(exp.bullets || []), ''] } : exp
      ),
    }));
  }

  function updateBullet(expIdx, bIdx, value) {
    setCv(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIdx
          ? { ...exp, bullets: exp.bullets.map((b, j) => j === bIdx ? value : b) }
          : exp
      ),
    }));
  }

  function removeBullet(expIdx, bIdx) {
    setCv(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIdx ? { ...exp, bullets: exp.bullets.filter((_, j) => j !== bIdx) } : exp
      ),
    }));
  }

  if (!cv) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading your CV…
      </div>
    );
  }

  const pi = cv.personalInfo || {};

  return (
    <div className="app-shell">
      {/* ── Top bar ── */}
      <nav className="topbar">
        <div className="topbar-inner">
          <span className="topbar-brand">📄 CV Builder</span>
          <div className="topbar-actions">
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && '💾 Saving…'}
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'error' && '⚠ Save failed'}
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={downloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Generating…' : '⬇ Download PDF'}
            </button>
            <span className="topbar-email">{email}</span>
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Editor ── */}
      <div className="editor-wrap">

        {/* Personal Info */}
        <Section icon="👤" title="Personal Information" defaultOpen>
          <div className="field">
            <PhotoUpload photo={pi.photo} onChange={v => updatePi('photo', v)} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Full Name</label>
              <input type="text" value={pi.name || ''} onChange={e => updatePi('name', e.target.value)} placeholder="SANJA VUKUŠIĆ" />
            </div>
            <div className="field">
              <label>Job Title / Subtitle</label>
              <input type="text" value={pi.title || ''} onChange={e => updatePi('title', e.target.value)} placeholder="Relationship Manager and Team Lead" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={pi.email || ''} onChange={e => updatePi('email', e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="field">
              <label>LinkedIn URL</label>
              <input type="text" value={pi.linkedin || ''} onChange={e => updatePi('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="field">
              <label>Location</label>
              <input type="text" value={pi.location || ''} onChange={e => updatePi('location', e.target.value)} placeholder="Zagreb" />
            </div>
          </div>
        </Section>

        {/* Summary */}
        <Section icon="📝" title="Summary" defaultOpen>
          <div className="field">
            <label>Professional Summary</label>
            <textarea
              rows={5}
              value={cv.summary || ''}
              onChange={e => setCv(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Describe your professional background, key skills, and career goals…"
            />
          </div>
        </Section>

        {/* Experience */}
        <Section icon="💼" title="Experience" defaultOpen>
          {(cv.experience || []).map((exp, idx) => (
            <div key={idx} className="array-item">
              <div className="array-item-header">
                <span className="array-item-title">Position {idx + 1}</span>
                <button className="btn btn-danger" onClick={() => removeItem('experience', idx)}>Remove</button>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Job Title</label>
                  <input type="text" value={exp.title || ''} onChange={e => updateItem('experience', idx, 'title', e.target.value)} placeholder="Team Lead and Relationship Manager" />
                </div>
                <div className="field">
                  <label>Company</label>
                  <input type="text" value={exp.company || ''} onChange={e => updateItem('experience', idx, 'company', e.target.value)} placeholder="OTP banka" />
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="text" value={exp.startDate || ''} onChange={e => updateItem('experience', idx, 'startDate', e.target.value)} placeholder="03/2017" />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="text" value={exp.endDate || ''} onChange={e => updateItem('experience', idx, 'endDate', e.target.value)} placeholder="Present" />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input type="text" value={exp.location || ''} onChange={e => updateItem('experience', idx, 'location', e.target.value)} placeholder="Zagreb" />
                </div>
              </div>
              <div className="field">
                <label>Company Description</label>
                <input type="text" value={exp.companyDescription || ''} onChange={e => updateItem('experience', idx, 'companyDescription', e.target.value)} placeholder="Brief description of the company…" />
              </div>
              <div className="field">
                <label>Responsibilities / Bullets</label>
                {(exp.bullets || []).map((b, bIdx) => (
                  <div key={bIdx} className="bullet-row">
                    <textarea
                      rows={2}
                      value={b}
                      onChange={e => updateBullet(idx, bIdx, e.target.value)}
                      placeholder="Describe a responsibility or achievement…"
                    />
                    <button className="bullet-delete" onClick={() => removeBullet(idx, bIdx)} title="Remove">×</button>
                  </div>
                ))}
                <button className="btn btn-icon btn-sm" onClick={() => addBullet(idx)}>+ Add bullet</button>
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('experience', { title: '', company: '', startDate: '', endDate: '', location: '', companyDescription: '', bullets: [] })}
          >
            + Add Experience
          </button>
        </Section>

        {/* Key Achievements */}
        <Section icon="🏆" title="Key Achievements">
          {(cv.keyAchievements || []).map((ach, idx) => (
            <div key={idx} className="array-item">
              <div className="array-item-header">
                <span className="array-item-title">Achievement {idx + 1}</span>
                <button className="btn btn-danger" onClick={() => removeItem('keyAchievements', idx)}>Remove</button>
              </div>
              <div className="field">
                <label>Title</label>
                <input type="text" value={ach.title || ''} onChange={e => updateItem('keyAchievements', idx, 'title', e.target.value)} placeholder="Team leadership" />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={ach.description || ''} onChange={e => updateItem('keyAchievements', idx, 'description', e.target.value)} placeholder="Describe this achievement…" />
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('keyAchievements', { title: '', description: '' })}
          >
            + Add Achievement
          </button>
        </Section>

        {/* Education */}
        <Section icon="🎓" title="Education">
          {(cv.education || []).map((edu, idx) => (
            <div key={idx} className="array-item">
              <div className="array-item-header">
                <span className="array-item-title">Degree {idx + 1}</span>
                <button className="btn btn-danger" onClick={() => removeItem('education', idx)}>Remove</button>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Degree / Programme</label>
                  <input type="text" value={edu.degree || ''} onChange={e => updateItem('education', idx, 'degree', e.target.value)} placeholder="Master's degree, Macroeconomics" />
                </div>
                <div className="field">
                  <label>School / University</label>
                  <input type="text" value={edu.school || ''} onChange={e => updateItem('education', idx, 'school', e.target.value)} placeholder="University of Zagreb" />
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="text" value={edu.startDate || ''} onChange={e => updateItem('education', idx, 'startDate', e.target.value)} placeholder="01/2004" />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="text" value={edu.endDate || ''} onChange={e => updateItem('education', idx, 'endDate', e.target.value)} placeholder="12/2009" />
                </div>
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('education', { degree: '', school: '', startDate: '', endDate: '' })}
          >
            + Add Education
          </button>
        </Section>

        {/* Certifications */}
        <Section icon="📜" title="Certifications">
          {(cv.certifications || []).map((cert, idx) => (
            <div key={idx} className="array-item">
              <div className="array-item-header">
                <span className="array-item-title">Certification {idx + 1}</span>
                <button className="btn btn-danger" onClick={() => removeItem('certifications', idx)}>Remove</button>
              </div>
              <div className="field">
                <label>Certification Name</label>
                <input type="text" value={cert.name || ''} onChange={e => updateItem('certifications', idx, 'name', e.target.value)} placeholder="CFA Exam Level I, II and III passed June 2018" />
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('certifications', { name: '' })}
          >
            + Add Certification
          </button>
        </Section>

        {/* Skills */}
        <Section icon="🛠" title="Skills">
          <div className="field">
            <label>Skills (type and press Enter)</label>
            <SkillsInput
              skills={cv.skills || []}
              onChange={skills => setCv(prev => ({ ...prev, skills }))}
            />
          </div>
        </Section>

        {/* Languages */}
        <Section icon="🌍" title="Languages">
          {(cv.languages || []).map((lang, idx) => (
            <div key={idx} className="array-item">
              <div className="array-item-header">
                <span className="array-item-title">Language {idx + 1}</span>
                <button className="btn btn-danger" onClick={() => removeItem('languages', idx)}>Remove</button>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label>Language</label>
                  <input type="text" value={lang.language || ''} onChange={e => updateItem('languages', idx, 'language', e.target.value)} placeholder="English" />
                </div>
                <div className="field">
                  <label>Level</label>
                  <input type="text" value={lang.level || ''} onChange={e => updateItem('languages', idx, 'level', e.target.value)} placeholder="Proficient" />
                </div>
                <div className="field">
                  <label>Proficiency (dots)</label>
                  <DotsPicker
                    value={lang.dots ?? 4}
                    onChange={v => updateItem('languages', idx, 'dots', v)}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('languages', { language: '', level: '', dots: 4 })}
          >
            + Add Language
          </button>
        </Section>

        {/* Interests */}
        <Section icon="✨" title="Interests">
          {(cv.interests || []).map((interest, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                type="text"
                style={{ flex: 1 }}
                value={interest}
                onChange={e => {
                  const next = [...cv.interests];
                  next[idx] = e.target.value;
                  setCv(prev => ({ ...prev, interests: next }));
                }}
                placeholder="Financial modeling and planning"
              />
              <button
                className="bullet-delete"
                onClick={() => removeItem('interests', idx)}
                title="Remove"
              >×</button>
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => addItem('interests', '')}
          >
            + Add Interest
          </button>
        </Section>

        {/* Bottom spacer */}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

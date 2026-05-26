const puppeteer = require('puppeteer-core');

const CHROMIUM_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

async function generateCVPdf(cvData) {
  const html = buildHtml(cvData);

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(str) {
  return esc(str).replace(/\n/g, '<br>');
}

function dots(level, custom) {
  const map = {
    native: 5, Native: 5,
    fluent: 5, Fluent: 5,
    proficient: 4, Proficient: 4,
    'upper intermediate': 3, 'Upper Intermediate': 3,
    intermediate: 3, Intermediate: 3,
    basic: 2, Basic: 2,
    beginner: 1, Beginner: 1,
  };
  const filled = custom != null ? Number(custom) : (map[level] ?? 3);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="dot ${i < filled ? 'dot-on' : 'dot-off'}"></span>`
  ).join('');
}

// SVG icons – inline, filled with current color via CSS
const ICON_EMAIL = `<svg viewBox="0 0 20 20" width="11" height="11" fill="#777" style="flex-shrink:0;margin-right:4px"><path d="M2 5.5A1.5 1.5 0 013.5 4h13A1.5 1.5 0 0118 5.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 14.5v-9zm1.5-.5a.5.5 0 00-.5.5l7 4.667 7-4.667A.5.5 0 0016.5 5h-13zm-.5 9a.5.5 0 00.5.5h13a.5.5 0 00.5-.5V7.2l-6.72 4.48a.5.5 0 01-.56 0L3 7.2V14z"/></svg>`;
const ICON_LINKEDIN = `<svg viewBox="0 0 20 20" width="11" height="11" fill="#777" style="flex-shrink:0;margin-right:4px"><path d="M17 3H3a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1zM7.5 15.5h-2v-7h2v7zm-1-8a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm9 8h-2v-3.5c0-1.378-1.75-1.272-1.75 0V15.5h-2v-7h2v1.07C12.375 8.1 14.5 8.022 14.5 10.67V15.5z"/></svg>`;
const ICON_PIN = `<svg viewBox="0 0 20 20" width="11" height="11" fill="#777" style="flex-shrink:0;margin-right:4px"><path d="M10 2a6 6 0 016 6c0 4.5-6 11-6 11S4 12.5 4 8a6 6 0 016-6zm0 4a2 2 0 100 4 2 2 0 000-4z"/></svg>`;
const ICON_CAL = `<svg viewBox="0 0 20 20" width="10" height="10" fill="#999" style="flex-shrink:0;margin-right:3px"><path d="M6 1v1H4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-2V1h-2v1H8V1H6zm-2 5h12v9H4V6z"/></svg>`;
const ICON_LOC = `<svg viewBox="0 0 20 20" width="10" height="10" fill="#999" style="flex-shrink:0;margin-right:3px"><path d="M10 2a5 5 0 015 5c0 3.75-5 9.5-5 9.5S5 10.75 5 7a5 5 0 015-5zm0 3a2 2 0 100 4 2 2 0 000-4z"/></svg>`;

// Diamond icon box (used for interests and key achievements)
const diamondBox = (size = 22) => `
  <span style="
    display:inline-flex;align-items:center;justify-content:center;
    width:${size}px;height:${size}px;
    background:#e3f5f4;border-radius:5px;flex-shrink:0;">
    <span style="
      display:block;width:${Math.round(size * 0.43)}px;height:${Math.round(size * 0.43)}px;
      background:#00a99d;border-radius:2px;transform:rotate(45deg);">
    </span>
  </span>`;

// Section header with extending rule
const sectionHead = (title) => `
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;margin-top:10px;">
    <span style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:#777;white-space:nowrap;">${esc(title)}</span>
    <div style="flex:1;height:1px;background:#d8d8d8;"></div>
  </div>`;

// ─── HTML builder ────────────────────────────────────────────────────────────

function buildHtml(cv) {
  const pi = cv.personalInfo || {};
  const experience = cv.experience || [];
  const education = cv.education || [];
  const certifications = cv.certifications || [];
  const skills = cv.skills || [];
  const languages = cv.languages || [];
  const interests = cv.interests || [];
  const keyAchievements = cv.keyAchievements || [];
  const summary = cv.summary || '';

  // ── left column sections ─────────────────────────────────────────────────

  const summaryHtml = summary ? `
    ${sectionHead('Summary')}
    <p style="font-size:8.5pt;line-height:1.55;color:#333;margin:0;">${nl2br(summary)}</p>
  ` : '';

  const experienceHtml = experience.length ? `
    ${sectionHead('Experience')}
    ${experience.map(exp => `
      <div style="margin-bottom:9px;">
        <div style="font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:1px;">${esc(exp.title)}</div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0;margin-bottom:3px;">
          <span style="font-size:8.5pt;font-weight:700;color:#00a99d;">${esc(exp.company)}</span>
          ${exp.startDate || exp.endDate ? `
            <span style="display:inline-flex;align-items:center;font-size:7.5pt;color:#999;margin-left:8px;">
              ${ICON_CAL}${esc(exp.startDate || '')}${exp.endDate ? ' - ' + esc(exp.endDate) : ''}
            </span>` : ''}
          ${exp.location ? `
            <span style="display:inline-flex;align-items:center;font-size:7.5pt;color:#999;margin-left:8px;">
              ${ICON_LOC}${esc(exp.location)}
            </span>` : ''}
        </div>
        ${exp.companyDescription ? `<p style="font-size:8pt;color:#777;font-style:italic;margin:0 0 3px 0;">${esc(exp.companyDescription)}</p>` : ''}
        ${(exp.bullets || []).length ? `
          <ul style="margin:3px 0 0 0;padding-left:14px;">
            ${exp.bullets.map(b => `<li style="font-size:8.5pt;color:#333;margin-bottom:2px;">${nl2br(b)}</li>`).join('')}
          </ul>` : ''}
      </div>
    `).join('')}
  ` : '';

  const achievementsHtml = keyAchievements.length ? `
    ${sectionHead('Key Achievements')}
    ${keyAchievements.map(a => `
      <div style="display:flex;gap:7px;margin-bottom:7px;align-items:flex-start;">
        ${diamondBox(26)}
        <div>
          <div style="font-size:9.5pt;font-weight:700;color:#1a1a1a;margin-bottom:1px;">${esc(a.title)}</div>
          <div style="font-size:8.5pt;color:#333;line-height:1.45;">${nl2br(a.description)}</div>
        </div>
      </div>
    `).join('')}
  ` : '';

  const languagesHtml = languages.length ? `
    ${sectionHead('Languages')}
    ${languages.map(l => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
        <span style="font-size:9pt;font-weight:700;color:#333;min-width:60px;">${esc(l.language)}</span>
        <span style="font-size:8pt;color:#666;min-width:60px;">${esc(l.level)}</span>
        <span style="display:inline-flex;gap:3px;align-items:center;">${dots(l.level, l.dots)}</span>
      </div>
    `).join('')}
  ` : '';

  // ── right column sections ────────────────────────────────────────────────

  const educationHtml = education.length ? `
    ${sectionHead('Education')}
    ${education.map(e => `
      <div style="margin-bottom:8px;">
        <div style="font-size:10pt;font-weight:700;color:#1a1a1a;margin-bottom:1px;">${esc(e.degree)}</div>
        <div style="font-size:8.5pt;font-weight:700;color:#00a99d;margin-bottom:2px;">${esc(e.school)}</div>
        ${e.startDate || e.endDate ? `
          <div style="display:inline-flex;align-items:center;font-size:7.5pt;color:#999;">
            ${ICON_CAL}${esc(e.startDate || '')}${e.endDate ? ' - ' + esc(e.endDate) : ''}
          </div>` : ''}
      </div>
    `).join('')}
  ` : '';

  const certHtml = certifications.length ? `
    ${sectionHead('Certification')}
    ${certifications.map(c => `
      <div style="font-size:9pt;font-weight:700;color:#00a99d;margin-bottom:5px;">${esc(c.name)}</div>
    `).join('')}
  ` : '';

  const skillsHtml = skills.length ? `
    ${sectionHead('Skills')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
      ${skills.map(s => `
        <div style="font-size:8pt;color:#333;padding:4px 0;border-bottom:1px solid #ececec;">${esc(s)}</div>
      `).join('')}
    </div>
  ` : '';

  const interestsHtml = interests.length ? `
    ${sectionHead('Interests')}
    ${interests.map(i => `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
        ${diamondBox(22)}
        <span style="font-size:9pt;color:#333;">${esc(i)}</span>
      </div>
    `).join('')}
  ` : '';

  // ── assemble page ────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #333;
    background: #fff;
    width: 210mm;
    min-height: 297mm;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 13mm 14mm 14mm 14mm;
  }
  ul { list-style: disc; }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot-on  { background: #00a99d; }
  .dot-off { background: #d6d6d6; }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ HEADER ═══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
    <div style="flex:1;">
      <div style="font-size:28pt;font-weight:900;color:#1a1a1a;letter-spacing:1px;text-transform:uppercase;line-height:1;margin-bottom:4px;">
        ${esc(pi.name || 'YOUR NAME')}
      </div>
      <div style="font-size:11pt;color:#00a99d;margin-bottom:7px;font-weight:400;">
        ${esc(pi.title || '')}
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${pi.email ? `<div style="display:inline-flex;align-items:center;font-size:8.5pt;color:#555;">${ICON_EMAIL}${esc(pi.email)}</div>` : ''}
        ${pi.linkedin ? `<div style="display:inline-flex;align-items:center;font-size:8.5pt;color:#555;">${ICON_LINKEDIN}${esc(pi.linkedin)}</div>` : ''}
        ${pi.location ? `<div style="display:inline-flex;align-items:center;font-size:8.5pt;color:#555;">${ICON_PIN}${esc(pi.location)}</div>` : ''}
      </div>
    </div>
    ${pi.photo ? `
    <div style="flex-shrink:0;margin-left:10px;">
      <img src="${pi.photo}" alt="Photo"
        style="width:28mm;height:28mm;border-radius:50%;object-fit:cover;display:block;" />
    </div>` : ''}
  </div>

  <!-- full-width divider -->
  <div style="width:100%;height:1px;background:#d0d0d0;margin-bottom:4px;"></div>

  <!-- ═══ TWO COLUMNS ═══ -->
  <div style="display:grid;grid-template-columns:108mm 1fr;gap:9mm;align-items:start;">

    <!-- LEFT COLUMN -->
    <div>
      ${summaryHtml}
      ${experienceHtml}
      ${achievementsHtml}
      ${languagesHtml}
    </div>

    <!-- RIGHT COLUMN -->
    <div>
      ${educationHtml}
      ${certHtml}
      ${skillsHtml}
      ${interestsHtml}
    </div>

  </div>
</div>
</body>
</html>`;
}

module.exports = { generateCVPdf };

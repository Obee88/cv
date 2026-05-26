const express = require('express');
const pool = require('../db');
const authenticate = require('../middleware/auth');
const { generateCVPdf } = require('../services/pdf');

const router = express.Router();
router.use(authenticate);

function emptyCV() {
  return {
    personalInfo: { name: '', title: '', email: '', linkedin: '', location: '', photo: '' },
    summary: '',
    experience: [],
    keyAchievements: [],
    languages: [],
    education: [],
    certifications: [],
    skills: [],
    interests: [],
  };
}

// GET /api/cv — load CV for authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT data FROM cv_data WHERE user_id = $1',
      [req.userId]
    );
    res.json(result.rows[0]?.data || emptyCV());
  } catch (err) {
    console.error('GET /cv error:', err);
    res.status(500).json({ error: 'Failed to load CV' });
  }
});

// PUT /api/cv — save (upsert) CV for authenticated user
router.put('/', async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid CV data' });
  }
  try {
    await pool.query(
      `INSERT INTO cv_data (user_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [req.userId, JSON.stringify(data)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /cv error:', err);
    res.status(500).json({ error: 'Failed to save CV' });
  }
});

// GET /api/cv/pdf — generate and stream PDF
router.get('/pdf', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT data FROM cv_data WHERE user_id = $1',
      [req.userId]
    );
    const cvData = result.rows[0]?.data || emptyCV();
    const pdfBuffer = await generateCVPdf(cvData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('GET /cv/pdf error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;

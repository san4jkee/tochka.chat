const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPDATES_DIR = path.join(__dirname, '../../updates');
const UPLOAD_SECRET = process.env.UPDATE_SECRET || 'change-this-secret';

if (!fs.existsSync(UPDATES_DIR)) fs.mkdirSync(UPDATES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPDATES_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

router.get('/latest.yml', (req, res) => {
  const ymlPath = path.join(UPDATES_DIR, 'latest.yml');
  if (!fs.existsSync(ymlPath)) return res.status(404).json({ error: 'No updates available' });
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile(ymlPath);
});

router.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPDATES_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, filename);
});

router.post('/upload', upload.fields([
  { name: 'yml', maxCount: 1 },
  { name: 'exe', maxCount: 1 }
]), (req, res) => {
  const secret = req.headers['x-update-secret'];
  if (secret !== UPLOAD_SECRET) return res.status(403).json({ error: 'Invalid secret' });
  if (!req.files?.yml?.[0]) return res.status(400).json({ error: 'latest.yml required' });
  res.json({ ok: true });
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const auth = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp3|mp4|webm|ogg|wav|m4a|aac|csv|json|xml/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image|audio|video|application\/pdf|text|application\/zip|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|application\/json|application\/xml/.test(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize }
});

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function isImage(mimeType) {
  return /^image\//.test(mimeType);
}

async function processImage(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  const thumbnailPath = path.join(dir, `${baseName}_thumb${ext}`);
  const loweredPath = path.join(dir, `${baseName}_low${ext}`);

  await sharp(filePath)
    .resize(300, 300, { fit: 'cover' })
    .toFile(thumbnailPath);

  await sharp(filePath)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .toFile(loweredPath);

  return {
    thumbnail: path.basename(thumbnailPath),
    lowered: path.basename(loweredPath)
  };
}

function decodeName(name) {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const baseUrl = getBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    const result = {
      filename: req.file.filename,
      originalName: decodeName(req.file.originalname),
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: fileUrl
    };

    if (isImage(req.file.mimetype)) {
      try {
        const processed = await processImage(req.file.path, req.file.originalname);
        result.thumbnailUrl = `${baseUrl}/uploads/${processed.thumbnail}`;
        result.loweredUrl = `${baseUrl}/uploads/${processed.lowered}`;
      } catch (imgErr) {
        console.error('Image processing error:', imgErr);
      }
    }

    res.json({ file: result });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/multiple', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const baseUrl = getBaseUrl(req);
    const files = [];

    for (const file of req.files) {
      const item = {
        filename: file.filename,
        originalName: decodeName(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        url: `${baseUrl}/uploads/${file.filename}`
      };

      if (isImage(file.mimetype)) {
        try {
          const processed = await processImage(file.path, file.originalname);
          item.thumbnailUrl = `${baseUrl}/uploads/${processed.thumbnail}`;
          item.loweredUrl = `${baseUrl}/uploads/${processed.lowered}`;
        } catch (imgErr) {
          console.error('Image processing error:', imgErr);
        }
      }

      files.push(item);
    }

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;

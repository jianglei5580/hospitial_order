const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.json({ code: 1, msg: '上传失败' });
  res.json({ code: 0, data: { url: '/uploads/' + req.file.filename } });
});

router.post('/multi', upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) return res.json({ code: 1, msg: '上传失败' });
  const urls = req.files.map(f => '/uploads/' + f.filename);
  res.json({ code: 0, data: { urls } });
});

module.exports = router;

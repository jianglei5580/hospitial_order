const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { all, get, run } = require('../db-helper');

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function checkPasswordStrength(pwd) {
  if (!pwd || pwd.length < 8) return { ok: false, msg: '密码长度至少8位' };
  if (pwd.length > 32) return { ok: false, msg: '密码长度不能超过32位' };
  let score = 0;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score < 2) return { ok: false, msg: '密码太弱，需至少包含大小写字母、数字、特殊符号中的两种' };
  return { ok: true };
}

router.post('/register', (req, res) => {
  const { phone, password, name, building, bed_number } = req.body;
  if (!phone || !name) {
    return res.json({ code: 1, msg: '手机号和姓名为必填项' });
  }
  if (!/^1\d{10}$/.test(phone)) {
    return res.json({ code: 1, msg: '请输入正确的11位手机号' });
  }
  if (!password) {
    return res.json({ code: 1, msg: '请输入密码' });
  }
  const strengthCheck = checkPasswordStrength(password);
  if (!strengthCheck.ok) {
    return res.json({ code: 1, msg: strengthCheck.msg });
  }

  const existing = get('SELECT id FROM patients WHERE phone = ?', [phone]);
  if (existing) {
    return res.json({ code: 1, msg: '该手机号已注册，请直接登录' });
  }

  const hashed = hashPassword(password);
  const result = run(
    'INSERT INTO patients (phone, password, name, building, bed_number) VALUES (?, ?, ?, ?, ?)',
    [phone, hashed, name, building || '', bed_number || '']
  );
  const patient = get('SELECT id, phone, name, building, bed_number, created_at FROM patients WHERE id = ?', [result.lastInsertRowid]);
  res.json({ code: 0, data: patient });
});

router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.json({ code: 1, msg: '请输入手机号和密码' });
  }
  const patient = get('SELECT * FROM patients WHERE phone = ?', [phone]);
  if (!patient) {
    return res.json({ code: 1, msg: '该手机号未注册' });
  }
  if (patient.password !== hashPassword(password)) {
    return res.json({ code: 1, msg: '密码错误' });
  }
  const { password: _, ...safeData } = patient;
  res.json({ code: 0, data: safeData });
});

router.put('/:id', (req, res) => {
  const { name, building, bed_number } = req.body;
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (building !== undefined) { fields.push('building = ?'); values.push(building); }
  if (bed_number !== undefined) { fields.push('bed_number = ?'); values.push(bed_number); }
  if (fields.length === 0) return res.json({ code: 1, msg: '无更新字段' });
  values.push(req.params.id);
  run(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, values);
  const patient = get('SELECT id, phone, name, building, bed_number, created_at FROM patients WHERE id = ?', [req.params.id]);
  res.json({ code: 0, data: patient });
});

router.get('/', (req, res) => {
  const rows = all('SELECT id, phone, name, building, bed_number, created_at FROM patients ORDER BY created_at DESC');
  res.json({ code: 0, data: rows });
});

module.exports = router;

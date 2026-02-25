const express = require('express');
const router = express.Router();
const { all, run } = require('../db-helper');

router.get('/', (req, res) => {
  const rows = all('SELECT * FROM beds ORDER BY department, room_number, bed_number');
  res.json({ code: 0, data: rows });
});

router.get('/occupied', (req, res) => {
  const rows = all('SELECT * FROM beds WHERE is_occupied = 1 ORDER BY department, room_number, bed_number');
  res.json({ code: 0, data: rows });
});

router.post('/', (req, res) => {
  const { department, room_number, bed_number, patient_name = '', is_occupied = 0 } = req.body;
  if (!department || !room_number || !bed_number) return res.json({ code: 1, msg: '科室、房间号、床位号不能为空' });
  const result = run(
    'INSERT INTO beds (department, room_number, bed_number, patient_name, is_occupied) VALUES (?, ?, ?, ?, ?)',
    [department, room_number, bed_number, patient_name, is_occupied]
  );
  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { department, room_number, bed_number, patient_name, is_occupied } = req.body;
  const fields = [];
  const values = [];
  if (department !== undefined) { fields.push('department = ?'); values.push(department); }
  if (room_number !== undefined) { fields.push('room_number = ?'); values.push(room_number); }
  if (bed_number !== undefined) { fields.push('bed_number = ?'); values.push(bed_number); }
  if (patient_name !== undefined) { fields.push('patient_name = ?'); values.push(patient_name); }
  if (is_occupied !== undefined) { fields.push('is_occupied = ?'); values.push(is_occupied); }
  if (fields.length === 0) return res.json({ code: 1, msg: '无更新字段' });
  values.push(req.params.id);
  run(`UPDATE beds SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json({ code: 0 });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM beds WHERE id = ?', [req.params.id]);
  res.json({ code: 0 });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { all, run, scalar } = require('../db-helper');

router.get('/', (req, res) => {
  const rows = all('SELECT * FROM categories ORDER BY sort_order ASC');
  res.json({ code: 0, data: rows });
});

router.get('/active', (req, res) => {
  const rows = all('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC');
  res.json({ code: 0, data: rows });
});

router.post('/', (req, res) => {
  const { name, sort_order = 0 } = req.body;
  if (!name) return res.json({ code: 1, msg: '分类名称不能为空' });
  const result = run('INSERT INTO categories (name, sort_order) VALUES (?, ?)', [name, sort_order]);
  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { name, sort_order, is_active } = req.body;
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
  if (fields.length === 0) return res.json({ code: 1, msg: '无更新字段' });
  values.push(req.params.id);
  run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json({ code: 0 });
});

router.delete('/:id', (req, res) => {
  const count = scalar('SELECT COUNT(*) FROM dishes WHERE category_id = ?', [req.params.id]);
  if (count > 0) return res.json({ code: 1, msg: '该分类下有菜品，无法删除' });
  run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ code: 0 });
});

module.exports = router;

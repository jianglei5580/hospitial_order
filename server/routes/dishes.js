const express = require('express');
const router = express.Router();
const { all, run } = require('../db-helper');

router.get('/', (req, res) => {
  const { category_id } = req.query;
  let sql = `SELECT d.*, c.name as category_name FROM dishes d 
             LEFT JOIN categories c ON d.category_id = c.id`;
  const params = [];
  if (category_id) {
    sql += ' WHERE d.category_id = ?';
    params.push(category_id);
  }
  sql += ' ORDER BY d.sort_order ASC';
  const rows = all(sql, params);
  res.json({ code: 0, data: rows });
});

router.get('/available', (req, res) => {
  const rows = all(`
    SELECT d.*, c.name as category_name FROM dishes d 
    LEFT JOIN categories c ON d.category_id = c.id 
    WHERE d.is_available = 1 AND c.is_active = 1 
    ORDER BY c.sort_order ASC, d.sort_order ASC
  `);
  res.json({ code: 0, data: rows });
});

router.put('/:id/stock', (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || stock < 0) return res.json({ code: 1, msg: '库存不能为负数' });
  run('UPDATE dishes SET stock = ? WHERE id = ?', [stock, req.params.id]);
  res.json({ code: 0 });
});

router.post('/', (req, res) => {
  const { category_id, name, description = '', price, image = '', sort_order = 0 } = req.body;
  if (!name || !category_id) return res.json({ code: 1, msg: '菜名和分类不能为空' });
  const result = run(
    'INSERT INTO dishes (category_id, name, description, price, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [category_id, name, description, price || 0, image, sort_order]
  );
  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { category_id, name, description, price, image, is_available, sort_order } = req.body;
  const fields = [];
  const values = [];
  if (category_id !== undefined) { fields.push('category_id = ?'); values.push(category_id); }
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (price !== undefined) { fields.push('price = ?'); values.push(price); }
  if (image !== undefined) { fields.push('image = ?'); values.push(image); }
  if (req.body.stock !== undefined) { fields.push('stock = ?'); values.push(req.body.stock); }
  if (is_available !== undefined) { fields.push('is_available = ?'); values.push(is_available); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
  if (fields.length === 0) return res.json({ code: 1, msg: '无更新字段' });
  values.push(req.params.id);
  run(`UPDATE dishes SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json({ code: 0 });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM dishes WHERE id = ?', [req.params.id]);
  res.json({ code: 0 });
});

module.exports = router;

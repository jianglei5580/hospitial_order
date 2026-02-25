const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { all, get, run } = require('../db-helper');

function sha256(str) { return crypto.createHash('sha256').update(str).digest('hex'); }

function nowLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') +
    ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}

function logStatus(orderId, status) {
  run('INSERT INTO order_status_logs (order_id, status, created_at) VALUES (?, ?, ?)', [orderId, status, nowLocal()]);
}

router.post('/login', (req, res) => {
  const { phone, password, role } = req.body;
  if (!phone || !password || !role) return res.json({ code: 1, msg: '请填写完整信息' });
  if (!['chef', 'courier'].includes(role)) return res.json({ code: 1, msg: '无效角色' });
  const staff = get('SELECT * FROM staff WHERE phone = ? AND role = ?', [phone, role]);
  if (!staff) return res.json({ code: 1, msg: '账号不存在' });
  if (staff.password !== sha256(password)) return res.json({ code: 1, msg: '密码错误' });
  if (!staff.is_active) return res.json({ code: 1, msg: '账号已停用' });
  res.json({ code: 0, data: { id: staff.id, name: staff.name, phone: staff.phone, role: staff.role } });
});

router.get('/', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id, phone, name, role, is_active, created_at FROM staff WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  sql += ' ORDER BY id ASC';
  res.json({ code: 0, data: all(sql, params) });
});

router.get('/chef/orders', (req, res) => {
  const { chef_id } = req.query;
  if (!chef_id) return res.json({ code: 1, msg: '缺少厨师ID' });
  const orders = all(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone, p.building, p.bed_number as patient_bed
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    WHERE o.chef_id = ? AND o.status = 'paid'
    ORDER BY o.created_at ASC
  `, [chef_id]);
  orders.forEach(o => {
    o.items = all(`SELECT oi.*, d.name as dish_name FROM order_items oi LEFT JOIN dishes d ON oi.dish_id = d.id WHERE oi.order_id = ?`, [o.id]);
  });
  res.json({ code: 0, data: orders });
});

router.get('/chef/ready-orders', (req, res) => {
  const { chef_id } = req.query;
  if (!chef_id) return res.json({ code: 1, msg: '缺少厨师ID' });
  const orders = all(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone, p.building, p.bed_number as patient_bed,
           s.name as courier_name
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    LEFT JOIN staff s ON o.courier_id = s.id
    WHERE o.chef_id = ? AND o.status = 'delivering'
    ORDER BY o.created_at DESC
  `, [chef_id]);
  orders.forEach(o => {
    o.items = all(`SELECT oi.*, d.name as dish_name FROM order_items oi LEFT JOIN dishes d ON oi.dish_id = d.id WHERE oi.order_id = ?`, [o.id]);
  });
  res.json({ code: 0, data: orders });
});

router.get('/chef/history', (req, res) => {
  const { chef_id } = req.query;
  if (!chef_id) return res.json({ code: 1, msg: '缺少厨师ID' });
  const today = nowLocal().split(' ')[0];
  const orders = all(`
    SELECT o.id, o.status, o.total_price, o.meal_type, o.order_date, o.created_at,
           p.name as patient_name, p.building, p.bed_number as patient_bed
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    WHERE o.chef_id = ? AND o.status NOT IN ('paid','delivering') AND o.order_date = ?
    ORDER BY o.created_at DESC
  `, [chef_id, today]);
  res.json({ code: 0, data: orders });
});

router.post('/chef/ready', (req, res) => {
  const { order_id, chef_id } = req.body;
  if (!order_id || !chef_id) return res.json({ code: 1, msg: '缺少参数' });
  const order = get('SELECT * FROM orders WHERE id = ? AND chef_id = ? AND status = ?', [order_id, chef_id, 'paid']);
  if (!order) return res.json({ code: 1, msg: '订单不存在或状态不匹配' });

  const couriers = all("SELECT id FROM staff WHERE role = 'courier' AND is_active = 1");
  if (couriers.length === 0) return res.json({ code: 1, msg: '暂无可用配送员' });

  const counts = all(`
    SELECT courier_id, COUNT(*) as cnt FROM orders
    WHERE courier_id IS NOT NULL AND status = 'delivering'
    GROUP BY courier_id
  `);
  const countMap = {};
  counts.forEach(c => { countMap[c.courier_id] = c.cnt; });
  let minCount = Infinity, selectedCourier = couriers[0].id;
  couriers.forEach(c => {
    const cnt = countMap[c.id] || 0;
    if (cnt < minCount) { minCount = cnt; selectedCourier = c.id; }
  });

  run('UPDATE orders SET status = ?, courier_id = ? WHERE id = ?', ['delivering', selectedCourier, order_id]);
  logStatus(order_id, 'delivering');
  res.json({ code: 0 });
});

router.get('/courier/orders', (req, res) => {
  const { courier_id } = req.query;
  if (!courier_id) return res.json({ code: 1, msg: '缺少配送员ID' });
  const orders = all(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone, p.building, p.bed_number as patient_bed
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    WHERE o.courier_id = ? AND o.status = 'delivering'
    ORDER BY o.created_at ASC
  `, [courier_id]);
  orders.forEach(o => {
    o.items = all(`SELECT oi.*, d.name as dish_name FROM order_items oi LEFT JOIN dishes d ON oi.dish_id = d.id WHERE oi.order_id = ?`, [o.id]);
  });
  res.json({ code: 0, data: orders });
});

router.get('/courier/history', (req, res) => {
  const { courier_id } = req.query;
  if (!courier_id) return res.json({ code: 1, msg: '缺少配送员ID' });
  const today = nowLocal().split(' ')[0];
  const orders = all(`
    SELECT o.id, o.status, o.total_price, o.meal_type, o.order_date, o.delivered_at,
           p.name as patient_name, p.building, p.bed_number as patient_bed
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    WHERE o.courier_id = ? AND o.status = 'delivered' AND o.order_date = ?
    ORDER BY o.delivered_at DESC
  `, [courier_id, today]);
  res.json({ code: 0, data: orders });
});

router.post('/courier/delivered', (req, res) => {
  const { order_id, courier_id } = req.body;
  if (!order_id || !courier_id) return res.json({ code: 1, msg: '缺少参数' });
  const order = get('SELECT * FROM orders WHERE id = ? AND courier_id = ? AND status = ?', [order_id, courier_id, 'delivering']);
  if (!order) return res.json({ code: 1, msg: '订单不存在或状态不匹配' });
  run('UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?', ['delivered', nowLocal(), order_id]);
  logStatus(order_id, 'delivered');
  res.json({ code: 0 });
});

module.exports = router;

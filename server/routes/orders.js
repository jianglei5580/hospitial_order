const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db-helper');

function nowLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') +
    ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}

function logStatus(orderId, status) {
  run('INSERT INTO order_status_logs (order_id, status, created_at) VALUES (?, ?, ?)', [orderId, status, nowLocal()]);
}

function assignChef(orderId) {
  const chefs = all("SELECT id FROM staff WHERE role = 'chef' AND is_active = 1");
  if (chefs.length === 0) return;
  const counts = all(`SELECT chef_id, COUNT(*) as cnt FROM orders WHERE chef_id IS NOT NULL AND status = 'paid' GROUP BY chef_id`);
  const countMap = {};
  counts.forEach(c => { countMap[c.chef_id] = c.cnt; });
  let minCount = Infinity, selectedChef = chefs[0].id;
  chefs.forEach(c => {
    const cnt = countMap[c.id] || 0;
    if (cnt < minCount) { minCount = cnt; selectedChef = c.id; }
  });
  run('UPDATE orders SET chef_id = ? WHERE id = ?', [selectedChef, orderId]);
}

router.get('/', (req, res) => {
  const { date, status, patient_id } = req.query;
  let sql = `SELECT o.*, p.name as patient_name, p.phone as patient_phone,
             p.building, p.bed_number as patient_bed
             FROM orders o LEFT JOIN patients p ON o.patient_id = p.id WHERE 1=1`;
  const params = [];
  if (date) { sql += ' AND o.order_date = ?'; params.push(date); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (patient_id) { sql += ' AND o.patient_id = ?'; params.push(patient_id); }
  sql += ' ORDER BY o.created_at DESC';
  const rows = all(sql, params);
  const now = Date.now();
  rows.forEach(r => {
    r.can_refund = false;
    if (r.status === 'delivered' && r.delivered_at) {
      const dt = new Date(r.delivered_at.replace(' ', 'T')).getTime();
      r.can_refund = (now - dt) < 48 * 3600 * 1000;
    }
  });
  res.json({ code: 0, data: rows });
});

router.get('/by-bed', (req, res) => {
  const { building, bed_number } = req.query;
  if (!building || !bed_number) return res.json({ code: 1, msg: '缺少楼栋或床位号参数' });
  const patients = all('SELECT id, name, phone FROM patients WHERE building = ? AND bed_number = ?', [building, bed_number]);
  if (patients.length === 0) return res.json({ code: 0, data: { patient: null, orders: [] } });
  const patient = patients[0];
  const orders = all(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id
    WHERE o.patient_id = ? ORDER BY o.created_at DESC
  `, [patient.id]);
  res.json({ code: 0, data: { patient, orders } });
});

router.get('/stats/daily', (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const stats = get(`
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(total_price), 0) as total_revenue,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
      COUNT(CASE WHEN status = 'delivering' THEN 1 END) as delivering_count,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count
    FROM orders WHERE order_date = ?
  `, [targetDate]);
  res.json({ code: 0, data: stats || {} });
});

router.get('/:id', (req, res) => {
  const order = get(`
    SELECT o.*, p.name as patient_name, p.phone as patient_phone,
    p.building, p.bed_number as patient_bed
    FROM orders o LEFT JOIN patients p ON o.patient_id = p.id WHERE o.id = ?
  `, [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  const items = all(`
    SELECT oi.*, d.name as dish_name, d.image FROM order_items oi 
    LEFT JOIN dishes d ON oi.dish_id = d.id WHERE oi.order_id = ?
  `, [req.params.id]);
  order.items = items;
  order.status_logs = all('SELECT status, created_at FROM order_status_logs WHERE order_id = ? ORDER BY id ASC', [req.params.id]);
  order.can_refund = false;
  if (order.status === 'delivered' && order.delivered_at) {
    const deliveredTime = new Date(order.delivered_at.replace(' ', 'T')).getTime();
    order.can_refund = (Date.now() - deliveredTime) < 48 * 3600 * 1000;
  }
  res.json({ code: 0, data: order });
});

router.post('/', (req, res) => {
  const { patient_id, meal_type = 'lunch', order_date, items, remark = '' } = req.body;
  if (!patient_id || !order_date || !items || items.length === 0) {
    return res.json({ code: 1, msg: '缺少必要参数' });
  }

  try {
    for (const item of items) {
      const dish = get('SELECT stock FROM dishes WHERE id = ?', [item.dish_id]);
      if (!dish) return res.json({ code: 1, msg: '菜品不存在' });
      if (dish.stock < (item.quantity || 1)) return res.json({ code: 1, msg: `「${item.dish_name || '菜品'}」库存不足` });
    }

    let totalPrice = 0;
    for (const item of items) {
      totalPrice += (item.price || 0) * (item.quantity || 1);
    }

    const result = run(
      "INSERT INTO orders (patient_id, meal_type, order_date, total_price, status, remark) VALUES (?, ?, ?, ?, 'paid', ?)",
      [patient_id, meal_type, order_date, totalPrice, remark]
    );

    const orderId = result.lastInsertRowid;
    for (const item of items) {
      const qty = item.quantity || 1;
      run('INSERT INTO order_items (order_id, dish_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.dish_id, qty, item.price || 0]);
      run('UPDATE dishes SET stock = stock - ? WHERE id = ?', [qty, item.dish_id]);
    }

    assignChef(orderId);
    logStatus(orderId, 'paid');
    res.json({ code: 0, data: { id: orderId } });
  } catch (e) {
    res.json({ code: 1, msg: '创建订单失败: ' + e.message });
  }
});

router.put('/batch-status', (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.json({ code: 1, msg: '缺少订单ID' });
  }
  if (!['refunded', 'cancelled'].includes(status)) {
    return res.json({ code: 1, msg: '批量操作仅支持退款完成或废弃' });
  }
  const placeholders = ids.map(() => '?').join(',');
  run(`UPDATE orders SET status = ? WHERE id IN (${placeholders}) AND status = 'refunding'`, [status, ...ids]);
  ids.forEach(id => logStatus(id, status));
  res.json({ code: 0 });
});

router.post('/:id/cancel', (req, res) => {
  const { reason, description } = req.body;
  if (!reason) return res.json({ code: 1, msg: '请选择取消原因' });
  const order = get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'paid') return res.json({ code: 1, msg: '仅已支付订单可取消' });
  run('UPDATE orders SET status = ?, cancel_reason = ?, cancel_desc = ? WHERE id = ?',
    ['user_cancelled', reason, description || '', req.params.id]);
  logStatus(req.params.id, 'user_cancelled');
  res.json({ code: 0 });
});

router.post('/:id/refund', (req, res) => {
  const { reason, description, images } = req.body;
  if (!reason) return res.json({ code: 1, msg: '请选择退款原因' });
  const order = get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'delivered') return res.json({ code: 1, msg: '仅已送达订单可申请退款' });
  if (order.delivered_at) {
    const deliveredTime = new Date(order.delivered_at).getTime();
    const now = Date.now();
    if (now - deliveredTime > 48 * 60 * 60 * 1000) {
      return res.json({ code: 1, msg: '已超过48小时，无法申请退款' });
    }
  }
  run('UPDATE orders SET status = ?, refund_reason = ?, refund_desc = ?, refund_images = ? WHERE id = ?',
    ['refunding', reason, description || '', JSON.stringify(images || []), req.params.id]);
  logStatus(req.params.id, 'refunding');
  res.json({ code: 0 });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['paid', 'delivering', 'delivered', 'refunding', 'refunded', 'cancelled', 'user_cancelled'];
  if (!validStatuses.includes(status)) {
    return res.json({ code: 1, msg: '无效的状态' });
  }
  if (status === 'delivered') {
    run('UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?', [status, nowLocal(), req.params.id]);
  } else {
    run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  }
  logStatus(req.params.id, status);
  res.json({ code: 0 });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
  run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ code: 0 });
});

module.exports = router;

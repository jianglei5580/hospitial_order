const express = require('express');
const router = express.Router();
const { get } = require('../db-helper');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ code: 1, msg: '用户名和密码不能为空' });
  const user = get('SELECT id, username, role FROM admin_users WHERE username = ? AND password = ?', [username, password]);
  if (!user) return res.json({ code: 1, msg: '用户名或密码错误' });
  res.json({ code: 0, data: user });
});

module.exports = router;

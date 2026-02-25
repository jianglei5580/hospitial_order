const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/app', express.static(path.join(__dirname, '..', 'app', 'www')));
app.use('/staff', express.static(path.join(__dirname, '..', 'staff')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/dishes', require('./routes/dishes'));
app.use('/api/beds', require('./routes/beds'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/upload', require('./routes/upload'));

app.get('/', (req, res) => {
  res.send(`
    <h2>医院点餐系统</h2>
    <ul>
      <li><a href="/app">患者端点餐</a></li>
      <li><a href="/admin">后台管理</a></li>
      <li><a href="/staff">厨师/配送员端</a></li>
    </ul>
  `);
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
    console.log(`患者端点餐: http://localhost:${PORT}/app`);
    console.log(`后台管理:   http://localhost:${PORT}/admin`);
    console.log(`厨师/配送:  http://localhost:${PORT}/staff`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'hospital_order.db');

let db = null;

function saveDB() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      building TEXT DEFAULT '',
      bed_number TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      stock INTEGER DEFAULT 50,
      is_available INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department TEXT NOT NULL,
      room_number TEXT NOT NULL,
      bed_number TEXT NOT NULL,
      patient_name TEXT DEFAULT '',
      is_occupied INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      bed_id INTEGER,
      meal_type TEXT NOT NULL DEFAULT 'lunch',
      order_date DATE NOT NULL,
      total_price REAL DEFAULT 0,
      status TEXT DEFAULT 'paid',
      remark TEXT DEFAULT '',
      refund_reason TEXT DEFAULT '',
      refund_desc TEXT DEFAULT '',
      refund_images TEXT DEFAULT '',
      cancel_reason TEXT DEFAULT '',
      cancel_desc TEXT DEFAULT '',
      chef_id INTEGER,
      courier_id INTEGER,
      delivered_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (chef_id) REFERENCES staff(id),
      FOREIGN KEY (courier_id) REFERENCES staff(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      dish_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (dish_id) REFERENCES dishes(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS order_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('chef','courier')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const adminCount = db.exec('SELECT COUNT(*) as count FROM admin_users')[0].values[0][0];
  if (adminCount === 0) {
    db.run("INSERT INTO admin_users (username, password, role) VALUES ('admin', 'admin123', 'admin')");
  }

  const catCount = db.exec('SELECT COUNT(*) as count FROM categories')[0].values[0][0];
  if (catCount === 0) {
    const cats = [
      ['营养粥品', 1], ['清淡主食', 2], ['滋补汤品', 3],
      ['时令蔬菜', 4], ['荤菜', 5], ['水果拼盘', 6]
    ];
    cats.forEach(([name, sort]) => {
      db.run('INSERT INTO categories (name, sort_order) VALUES (?, ?)', [name, sort]);
    });

    const dishes = [
      [1, '白粥', '清淡养胃白米粥', 5, 1],
      [1, '皮蛋瘦肉粥', '经典皮蛋瘦肉粥', 12, 2],
      [1, '小米粥', '养胃小米粥', 8, 3],
      [1, '八宝粥', '多种杂粮八宝粥', 10, 4],
      [2, '白米饭', '精选东北大米', 3, 1],
      [2, '馒头', '手工馒头（2个）', 4, 2],
      [2, '面条', '手擀面条', 8, 3],
      [2, '水饺', '猪肉白菜水饺（10个）', 15, 4],
      [3, '鸡汤', '老母鸡炖汤', 25, 1],
      [3, '排骨汤', '玉米排骨汤', 22, 2],
      [3, '鱼汤', '鲫鱼豆腐汤', 20, 3],
      [3, '紫菜蛋花汤', '紫菜蛋花汤', 8, 4],
      [4, '炒时蔬', '当季时令蔬菜', 12, 1],
      [4, '蒜蓉西兰花', '蒜蓉西兰花', 14, 2],
      [4, '清炒小白菜', '清炒小白菜', 10, 3],
      [4, '凉拌黄瓜', '凉拌黄瓜', 8, 4],
      [5, '清蒸鱼', '清蒸鲈鱼', 35, 1],
      [5, '红烧肉', '红烧五花肉', 28, 2],
      [5, '蒸蛋', '嫩滑蒸蛋', 10, 3],
      [5, '白切鸡', '白切鸡', 30, 4],
      [6, '综合水果', '当季水果拼盘', 15, 1],
      [6, '苹果', '红富士苹果', 6, 2],
      [6, '香蕉', '进口香蕉', 5, 3],
    ];
    dishes.forEach(([catId, name, desc, price, sort]) => {
      db.run('INSERT INTO dishes (category_id, name, description, price, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [catId, name, desc, price, 50, sort]);
    });

    const beds = [
      ['内科', '101', '1', '张三', 1],
      ['内科', '101', '2', '李四', 1],
      ['内科', '102', '1', '王五', 1],
      ['外科', '201', '1', '赵六', 1],
      ['外科', '201', '2', '', 0],
      ['外科', '202', '1', '钱七', 1],
    ];
    beds.forEach(([dept, room, bed, patient, occupied]) => {
      db.run('INSERT INTO beds (department, room_number, bed_number, patient_name, is_occupied) VALUES (?, ?, ?, ?, ?)', [dept, room, bed, patient, occupied]);
    });
  }

  saveDB();
  return db;
}

function getDB() {
  return db;
}

module.exports = { initDatabase, getDB, saveDB };

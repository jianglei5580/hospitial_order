const { getDB, saveDB } = require('./database');

function all(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  const db = getDB();
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] || 0;
  const changes = db.getRowsModified();
  saveDB();
  return { lastInsertRowid: lastId, changes };
}

function scalar(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let value = null;
  if (stmt.step()) {
    value = stmt.get()[0];
  }
  stmt.free();
  return value;
}

module.exports = { all, get, run, scalar };

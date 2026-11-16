const Database = require('better-sqlite3');
const path = require('node:path');
const { app } = require('electron');

let db;
function initDatabase() {
  const file = path.join(app.getPath('userData'), 'oudi-food.sqlite');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'سندوتشات',
      price REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment TEXT NOT NULL DEFAULT 'نقدي',
      status TEXT NOT NULL DEFAULT 'جديد',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (!count) {
    const insert = db.prepare('INSERT INTO products (name, category, price) VALUES (?, ?, ?)');
    const seed = db.transaction(() => {
      [
        ['برجر لحم','برجر',95],['برجر فراخ','برجر',85],['شاورما فراخ','شاورما',75],
        ['شاورما لحم','شاورما',95],['كريب فراخ','كريب',90],['بطاطس','إضافات',30],
        ['وجبة برجر','وجبات',135],['سندوتش سجق','سندوتشات',70]
      ].forEach(p => insert.run(...p));
    });
    seed();
  }
}
function listProducts() {
  return db.prepare('SELECT * FROM products WHERE active=1 ORDER BY category, name').all();
}
function createOrder(order) {
  const info = db.prepare(`INSERT INTO orders
    (customer, phone, address, items_json, subtotal, delivery_fee, discount, total, payment)
    VALUES (@customer,@phone,@address,@items_json,@subtotal,@delivery_fee,@discount,@total,@payment)`).run(order);
  return db.prepare('SELECT * FROM orders WHERE id=?').get(info.lastInsertRowid);
}
function listOrders() {
  return db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 100').all();
}
function updateOrderStatus({id,status}) {
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,id);
  return db.prepare('SELECT * FROM orders WHERE id=?').get(id);
}
module.exports = { initDatabase, listProducts, createOrder, listOrders, updateOrderStatus };
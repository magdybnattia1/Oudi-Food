const Database = require('better-sqlite3');
const path = require('node:path');
const { app } = require('electron');
let db;
const statuses=['جديد','قيد التجهيز','جاهز للتسليم','مع المندوب','تم التوصيل'];
const tables={
  products:['products',['name','category','price','cost','active','description']],
  variants:['product_variants',['product_id','name','price']],
  options:['product_options',['product_id','name','price']],
  ingredients:['ingredients',['name','unit','stock','min_stock','unit_cost']],
  recipes:['recipes',['product_id','ingredient_id','quantity']],
  customers:['customers',['name','phone','address','notes']],
  drivers:['drivers',['name','phone','active']],
  expenses:['expenses',['title','amount','category','note','created_at']],
  cash_movements:['cash_movements',['type','amount','note','created_at']]
};
function initDatabase(){
 db=new Database(path.join(app.getPath('userData'),'oudi-food.sqlite'));
 db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
 db.exec(`
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'سندوتشات',price REAL NOT NULL DEFAULT 0,cost REAL NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,description TEXT DEFAULT '');
 CREATE TABLE IF NOT EXISTS product_variants(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,name TEXT NOT NULL,price REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS product_options(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,name TEXT NOT NULL,price REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ingredients(id INTEGER PRIMARY KEY,name TEXT NOT NULL,unit TEXT NOT NULL DEFAULT 'قطعة',stock REAL NOT NULL DEFAULT 0,min_stock REAL NOT NULL DEFAULT 0,unit_cost REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS recipes(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),quantity REAL NOT NULL DEFAULT 1,UNIQUE(product_id,ingredient_id));
 CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,address TEXT DEFAULT '',notes TEXT DEFAULT '');
 CREATE TABLE IF NOT EXISTS drivers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,customer TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,order_type TEXT NOT NULL DEFAULT 'دليفري',items_json TEXT NOT NULL,subtotal REAL NOT NULL,delivery_fee REAL NOT NULL DEFAULT 0,discount REAL NOT NULL DEFAULT 0,total REAL NOT NULL,payment TEXT NOT NULL DEFAULT 'نقدي',status TEXT NOT NULL DEFAULT 'جديد',driver_id INTEGER REFERENCES drivers(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,title TEXT NOT NULL,amount REAL NOT NULL,category TEXT DEFAULT 'عام',note TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS cash_movements(id INTEGER PRIMARY KEY,type TEXT NOT NULL,amount REAL NOT NULL,note TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
 `);
 const ensureColumn=(table,column,definition)=>{const cols=db.prepare('PRAGMA table_info('+table+')').all();if(!cols.some(x=>x.name===column))db.exec('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition);};
 ensureColumn('products','cost','REAL NOT NULL DEFAULT 0');ensureColumn('products','description',"TEXT DEFAULT ''");ensureColumn('orders','driver_id','INTEGER REFERENCES drivers(id)');ensureColumn('orders','order_type',"TEXT NOT NULL DEFAULT 'دليفري'");
 const variantColumns=db.prepare('PRAGMA table_info(product_variants)').all();if(!variantColumns.some(x=>x.name==='price')){db.exec('ALTER TABLE product_variants ADD COLUMN price REAL NOT NULL DEFAULT 0');db.exec('UPDATE product_variants SET price=COALESCE((SELECT p.price+product_variants.price_delta FROM products p WHERE p.id=product_variants.product_id),0)');}
 const n=db.prepare('SELECT COUNT(*) n FROM products').get().n;
 if(!n){const s=db.prepare('INSERT INTO products(name,category,price,cost) VALUES(?,?,?,?)');[['برجر لحم','برجر',95,48],['برجر فراخ','برجر',85,40],['شاورما فراخ','شاورما',75,32],['شاورما لحم','شاورما',95,48],['كريب فراخ','كريب',90,42],['بطاطس','إضافات',30,12],['وجبة برجر','وجبات',135,68],['سندوتش سجق','سندوتشات',70,34]].forEach(x=>s.run(...x));
 ['خبز','لحم','دجاج','بطاطس','زيت','جبنة'].forEach((name,i)=>db.prepare('INSERT INTO ingredients(name,unit,stock,min_stock,unit_cost) VALUES(?,?,?,?,?)').run(name,'قطعة',i?20:50,5,[2,20,12,4,8,10][i]));
 db.prepare('INSERT INTO drivers(name,phone) VALUES(?,?)').run('مندوب ١','');
 }
}
function list(table){const t=tables[table];if(!t)throw Error('بيانات غير معروفة');return db.prepare(`SELECT * FROM ${t[0]} ORDER BY id DESC`).all();}
function save(table,item){const [name,cols]=tables[table]||[];if(!name)throw Error('بيانات غير معروفة');const values=cols.filter(k=>item[k]!==undefined);if(!values.length)throw Error('لا توجد بيانات للحفظ');if(item.id){db.prepare(`UPDATE ${name} SET ${values.map(k=>k+'=@'+k).join(',')} WHERE id=@id`).run({...item});return db.prepare(`SELECT * FROM ${name} WHERE id=?`).get(item.id);}const keys=values.join(',');const info=db.prepare(`INSERT INTO ${name}(${keys}) VALUES(${values.map(k=>'@'+k).join(',')})`).run(item);return db.prepare(`SELECT * FROM ${name} WHERE id=?`).get(info.lastInsertRowid);}
function remove(table,id){const [name]=tables[table]||[];if(!name)throw Error('بيانات غير معروفة');return db.prepare(`DELETE FROM ${name} WHERE id=?`).run(Number(id)).changes;}
function listOrders(){return db.prepare(`SELECT o.*,d.name driver_name FROM orders o LEFT JOIN drivers d ON d.id=o.driver_id ORDER BY o.id DESC LIMIT 250`).all();}
function createOrder(o){
 const takeaway=o.order_type==='تيك أواي';if((!takeaway&&(!o.customer||!o.phone||!o.address))||!Array.isArray(o.items)||!o.items.length)throw Error('أكمل بيانات طلب الدليفري واختر صنفًا واحدًا على الأقل');
 const tx=db.transaction(()=>{let sub=0;const items=o.items.map(x=>{const p=db.prepare('SELECT id,name,price FROM products WHERE id=? AND active=1').get(Number(x.id));if(!p)throw Error('يوجد صنف غير متاح');const qty=Math.max(1,Math.min(99,Number(x.qty)||1));const variant=x.variant?db.prepare('SELECT name,price FROM product_variants WHERE product_id=? AND name=?').get(p.id,x.variant):null;const selected=(Array.isArray(x.options)?x.options:[]).map(o=>db.prepare('SELECT id,name,price FROM product_options WHERE product_id=? AND id=?').get(p.id,Number(o.id))).filter(Boolean);const unit=(variant?variant.price:p.price)+selected.reduce((a,o)=>a+o.price,0);sub+=unit*qty;return {id:p.id,name:p.name,price:unit,qty,variant:variant?.name||'',options:selected};});
 const fee=takeaway?0:Math.max(0,Number(o.delivery_fee)||0),disc=Math.min(sub+fee,Math.max(0,Number(o.discount)||0)),total=sub+fee-disc;
 const info=db.prepare('INSERT INTO orders(customer,phone,address,order_type,items_json,subtotal,delivery_fee,discount,total,payment) VALUES(?,?,?,?,?,?,?,?,?,?)').run(takeaway?'عميل تيك أواي':o.customer||'عميل',takeaway?'':o.phone||'',takeaway?'استلام من المحل':o.address||'',takeaway?'تيك أواي':'دليفري',JSON.stringify(items),sub,fee,disc,total,o.payment==='بطاقة'?'بطاقة':'نقدي');
 if(!takeaway)db.prepare('INSERT INTO customers(name,phone,address) VALUES(?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name,address=excluded.address').run(o.customer,o.phone,o.address);
 for(const item of items){for(const r of db.prepare('SELECT ingredient_id,quantity FROM recipes WHERE product_id=?').all(item.id))db.prepare('UPDATE ingredients SET stock=MAX(0,stock-?) WHERE id=?').run(r.quantity*item.qty,r.ingredient_id);}
 db.prepare('INSERT INTO cash_movements(type,amount,note) VALUES(?,?,?)').run('إيراد',total,'طلب #'+info.lastInsertRowid);
 return db.prepare('SELECT * FROM orders WHERE id=?').get(info.lastInsertRowid);});return tx();
}
function updateOrderStatus({id,status,driver_id}){if(!statuses.includes(status))throw Error('حالة طلب غير صحيحة');db.prepare('UPDATE orders SET status=?,driver_id=? WHERE id=?').run(status,driver_id||null,Number(id));return db.prepare('SELECT * FROM orders WHERE id=?').get(Number(id));}
function reports(){return db.prepare(`SELECT COUNT(*) orders,COALESCE(SUM(total),0) sales,COALESCE(SUM(subtotal),0) food_sales,COALESCE(SUM(discount),0) discounts FROM orders WHERE date(created_at,'localtime')=date('now','localtime')`).get();}
function reportRows(){return db.prepare(`SELECT date(created_at,'localtime') day,COUNT(*) orders,SUM(total) sales FROM orders GROUP BY day ORDER BY day DESC LIMIT 30`).all();}
function cashSummary(){return db.prepare("SELECT COALESCE(SUM(CASE WHEN type='إيراد' OR type='إيداع' THEN amount ELSE -amount END),0) balance FROM cash_movements").get();}
function backup(){return db.backup;}
function exportData(){return {version:1,exportedAt:new Date().toISOString(),products:list('products'),variants:list('variants'),options:list('options'),ingredients:list('ingredients'),recipes:list('recipes'),customers:list('customers'),drivers:list('drivers'),orders:listOrders(),expenses:list('expenses'),cash_movements:list('cash_movements')};}
function restoreData(data){const names=['products','variants','options','ingredients','recipes','customers','drivers','orders','expenses','cash_movements'];for(const n of names)if(!Array.isArray(data[n]))throw Error('النسخة ناقصة: '+n);const tx=db.transaction(()=>{db.exec('DELETE FROM recipes; DELETE FROM product_variants; DELETE FROM product_options; DELETE FROM orders; DELETE FROM cash_movements; DELETE FROM expenses; DELETE FROM customers; DELETE FROM drivers; DELETE FROM ingredients; DELETE FROM products;');for(const n of names){const [table,cols]=tables[n]||({variants:['product_variants',['product_id','name','price']],options:['product_options',['product_id','name','price']],orders:['orders',['customer','phone','address','order_type','items_json','subtotal','delivery_fee','discount','total','payment','status','driver_id','created_at']]}[n]||[]);if(!table)continue;for(const row of data[n]){const source=n==='variants'&&row.price===undefined?{...row,price:Number(data.products.find(p=>p.id===row.product_id)?.price||0)+Number(row.price_delta||0)}:n==='orders'&&row.order_type===undefined?{...row,order_type:'دليفري'}:row;const keys=cols.filter(k=>source[k]!==undefined);if(source.id!==undefined)keys.unshift('id');const vals=keys.map(k=>source[k]);db.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...vals);}}});tx();return true;}
module.exports={initDatabase,list,save,remove,listOrders,createOrder,updateOrderStatus,reports,reportRows,cashSummary,exportData,restoreData,backup,statuses};

const $ = (id) => document.getElementById(id);
let products = [];
let cart = [];
let activeCategory = 'الكل';
const money = (n) => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(n)||0) + ' ج.م';

function renderProducts() {
  const categories = ['الكل', ...new Set(products.map(p => p.category))];
  $('filters').innerHTML = categories.map(c => `<button class="filter ${c===activeCategory?'active':''}" data-category="${c}">${c}</button>`).join('');
  $('filters').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { activeCategory=b.dataset.category; renderProducts(); }));
  const shown = activeCategory==='الكل' ? products : products.filter(p=>p.category===activeCategory);
  $('productCount').textContent = products.length + ' صنف';
  $('products').innerHTML = shown.map(p => `<button class="product" data-id="${p.id}"><span class="food-icon">${p.category==='وجبات'?'🍱':p.category==='إضافات'?'🍟':p.category==='كريب'?'🌯':'🥪'}</span><b>${p.name}</b><small>${p.category}</small><strong>${money(p.price)}</strong></button>`).join('') || '<div class="empty">لا توجد أصناف في هذا القسم</div>';
  $('products').querySelectorAll('.product').forEach(b => b.addEventListener('click',()=>addToCart(Number(b.dataset.id))));
}
function addToCart(id) {
  const p=products.find(x=>x.id===id); if(!p) return;
  const item=cart.find(x=>x.id===id);
  if(item) item.qty++; else cart.push({...p,qty:1});
  renderCart();
}
function renderCart() {
  const count=cart.reduce((s,x)=>s+x.qty,0), subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
  $('cartCount').textContent=count+' أصناف'; $('subtotal').textContent=money(subtotal);
  $('cart').innerHTML=cart.length?cart.map(x=>`<div class="cart-item"><div><b>${x.name}</b><small>${money(x.price)} × ${x.qty}</small></div><div class="qty"><button data-action="minus" data-id="${x.id}">−</button><b>${x.qty}</b><button data-action="plus" data-id="${x.id}">+</button><button class="remove" data-action="remove" data-id="${x.id}">×</button></div></div>`).join(''):'<div class="cart-empty">لم تتم إضافة أصناف بعد</div>';
  $('cart').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>changeQty(Number(b.dataset.id),b.dataset.action)));
  updateTotal();
}
function changeQty(id,action) {
  const item=cart.find(x=>x.id===id); if(!item)return;
  if(action==='plus')item.qty++; if(action==='minus')item.qty--; if(action==='remove')item.qty=0;
  cart=cart.filter(x=>x.qty>0); renderCart();
}
function updateTotal() {
  const sub=cart.reduce((s,x)=>s+x.price*x.qty,0), fee=Math.max(0,Number($('delivery').value)||0), discount=Math.max(0,Number($('discount').value)||0);
  $('total').textContent=money(Math.max(0,sub+fee-discount));
}
async function loadOrders() {
  const orders=await window.oudi.orders();
  $('ordersBody').innerHTML=orders.length?orders.map(o=>`<tr><td>#${o.id}</td><td>${escapeHtml(o.customer)}</td><td>${escapeHtml(o.phone)}</td><td>${money(o.total)}</td><td><span class="status">${o.status}</span></td><td><select data-order="${o.id}" class="status-select"><option ${o.status==='جديد'?'selected':''}>جديد</option><option ${o.status==='قيد التجهيز'?'selected':''}>قيد التجهيز</option><option ${o.status==='جاهز للتسليم'?'selected':''}>جاهز للتسليم</option><option ${o.status==='مع المندوب'?'selected':''}>مع المندوب</option><option ${o.status==='تم التوصيل'?'selected':''}>تم التوصيل</option></select></td></tr>`).join(''):'<tr><td colspan="6">لا توجد طلبات حتى الآن</td></tr>';
  $('ordersBody').querySelectorAll('select').forEach(s=>s.addEventListener('change',async()=>{await window.oudi.updateStatus({id:Number(s.dataset.order),status:s.value});loadOrders();}));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function submitOrder() {
  const customer=$('customer').value.trim(),phone=$('phone').value.trim(),address=$('address').value.trim();
  if(!customer||!phone||!address){$('message').textContent='من فضلك أكمل اسم العميل ورقم الهاتف والعنوان.';return;}
  if(!cart.length){$('message').textContent='أضف صنفًا واحدًا على الأقل للطلب.';return;}
  const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0),delivery_fee=Math.max(0,Number($('delivery').value)||0),discount=Math.max(0,Number($('discount').value)||0);
  const order=await window.oudi.createOrder({customer,phone,address,items_json:JSON.stringify(cart.map(({id,name,price,qty})=>({id,name,price,qty}))),subtotal,delivery_fee,discount,total:Math.max(0,subtotal+delivery_fee-discount),payment:document.querySelector('input[name="payment"]:checked').value});
  $('message').textContent='تم حفظ الطلب رقم #'+order.id+' بنجاح.';
  cart=[]; $('customer').value='';$('phone').value='';$('address').value='';$('discount').value='0';
  renderCart(); await loadOrders();
}
$('delivery').addEventListener('input',updateTotal); $('discount').addEventListener('input',updateTotal);
$('submitOrder').addEventListener('click',submitOrder); $('refresh').addEventListener('click',loadOrders);
$('today').textContent=new Intl.DateTimeFormat('ar-EG',{dateStyle:'full'}).format(new Date());
(async()=>{try{products=await window.oudi.products();renderProducts();renderCart();await loadOrders();}catch(e){$('message').textContent='حدث خطأ في تحميل قاعدة البيانات: '+e.message;}})();
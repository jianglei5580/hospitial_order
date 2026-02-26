const API_BASE = '/api';

const state = {
  currentUser: null,
  categories: [],
  dishes: [],
  selectedDate: '',
  orderDate: '',
  mealType: '',
  activeCategoryId: null,
  cart: {},
};

const mealTypeNames = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

const bedBuildings = [
  { name: '住院部 1 号楼', floors: 11, bedsPerFloor: 87 },
  { name: '住院部 2 号楼', floors: 20, bedsPerFloor: 101 },
  { name: '住院部 3 号楼', floors: 9, bedsPerFloor: 15 },
  { name: '住院部 4 号楼', floors: 27, bedsPerFloor: 55 },
];

// --- Utilities ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

function showLoading() { document.getElementById('loading').classList.add('show'); }
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

async function fetchJSON(url, options) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

function formatDate(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getToday() {
  return formatDate(new Date());
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

function getShortDate(dateStr) {
  const parts = dateStr.split('-');
  return parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
}

function getWeekDay(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[new Date(dateStr).getDay()];
}

const mealDeadlines = { breakfast: 0, lunch: 9, dinner: 14 };

function isMealAvailable(mealType, dateStr) {
  const now = new Date();
  const today = getToday();
  if (dateStr !== today) return true;
  const currentHour = now.getHours();
  return currentHour < mealDeadlines[mealType];
}

// --- Auth ---
function saveUser(user) {
  state.currentUser = user;
  localStorage.setItem('hospital_patient', JSON.stringify(user));
}

function loadSavedUser() {
  try {
    const saved = localStorage.getItem('hospital_patient');
    if (saved) {
      state.currentUser = JSON.parse(saved);
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

function showUserInfo() {
  const u = state.currentUser;
  let bedInfo = '';
  if (u.building) {
    bedInfo = u.building;
    if (u.bed_number) bedInfo += ' ' + u.bed_number;
  }
  document.getElementById('user-info-banner').innerHTML = `
    <div class="icon">👤</div>
    <div class="text">
      <strong>${u.name}</strong>
      ${bedInfo ? bedInfo : '未设置床位信息'}
    </div>`;
}

async function doLogin() {
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value;
  if (!phone) return showToast('请输入手机号');
  if (!/^1\d{10}$/.test(phone)) return showToast('请输入正确的11位手机号');
  if (!password) return showToast('请输入密码');

  showLoading();
  try {
    const res = await fetchJSON('/patients/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    hideLoading();
    if (res.code === 0) {
      saveUser(res.data);
      enterMainPage();
    } else {
      showToast(res.msg || '登录失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误，请重试');
  }
}

function getPasswordStrength(pwd) {
  if (!pwd) return { level: 0, label: '', cls: '' };
  if (pwd.length < 8) return { level: 0, label: '太短', cls: 'weak' };
  let score = 0;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (pwd.length >= 12) score++;
  if (score <= 1) return { level: 1, label: '弱', cls: 'weak' };
  if (score === 2) return { level: 2, label: '中', cls: 'medium' };
  if (score === 3) return { level: 3, label: '强', cls: 'strong' };
  return { level: 4, label: '很强', cls: 'very-strong' };
}

function updatePasswordStrength() {
  const pwd = document.getElementById('reg-password').value;
  const s = getPasswordStrength(pwd);
  const bars = [
    document.getElementById('bar-1'),
    document.getElementById('bar-2'),
    document.getElementById('bar-3'),
    document.getElementById('bar-4'),
  ];
  const textEl = document.getElementById('strength-text');

  bars.forEach((bar, i) => {
    bar.className = 'bar';
    if (i < s.level) bar.classList.add(s.cls);
  });
  textEl.textContent = pwd ? s.label : '';
  textEl.className = 'strength-text' + (s.cls ? ' ' + s.cls : '');
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// --- SMS Code ---
let smsCountdown = 0;
let smsTimer = null;

async function sendSmsCode() {
  const phone = document.getElementById('reg-phone').value.trim();
  if (!phone) return showToast('请先输入手机号');
  if (!/^1\d{10}$/.test(phone)) return showToast('请输入正确的11位手机号');
  if (smsCountdown > 0) return;

  const btn = document.getElementById('btn-send-code');
  btn.disabled = true;
  try {
    const res = await fetchJSON('/patients/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    if (res.code === 0) {
      showToast('验证码已发送');
      startSmsCountdown();
    } else {
      showToast(res.msg || '发送失败');
      btn.disabled = false;
    }
  } catch (e) {
    showToast('网络错误');
    btn.disabled = false;
  }
}

function startSmsCountdown() {
  smsCountdown = 60;
  const btn = document.getElementById('btn-send-code');
  btn.disabled = true;
  btn.textContent = smsCountdown + 's';
  btn.classList.add('disabled');
  smsTimer = setInterval(() => {
    smsCountdown--;
    if (smsCountdown <= 0) {
      clearInterval(smsTimer);
      btn.disabled = false;
      btn.textContent = '获取验证码';
      btn.classList.remove('disabled');
    } else {
      btn.textContent = smsCountdown + 's';
    }
  }, 1000);
}

async function doRegister() {
  const phone = document.getElementById('reg-phone').value.trim();
  const sms_code = document.getElementById('reg-sms-code').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const building = document.getElementById('reg-building').value;
  const bed_number = document.getElementById('reg-bed').value;

  if (!phone) return showToast('请输入手机号');
  if (!/^1\d{10}$/.test(phone)) return showToast('请输入正确的11位手机号');
  if (!sms_code) return showToast('请输入短信验证码');
  if (sms_code.length < 4) return showToast('验证码格式不正确');
  if (!name) return showToast('请输入姓名');
  if (!password) return showToast('请输入密码');

  const strength = getPasswordStrength(password);
  if (strength.level < 2) return showToast('密码强度不够，需至少包含两种字符类型且不少于8位');
  if (password !== password2) return showToast('两次输入的密码不一致');

  showLoading();
  try {
    const res = await fetchJSON('/patients/register', {
      method: 'POST',
      body: JSON.stringify({ phone, password, name, sms_code, building: building || '', bed_number: bed_number || '' }),
    });
    hideLoading();
    if (res.code === 0) {
      saveUser(res.data);
      showToast('注册成功');
      enterMainPage();
    } else {
      showToast(res.msg || '注册失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误，请重试');
  }
}

function doLogout() {
  state.currentUser = null;
  localStorage.removeItem('hospital_patient');
  document.getElementById('login-phone').value = '';
  document.getElementById('login-password').value = '';
  showPage('page-login');
}

function enterMainPage() {
  showUserInfo();
  state.selectedDate = getToday();
  renderDatePicker();
  renderMealCards();
  showPage('page-meal');
}

function renderDatePicker() {
  const today = getToday();
  const tomorrow = getTomorrow();
  const container = document.getElementById('date-picker-row');
  container.innerHTML = [today, tomorrow].map(d => {
    const isActive = d === state.selectedDate;
    const label = d === today ? '今天' : '明天';
    return `
      <div class="date-pick-card ${isActive ? 'active' : ''}" onclick="selectDate('${d}')">
        <div class="date-label">${label}（${getWeekDay(d)}）</div>
        <div class="date-value">${getShortDate(d)}</div>
      </div>`;
  }).join('');
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderDatePicker();
  renderMealCards();
}

function renderMealCards() {
  const dateStr = state.selectedDate;
  const meals = [
    { type: 'breakfast', icon: '🌅', label: '早餐', deadline: '当天0:00前' },
    { type: 'lunch', icon: '☀️', label: '午餐', deadline: '当天9:00前' },
    { type: 'dinner', icon: '🌙', label: '晚餐', deadline: '当天14:00前' },
  ];
  const container = document.getElementById('meal-type-grid');
  container.innerHTML = meals.map(m => {
    const available = isMealAvailable(m.type, dateStr);
    return `
      <div class="meal-type-card ${available ? '' : 'disabled'}" onclick="${available ? `selectMealType('${m.type}')` : ''}">
        <div class="icon">${m.icon}</div>
        <div class="label">${m.label}</div>
        <div class="deadline">${available ? m.deadline : '已截止'}</div>
      </div>`;
  }).join('');
}

// --- Profile ---
function loadProfileForm() {
  const u = state.currentUser;
  document.getElementById('profile-phone').value = u.phone;
  document.getElementById('profile-name').value = u.name;

  initBuildingSelect('profile');
  document.getElementById('profile-building').value = u.building || '';

  if (u.building) {
    onBuildingChange('profile');
    const floor = getBedFloorFromName(u.building, u.bed_number);
    if (floor) {
      document.getElementById('profile-floor').value = floor;
      onFloorChange('profile');
      document.getElementById('profile-bed').value = u.bed_number || '';
    }
  }
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const building = document.getElementById('profile-building').value;
  const bed_number = document.getElementById('profile-bed').value;

  if (!name) return showToast('姓名不能为空');

  showLoading();
  try {
    const res = await fetchJSON('/patients/' + state.currentUser.id, {
      method: 'PUT',
      body: JSON.stringify({ name, building: building || '', bed_number: building ? (bed_number || '') : '' }),
    });
    hideLoading();
    if (res.code === 0) {
      saveUser(res.data);
      showToast('保存成功');
      showUserInfo();
      showPage('page-meal');
    } else {
      showToast(res.msg || '保存失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误');
  }
}

// --- Building/Floor/Bed cascading ---
function initBuildingSelect(prefix) {
  const sel = document.getElementById(prefix + '-building');
  sel.innerHTML = '<option value="">请选择楼栋</option>' +
    bedBuildings.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
}

function onBuildingChange(prefix) {
  const buildingName = document.getElementById(prefix + '-building').value;
  const floorGroup = document.getElementById(prefix + '-floor-group');
  const bedGroup = document.getElementById(prefix + '-bed-group');
  const floorSel = document.getElementById(prefix + '-floor');
  const bedSel = document.getElementById(prefix + '-bed');

  if (!buildingName) {
    floorGroup.style.display = 'none';
    bedGroup.style.display = 'none';
    floorSel.innerHTML = '<option value="">请选择楼层</option>';
    bedSel.innerHTML = '<option value="">请选择床位</option>';
    return;
  }

  const b = bedBuildings.find(x => x.name === buildingName);
  if (!b) return;

  floorSel.innerHTML = '<option value="">请选择楼层</option>' +
    Array.from({ length: b.floors }, (_, i) => `<option value="${i + 1}">${i + 1}层</option>`).join('');
  floorGroup.style.display = 'block';
  bedGroup.style.display = 'none';
  bedSel.innerHTML = '<option value="">请选择床位</option>';
}

function onFloorChange(prefix) {
  const buildingName = document.getElementById(prefix + '-building').value;
  const floor = document.getElementById(prefix + '-floor').value;
  const bedGroup = document.getElementById(prefix + '-bed-group');
  const bedSel = document.getElementById(prefix + '-bed');

  if (!floor) {
    bedGroup.style.display = 'none';
    bedSel.innerHTML = '<option value="">请选择床位</option>';
    return;
  }

  const b = bedBuildings.find(x => x.name === buildingName);
  if (!b) return;

  const floorNum = parseInt(floor);
  bedSel.innerHTML = '<option value="">请选择床位</option>' +
    Array.from({ length: b.bedsPerFloor }, (_, i) => {
      const bedName = String(floorNum) + String(i + 1).padStart(3, '0');
      return `<option value="${bedName}">${bedName}床</option>`;
    }).join('');
  bedGroup.style.display = 'block';
}

function getBedFloorFromName(buildingName, bedNumber) {
  if (!buildingName || !bedNumber) return '';
  const b = bedBuildings.find(x => x.name === buildingName);
  if (!b) return '';
  for (let f = b.floors; f >= 1; f--) {
    const prefix = String(f);
    if (bedNumber.startsWith(prefix)) {
      const rest = bedNumber.slice(prefix.length);
      if (rest.length === 3) {
        const idx = parseInt(rest);
        if (idx >= 1 && idx <= b.bedsPerFloor) return String(f);
      }
    }
  }
  return '';
}

// --- Meal Type ---
function selectMealType(type) {
  state.mealType = type;
  state.orderDate = state.selectedDate;
  const dateLabel = state.orderDate === getToday() ? '今天' : '明天';
  document.getElementById('menu-title').textContent = dateLabel + ' ' + mealTypeNames[type];
  state.cart = {};
  loadMenu();
  showPage('page-menu');
}

// --- Menu ---
async function loadMenu() {
  showLoading();
  try {
    const [catRes, dishRes] = await Promise.all([
      fetchJSON('/categories/active'),
      fetchJSON('/dishes/available'),
    ]);
    state.categories = catRes.data || [];
    state.dishes = dishRes.data || [];
    if (state.categories.length > 0) {
      state.activeCategoryId = state.categories[0].id;
    }
    renderCategories();
    renderDishes();
  } catch (e) {
    showToast('加载菜单失败');
  }
  hideLoading();
}

function renderCategories() {
  const nav = document.getElementById('category-nav');
  nav.innerHTML = state.categories.map(c =>
    `<div class="cat-item ${c.id === state.activeCategoryId ? 'active' : ''}" 
          onclick="switchCategory(${c.id})">${c.name}</div>`
  ).join('');
}

function switchCategory(catId) {
  state.activeCategoryId = catId;
  renderCategories();
  renderDishes();
}

function renderDishes() {
  const list = document.getElementById('dish-list');
  const dishes = state.dishes.filter(d => d.category_id === state.activeCategoryId);
  const emojis = { '营养粥品': '🥣', '清淡主食': '🍚', '滋补汤品': '🍲', '时令蔬菜': '🥬', '荤菜': '🍗', '水果拼盘': '🍎' };
  const cat = state.categories.find(c => c.id === state.activeCategoryId);
  const emoji = (cat && emojis[cat.name]) || '🍽️';

  list.innerHTML = dishes.map(d => {
    const qty = state.cart[d.id]?.quantity || 0;
    const soldOut = d.stock <= 0;
    return `
      <div class="dish-card${soldOut ? ' sold-out' : ''}">
        <div class="dish-img">${d.image ? `<img src="${d.image}" alt="">` : emoji}</div>
        <div class="dish-info">
          <div class="name">${d.name}${soldOut ? ' <span class="sold-out-tag">已售罄</span>' : (d.stock <= 5 ? ` <span class="stock-low">剩${d.stock}份</span>` : '')}</div>
          <div class="desc">${d.description || ''}</div>
          <div class="price">${d.price}</div>
        </div>
        ${soldOut ? '' : `<div class="dish-action">
          ${qty > 0 ? `
            <button class="btn-round sub" onclick="changeQty(${d.id},-1)">-</button>
            <span class="qty">${qty}</span>
          ` : ''}
          <button class="btn-round add" onclick="changeQty(${d.id},1)">+</button>
        </div>`}
      </div>`;
  }).join('');

  if (dishes.length === 0) {
    list.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">该分类暂无菜品</p>';
  }
}

function changeQty(dishId, delta) {
  const dish = state.dishes.find(d => d.id === dishId);
  if (!dish) return;
  if (!state.cart[dishId]) {
    state.cart[dishId] = { ...dish, quantity: 0 };
  }
  const newQty = state.cart[dishId].quantity + delta;
  if (delta > 0 && newQty > dish.stock) { showToast('库存不足'); return; }
  state.cart[dishId].quantity = newQty;
  if (state.cart[dishId].quantity <= 0) delete state.cart[dishId];
  renderDishes();
  updateCartBar();
}

function updateCartBar() {
  const items = Object.values(state.cart);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const badge = document.getElementById('cart-badge');
  const total = document.getElementById('cart-total');
  const btn = document.getElementById('btn-go-confirm');

  badge.style.display = totalQty > 0 ? 'flex' : 'none';
  badge.textContent = totalQty;
  total.textContent = totalPrice.toFixed(1);
  btn.disabled = totalQty === 0;
}

// --- Cart Panel ---
function toggleCartPanel() {
  const items = Object.values(state.cart);
  if (items.length === 0) return;
  const panel = document.getElementById('cart-panel');
  const overlay = document.getElementById('cart-overlay');
  const show = !panel.classList.contains('show');
  panel.classList.toggle('show', show);
  overlay.classList.toggle('show', show);
  if (show) renderCartPanel();
}

function renderCartPanel() {
  const list = document.getElementById('cart-list');
  const items = Object.values(state.cart);
  list.innerHTML = items.map(i => `
    <div class="cart-item">
      <span class="name">${i.name}</span>
      <span class="price">¥${(i.price * i.quantity).toFixed(1)}</span>
      <div class="dish-action">
        <button class="btn-round sub" onclick="changeQty(${i.id},-1);renderCartPanel()">-</button>
        <span class="qty">${i.quantity}</span>
        <button class="btn-round add" onclick="changeQty(${i.id},1);renderCartPanel()">+</button>
      </div>
    </div>`).join('');
}

function clearCart() {
  state.cart = {};
  renderDishes();
  updateCartBar();
  document.getElementById('cart-panel').classList.remove('show');
  document.getElementById('cart-overlay').classList.remove('show');
}

// --- Confirm ---
function goConfirm() {
  const items = Object.values(state.cart);
  if (items.length === 0) return;
  document.getElementById('cart-panel').classList.remove('show');
  document.getElementById('cart-overlay').classList.remove('show');

  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const u = state.currentUser;

  let bedStr = '';
  if (u.building) {
    bedStr = u.building;
    if (u.bed_number) bedStr += ' ' + u.bed_number;
  } else {
    bedStr = '未设置';
  }

  let html = `
    <div class="confirm-card">
      <div class="label">患者信息</div>
      <div class="value">${u.name}（${u.phone}）</div>
    </div>
    <div class="confirm-card">
      <div class="label">配送地址</div>
      <div class="value">${bedStr}</div>
    </div>
    <div class="confirm-card">
      <div class="label">餐次</div>
      <div class="value">${mealTypeNames[state.mealType]}（${state.orderDate}）</div>
    </div>
    <div class="confirm-card">
      <div class="label">已选菜品</div>
      <div class="confirm-items">
        ${items.map(i => `
          <div class="item">
            <span>${i.name} × ${i.quantity}</span>
            <span style="color:var(--danger)">¥${(i.price * i.quantity).toFixed(1)}</span>
          </div>`).join('')}
      </div>
      <div class="confirm-total">
        <span>合计</span>
        <span class="price">¥${totalPrice.toFixed(1)}</span>
      </div>
    </div>
    <div class="confirm-card">
      <div class="label">备注</div>
      <textarea class="remark-input" id="remark" placeholder="如有特殊饮食要求请备注..."></textarea>
    </div>
    <button class="btn-confirm" onclick="submitOrder()">确认下单</button>`;

  document.getElementById('confirm-content').innerHTML = html;
  showPage('page-confirm');
}

async function submitOrder() {
  const items = Object.values(state.cart).map(i => ({
    dish_id: i.id,
    quantity: i.quantity,
    price: i.price,
  }));
  const remark = document.getElementById('remark')?.value || '';
  showLoading();
  try {
    const res = await fetchJSON('/orders', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: state.currentUser.id,
        meal_type: state.mealType,
        order_date: state.orderDate,
        items,
        remark,
      }),
    });
    hideLoading();
    if (res.code === 0) {
      state.cart = {};
      showPage('page-success');
    } else {
      showToast(res.msg || '下单失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误，请重试');
  }
}

function backToHome() {
  state.cart = {};
  state.selectedDate = getToday();
  renderDatePicker();
  renderMealCards();
  showPage('page-meal');
}

// --- My Orders ---
const orderStatusNames = { paid: '已支付', delivering: '配送中', delivered: '已送达', refunding: '退款中', refunded: '已退款', cancelled: '废弃', user_cancelled: '已取消' };
let currentOrderFilter = '';

function openMyOrders() {
  currentOrderFilter = '';
  document.querySelectorAll('.orders-tab').forEach(t => t.classList.toggle('active', t.dataset.status === ''));
  loadMyOrders();
  showPage('page-orders');
}

function switchOrderTab(el, status) {
  document.querySelectorAll('.orders-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentOrderFilter = status;
  loadMyOrders();
}

async function loadMyOrders() {
  showLoading();
  try {
    let url = '/orders?patient_id=' + state.currentUser.id;
    if (currentOrderFilter) url += '&status=' + currentOrderFilter;
    const res = await fetchJSON(url);
    hideLoading();
    renderMyOrders(res.data || []);
  } catch (e) {
    hideLoading();
    showToast('加载订单失败');
  }
}

function renderMyOrders(orders) {
  const container = document.getElementById('orders-list');
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="orders-empty">
        <div class="empty-icon">📋</div>
        <div>暂无${currentOrderFilter ? orderStatusNames[currentOrderFilter] : ''}订单记录</div>
      </div>`;
    return;
  }

  container.innerHTML = orders.map(o => {
    const statusCls = o.status || 'paid';
    const statusText = orderStatusNames[o.status] || o.status;
    const mealText = mealTypeNames[o.meal_type] || o.meal_type;
    return `
      <div class="order-card" onclick="viewOrderDetail(${o.id})">
        <div class="order-card-header">
          <span class="order-date">${o.order_date} ${mealText}</span>
          <span class="order-status-tag ${statusCls}">${statusText}</span>
        </div>
        <div class="order-card-body">
          <div class="order-card-items">订单号 #${o.id}</div>
        </div>
        <div class="order-card-footer">
          <span class="total">${o.total_price}</span>
          <div class="order-card-actions">
            ${o.status === 'paid' ? `<button class="btn-cancel-order" onclick="event.stopPropagation();cancelOrder(${o.id})">取消订单</button>` : ''}
            ${o.can_refund ? `<button class="btn-refund" onclick="event.stopPropagation();openRefundPage(${o.id})">申请退款</button>` : ''}
            <button class="btn-order-detail">查看详情</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function viewOrderDetail(orderId) {
  showLoading();
  try {
    const res = await fetchJSON('/orders/' + orderId);
    hideLoading();
    if (res.code !== 0) return showToast('加载失败');
    const o = res.data;
    const items = o.items || [];
    const statusText = orderStatusNames[o.status] || o.status;
    const mealText = mealTypeNames[o.meal_type] || o.meal_type;

    const statusLogMap = {};
    (o.status_logs || []).forEach(l => { statusLogMap[l.status] = l.created_at; });

    let steps, stepLabels, stepIcons;
    if (o.status === 'user_cancelled') {
      steps = ['paid', 'user_cancelled'];
      stepLabels = ['已支付', '已取消'];
      stepIcons = ['💰', '❌'];
    } else if (['refunding', 'refunded', 'cancelled'].includes(o.status)) {
      steps = ['paid', 'delivering', 'delivered', 'refunding'];
      stepLabels = ['已支付', '配送中', '已送达', '退款中'];
      stepIcons = ['💰', '🚗', '✅', '🔄'];
      if (o.status === 'refunded') { steps.push('refunded'); stepLabels.push('已退款'); stepIcons.push('💸'); }
      else if (o.status === 'cancelled') { steps.push('cancelled'); stepLabels.push('废弃'); stepIcons.push('🚫'); }
    } else {
      steps = ['paid', 'delivering', 'delivered'];
      stepLabels = ['已支付', '配送中', '已送达'];
      stepIcons = ['💰', '🚗', '✅'];
    }
    const currentIdx = steps.indexOf(o.status);

    let statusBarHTML = '<div class="order-status-bar">';
    steps.forEach((s, i) => {
      let cls = '';
      if (i < currentIdx) cls = 'done';
      else if (i === currentIdx) cls = i === steps.length - 1 ? 'done' : 'active';
      const logTime = statusLogMap[s];
      const timeStr = logTime ? `<div class="step-time">${logTime}</div>` : '';
      statusBarHTML += `<div class="status-step ${cls}">
        <div class="step-icon">${stepIcons[i]}</div>
        <div class="step-label">${stepLabels[i]}</div>
        ${timeStr}
      </div>`;
      if (i < steps.length - 1) {
        statusBarHTML += `<div class="status-line ${i < currentIdx ? 'done' : ''}"></div>`;
      }
    });
    statusBarHTML += '</div>';

    const canCancel = o.status === 'paid';

    let actionBtn = '';
    if (canCancel) actionBtn = `<button class="btn-confirm btn-cancel-action" onclick="cancelOrder(${o.id})">取消订单</button>`;
    else if (o.can_refund) actionBtn = `<button class="btn-confirm" style="background:#FF4D4F;margin-top:16px;" onclick="openRefundPage(${o.id})">申请退款</button>`;

    let refundInfoHtml = '';
    if (['refunding', 'refunded', 'cancelled'].includes(o.status) && o.refund_reason) {
      let imgs = [];
      try { imgs = JSON.parse(o.refund_images || '[]'); } catch(e) {}
      refundInfoHtml = `
        <div class="confirm-card">
          <div class="label">退款原因</div>
          <div class="value">${o.refund_reason}</div>
        </div>
        ${o.refund_desc ? `<div class="confirm-card"><div class="label">问题描述</div><div class="value">${o.refund_desc}</div></div>` : ''}
        ${imgs.length > 0 ? `<div class="confirm-card"><div class="label">退款凭证</div><div class="refund-preview-imgs">${imgs.map(u => `<img src="${u}" onclick="window.open('${u}')">`).join('')}</div></div>` : ''}`;
    }

    let cancelInfoHtml = '';
    if (o.status === 'user_cancelled' && o.cancel_reason) {
      cancelInfoHtml = `
        <div class="confirm-card">
          <div class="label">取消原因</div>
          <div class="value">${o.cancel_reason}</div>
        </div>
        ${o.cancel_desc ? `<div class="confirm-card"><div class="label">补充说明</div><div class="value">${o.cancel_desc}</div></div>` : ''}`;
    }

    let timelineHtml = '';
    if (o.status_logs && o.status_logs.length > 0) {
      timelineHtml = '<div class="confirm-card"><div class="label">状态变更记录</div><div class="status-timeline">';
      o.status_logs.forEach(l => {
        timelineHtml += `<div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span class="timeline-status">${orderStatusNames[l.status] || l.status}</span>
            <span class="timeline-time">${l.created_at}</span>
          </div>
        </div>`;
      });
      timelineHtml += '</div></div>';
    }

    document.getElementById('order-detail-content').innerHTML = `
      ${statusBarHTML}
      <div class="confirm-card">
        <div class="label">订单编号</div>
        <div class="value">#${o.id}</div>
      </div>
      <div class="confirm-card">
        <div class="label">餐次</div>
        <div class="value">${mealText}（${o.order_date}）</div>
      </div>
      <div class="confirm-card">
        <div class="label">菜品明细</div>
        <div class="confirm-items">
          ${items.map(i => `
            <div class="item">
              <span>${i.dish_name} × ${i.quantity}</span>
              <span style="color:var(--danger)">¥${(i.price * i.quantity).toFixed(1)}</span>
            </div>`).join('')}
        </div>
        <div class="confirm-total">
          <span>合计</span>
          <span class="price">¥${o.total_price}</span>
        </div>
      </div>
      ${o.remark ? `<div class="confirm-card"><div class="label">备注</div><div class="value">${o.remark}</div></div>` : ''}
      ${timelineHtml}
      ${cancelInfoHtml}
      ${refundInfoHtml}
      ${actionBtn}`;
    showPage('page-order-detail');
  } catch (e) {
    hideLoading();
    showToast('网络错误');
  }
}

// --- Cancel Order ---
const cancelReasons = [
  '计划有变，不需要了',
  '下单下错了',
  '想更换其他菜品',
  '等待时间太长',
  '重复下单了',
  '其他',
];
let selectedCancelReason = '';

function cancelOrder(orderId) {
  document.getElementById('cancel-order-id').value = orderId;
  selectedCancelReason = '';
  document.getElementById('cancel-desc').value = '';
  document.getElementById('cancel-char-num').textContent = '0';
  document.getElementById('cancel-other-group').style.display = 'none';

  const container = document.getElementById('cancel-reasons');
  container.innerHTML = cancelReasons.map(r => `
    <div class="refund-reason-item" onclick="selectCancelReason(this, '${r}')">
      <span class="reason-radio"></span>
      <span>${r}</span>
    </div>`).join('');

  showPage('page-cancel');
}

function selectCancelReason(el, reason) {
  el.closest('.refund-reasons').querySelectorAll('.refund-reason-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  selectedCancelReason = reason;
  document.getElementById('cancel-other-group').style.display = (reason === '其他') ? 'block' : 'none';
}

async function submitCancel() {
  if (!selectedCancelReason) return showToast('请选择取消原因');
  const orderId = document.getElementById('cancel-order-id').value;
  const description = (selectedCancelReason === '其他') ? document.getElementById('cancel-desc').value.trim() : '';

  showLoading();
  try {
    const res = await fetchJSON('/orders/' + orderId + '/cancel', {
      method: 'POST',
      body: JSON.stringify({ reason: selectedCancelReason, description }),
    });
    hideLoading();
    if (res.code === 0) {
      showToast('订单已取消');
      loadMyOrders();
      showPage('page-orders');
    } else {
      showToast(res.msg || '取消失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误');
  }
}

// --- Refund ---
const refundReasons = [
  '菜品送达晚了',
  '菜品质量有问题',
  '送错菜品了',
  '菜品分量不足',
  '餐具/包装有问题',
  '其他',
];
let selectedRefundReason = '';
let refundImageFiles = [];

function openRefundPage(orderId) {
  document.getElementById('refund-order-id').value = orderId;
  selectedRefundReason = '';
  refundImageFiles = [];
  document.getElementById('refund-desc').value = '';
  document.getElementById('refund-char-num').textContent = '0';
  document.getElementById('refund-other-group').style.display = 'none';

  const container = document.getElementById('refund-reasons');
  container.innerHTML = refundReasons.map(r => `
    <div class="refund-reason-item" onclick="selectRefundReason(this, '${r}')">
      <span class="reason-radio"></span>
      <span>${r}</span>
    </div>`).join('');

  renderRefundImages();
  showPage('page-refund');
}

function selectRefundReason(el, reason) {
  document.querySelectorAll('.refund-reason-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  selectedRefundReason = reason;
  document.getElementById('refund-other-group').style.display = (reason === '其他') ? 'block' : 'none';
}

function renderRefundImages() {
  const container = document.getElementById('refund-images');
  const previews = refundImageFiles.map((f, i) => `
    <div class="img-preview">
      <img src="${URL.createObjectURL(f)}">
      <div class="img-remove" onclick="removeRefundImage(${i})">×</div>
    </div>`).join('');

  const addBtn = refundImageFiles.length < 5 ? `
    <div class="img-upload-btn" onclick="document.getElementById('refund-file-input').click()">
      <span>+</span>
      <span class="img-upload-text">添加图片</span>
    </div>` : '';

  container.innerHTML = previews + addBtn;
}

function handleRefundImages(input) {
  const files = Array.from(input.files);
  for (const f of files) {
    if (refundImageFiles.length >= 5) { showToast('最多上传5张图片'); break; }
    if (f.size > 2 * 1024 * 1024) { showToast(`${f.name} 超过2MB限制`); continue; }
    refundImageFiles.push(f);
  }
  input.value = '';
  renderRefundImages();
}

function removeRefundImage(idx) {
  refundImageFiles.splice(idx, 1);
  renderRefundImages();
}

async function submitRefund() {
  const orderId = document.getElementById('refund-order-id').value;
  if (!selectedRefundReason) return showToast('请选择退款原因');
  const description = (selectedRefundReason === '其他') ? document.getElementById('refund-desc').value.trim() : '';
  if (selectedRefundReason === '其他' && !description) return showToast('请描述具体问题');

  showLoading();
  try {
    let imageUrls = [];
    if (refundImageFiles.length > 0) {
      const formData = new FormData();
      refundImageFiles.forEach(f => formData.append('images', f));
      const uploadRes = await fetch(API_BASE + '/upload/multi', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.code !== 0) { hideLoading(); return showToast('图片上传失败'); }
      imageUrls = uploadData.data.urls;
    }

    const res = await fetchJSON('/orders/' + orderId + '/refund', {
      method: 'POST',
      body: JSON.stringify({ reason: selectedRefundReason, description, images: imageUrls }),
    });
    hideLoading();
    if (res.code === 0) {
      showToast('退款申请已提交，请等待审核');
      loadMyOrders();
      showPage('page-orders');
    } else {
      showToast(res.msg || '申请失败');
    }
  } catch (e) {
    hideLoading();
    showToast('网络错误');
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initBuildingSelect('reg');
  initBuildingSelect('profile');

  const observer = new MutationObserver(() => {
    if (document.getElementById('page-profile').classList.contains('active')) {
      loadProfileForm();
    }
  });
  observer.observe(document.getElementById('page-profile'), { attributes: true, attributeFilter: ['class'] });

  document.getElementById('refund-desc').addEventListener('input', function() {
    document.getElementById('refund-char-num').textContent = this.value.length;
  });

  document.getElementById('cancel-desc').addEventListener('input', function() {
    document.getElementById('cancel-char-num').textContent = this.value.length;
  });

  if (loadSavedUser()) {
    enterMainPage();
  }
});

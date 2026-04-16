// ==========================
// 🔗 API رابط الشيت
// ==========================
const API = "https://script.google.com/macros/s/AKfycbxmF-cXhSTY55MYVBTuv7oos76xhDLQ9HX6XNmSsQfcM46Z6oehEEBXQrB_rD9ykejLwg/exec";

// ==========================
// 🧠 الحالة العامة
// ==========================
let DATA = {
  products: [],
  customers: [],
  reps: []
};

let state = {
  view: "login",
  selectedCompany: ""
};

let cart = JSON.parse(localStorage.getItem("cart") || "[]");

// ==========================
// 📦 تحميل البيانات
// ==========================
async function loadData() {
  try {
    const res = await fetch(API);
    const data = await res.json();

    DATA.products = typeof data.products === "string" ? JSON.parse(data.products) : (data.products || []);
    DATA.customers = typeof data.customers === "string" ? JSON.parse(data.customers) : (data.customers || []);
    DATA.reps = typeof data.reps === "string" ? JSON.parse(data.reps) : (data.reps || []);

    renderCompanies();

  } catch (e) {
    alert("فشل تحميل البيانات");
    console.error(e);
  }
}

// ==========================
// 🔐 تسجيل الدخول
// ==========================
function login() {
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();

  const user = DATA.customers.find(c =>
    String(c.phone) === phone &&
    String(c.password) === password &&
    Number(c.status) === 1
  );

  if (!user) {
    alert("بيانات الدخول غير صحيحة");
    return;
  }

  localStorage.setItem("user", JSON.stringify(user));
  setView("home");
}

// ==========================
// 🔄 تغيير الصفحات
// ==========================
function setView(view) {
  state.view = view;

  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(view + "View").classList.add("active");

  if (view === "cart") renderCart();
}

// ==========================
// 🏢 عرض الشركات
// ==========================
function renderCompanies() {
  const root = document.getElementById("companies");
  root.innerHTML = "";

  const companiesMap = {};

  DATA.products.forEach(p => {
    if (Number(p.visible) !== 1) return;

    const name = p.company;
    if (!companiesMap[name]) {
      companiesMap[name] = true;
    }
  });

  Object.keys(companiesMap).forEach(company => {
    const el = document.createElement("div");
    el.className = "company-card";
    el.innerText = company;

    el.onclick = () => {
      state.selectedCompany = company;
      setView("products");
      renderProducts();
    };

    root.appendChild(el);
  });
}

// ==========================
// 🛍 عرض المنتجات
// ==========================
function renderProducts() {
  const root = document.getElementById("products");
  root.innerHTML = "";

  const list = DATA.products.filter(p =>
    p.company === state.selectedCompany &&
    Number(p.visible) === 1
  );

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "product-card";

    const price = Number(p.base_carton || 0);

    el.innerHTML = `
      <div>${p.name}</div>
      <div>${price} جنيه</div>
      <button class="plus">+</button>
      <input type="number" value="1" min="1">
      <button class="minus">-</button>
      <button class="add">إضافة</button>
      ${Number(p.status) === 0 ? "<div style='color:red'>نفذت الكمية</div>" : ""}
    `;

    const input = el.querySelector("input");

    el.querySelector(".plus").onclick = () => {
      input.value = Number(input.value) + 1;
    };

    el.querySelector(".minus").onclick = () => {
      input.value = Math.max(1, Number(input.value) - 1);
    };

    el.querySelector(".add").onclick = () => {
      if (Number(p.status) === 0) {
        alert("المنتج غير متوفر");
        return;
      }

      const qty = Math.max(1, Number(input.value));

      const existing = cart.find(i => i.code === p.code);

      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({
          code: p.code,
          qty: qty
        });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      alert("تمت الإضافة");
    };

    root.appendChild(el);
  });
}

// ==========================
// 🛒 عرض السلة
// ==========================
function renderCart() {
  const root = document.getElementById("cart");
  root.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    const p = DATA.products.find(x => x.code === item.code);
    if (!p) return;

    const price = Number(p.base_carton || 0) * item.qty;
    total += price;

    const el = document.createElement("div");

    el.innerHTML = `
      <div>${p.name}</div>
      <div>${item.qty}</div>
      <div>${price} جنيه</div>
      <button>حذف</button>
    `;

    el.querySelector("button").onclick = () => {
      cart = cart.filter(x => x.code !== item.code);
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    };

    root.appendChild(el);
  });

  document.getElementById("total").innerText = "الإجمالي: " + total + " جنيه";
}

// ==========================
// 🔙 رجوع
// ==========================
function goHome() {
  setView("home");
}

// ==========================
// 🚀 تشغيل
// ==========================
loadData();

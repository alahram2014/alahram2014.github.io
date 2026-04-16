// =======================
// إعدادات أساسية
// =======================

let DATA = { products: [], companies: [] };

const API_URL = "https://script.google.com/macros/s/AKfycbxmF-cXhSTY55MYVBTuv7oos76xhDLQ9HX6XNmSsQfcM46Z6oehEEBXQrB_rD9ykejLwg/exec";

const state = { view: "home", selectedCompanyId: "" };

let cart = JSON.parse(localStorage.getItem("cart") || "[]");


// =======================
// تحميل البيانات من الشيت
// =======================

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    // حل مشكلة إن الداتا جاية string
    DATA.products = typeof data.products === "string"
      ? JSON.parse(data.products)
      : (data.products || []);

    // استخراج الشركات من المنتجات (حسب الشيت)
    const map = {};

    DATA.products.forEach(p => {
      const companyId = p.company || "unknown";
      const companyName = p.company || "بدون اسم";

      if (!map[companyId]) {
        map[companyId] = {
          id: companyId,
          name: companyName
        };
      }
    });

    DATA.companies = Object.values(map);

  } catch (e) {
    alert("خطأ في تحميل البيانات");
    console.error(e);
  }
}


// =======================
// جلب السعر (دايناميك)
// =======================

function getPrice(id) {
  const p = DATA.products.find(x => x.product_id == id || x.code == id);
  return p ? Number(p.price || p.base_carton || 0) : 0;
}


// =======================
// تغيير الصفحات
// =======================

function setView(v) {
  state.view = v;

  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));

  const el = document.getElementById(v + "View");
  if (el) el.classList.add("active");

  if (v === "cart") renderCart();
}


// =======================
// عرض الشركات
// =======================

function renderCompanies() {
  const root = document.getElementById("companiesGrid");
  root.innerHTML = "";

  DATA.companies.forEach(c => {
    const el = document.createElement("div");
    el.className = "company-card";

    el.innerHTML = `<b>${c.name}</b>`;

    el.onclick = () => {
      state.selectedCompanyId = c.id;
      setView("catalog");
      renderProducts();
    };

    root.appendChild(el);
  });
}


// =======================
// عرض المنتجات
// =======================

function renderProducts() {
  const root = document.getElementById("productsGrid");
  root.innerHTML = "";

  const list = DATA.products.filter(p =>
    (p.company || "") === state.selectedCompanyId
  );

  if (list.length === 0) {
    root.innerHTML = "<p>لا يوجد منتجات</p>";
    return;
  }

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "product-card";

    const price = getPrice(p.product_id || p.code);

    el.innerHTML = `
      <div><b>${p.name || "بدون اسم"}</b></div>
      <div>السعر: ${price}</div>

      <button class="plus">+</button>
      <input type="number" value="1" min="1">
      <button class="minus">-</button>

      <button class="add">إضافة للسلة</button>
    `;

    const input = el.querySelector("input");

    el.querySelector(".plus").onclick = () => input.value++;
    el.querySelector(".minus").onclick = () => {
      input.value = Math.max(1, input.value - 1);
    };

    el.querySelector(".add").onclick = () => {
      const qty = Math.max(1, Number(input.value));

      const id = p.product_id || p.code;

      const existing = cart.find(i => i.product_id == id);

      if (existing) {
        existing.qty = qty;
      } else {
        cart.push({
          product_id: id,
          qty: qty
        });
      }

      localStorage.setItem("cart", JSON.stringify(cart));

      alert("تمت الإضافة بنجاح");
    };

    root.appendChild(el);
  });
}


// =======================
// عرض السلة
// =======================

function renderCart() {
  const root = document.getElementById("cartList");
  root.innerHTML = "";

  let total = 0;

  cart.forEach(i => {
    const p = DATA.products.find(x =>
      (x.product_id == i.product_id || x.code == i.product_id)
    );

    if (!p) return;

    const price = getPrice(i.product_id) * i.qty;
    total += price;

    const el = document.createElement("div");

    el.innerHTML = `
      <div>${p.name}</div>
      <div>الكمية: ${i.qty}</div>
      <div>الإجمالي: ${price}</div>
      <button>حذف</button>
    `;

    el.querySelector("button").onclick = () => {
      cart = cart.filter(x => x.product_id != i.product_id);
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    };

    root.appendChild(el);
  });

  document.getElementById("cartTotal").innerText = total;
}


// =======================
// تشغيل النظام
// =======================

async function init() {
  await loadData();
  renderCompanies();
}

init();

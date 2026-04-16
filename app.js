// =======================
// CONFIG
// =======================

const API_URL = "https://script.google.com/macros/s/AKfycbxmF-cXhSTY55MYVBTuv7oos76xhDLQ9HX6XNmSsQfcM46Z6oehEEBXQrB_rD9ykejLwg/exec";

let DATA = {
  products: [],
  companies: []
};

let cart = JSON.parse(localStorage.getItem("cart") || "[]");

const state = {
  view: "home",
  selectedCompany: ""
};


// =======================
// LOAD DATA
// =======================

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    DATA.products = typeof data.products === "string"
      ? JSON.parse(data.products)
      : (data.products || []);

    // استخراج الشركات من عمود company
    const companiesMap = {};

    DATA.products.forEach(p => {
      if (p.company && !companiesMap[p.company]) {
        companiesMap[p.company] = {
          name: p.company
        };
      }
    });

    DATA.companies = Object.values(companiesMap);

  } catch (err) {
    alert("فشل تحميل البيانات");
    console.error(err);
  }
}


// =======================
// PRICE ENGINE
// =======================

function getPrice(product, unit) {
  if (unit === "pack") return Number(product.base_pack || 0);
  if (unit === "piece") return Number(product.base_piece || 0);
  return Number(product.base_carton || 0);
}


// =======================
// NAVIGATION
// =======================

function setView(view) {
  state.view = view;

  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(view + "View").classList.add("active");

  if (view === "cart") renderCart();
}


// =======================
// COMPANIES
// =======================

function renderCompanies() {
  const root = document.getElementById("companiesGrid");
  root.innerHTML = "";

  DATA.companies.forEach(c => {
    const el = document.createElement("div");
    el.className = "company-card";
    el.innerHTML = `<b>${c.name}</b>`;

    el.onclick = () => {
      state.selectedCompany = c.name;
      setView("catalog");
      renderProducts();
    };

    root.appendChild(el);
  });
}


// =======================
// PRODUCTS
// =======================

function renderProducts() {
  const root = document.getElementById("productsGrid");
  root.innerHTML = "";

  const list = DATA.products.filter(p => p.company === state.selectedCompany);

  if (!list.length) {
    root.innerHTML = "<p>لا يوجد منتجات</p>";
    return;
  }

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "product-card";

    el.innerHTML = `
      <div><b>${p.name}</b></div>

      <select class="unit">
        <option value="">اختر الوحدة</option>
        <option value="carton">كرتونة</option>
        <option value="pack">دستة</option>
        <option value="piece">قطعة</option>
      </select>

      <div class="price">السعر: -</div>

      <button class="plus">+</button>
      <input type="number" value="1" min="1">
      <button class="minus">-</button>

      <button class="add">إضافة</button>
    `;

    const unitSelect = el.querySelector(".unit");
    const priceDiv = el.querySelector(".price");
    const input = el.querySelector("input");

    unitSelect.onchange = () => {
      const price = getPrice(p, unitSelect.value);
      priceDiv.innerText = "السعر: " + price;
    };

    el.querySelector(".plus").onclick = () => input.value++;
    el.querySelector(".minus").onclick = () => {
      input.value = Math.max(1, input.value - 1);
    };

    el.querySelector(".add").onclick = () => {
      const unit = unitSelect.value;
      if (!unit) return alert("اختار الوحدة الأول");

      const qty = Math.max(1, Number(input.value));

      const existing = cart.find(i => i.code === p.code && i.unit === unit);

      if (existing) {
        existing.qty = qty;
      } else {
        cart.push({
          code: p.code,
          unit: unit,
          qty: qty
        });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      alert("تمت الإضافة");
    };

    root.appendChild(el);
  });
}


// =======================
// CART
// =======================

function renderCart() {
  const root = document.getElementById("cartList");
  root.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    const p = DATA.products.find(x => x.code === item.code);
    if (!p) return;

    const price = getPrice(p, item.unit) * item.qty;
    total += price;

    const el = document.createElement("div");

    el.innerHTML = `
      <div>${p.name}</div>
      <div>${item.unit}</div>
      <div>${item.qty}</div>
      <div>${price}</div>
      <button>حذف</button>
    `;

    el.querySelector("button").onclick = () => {
      cart = cart.filter(x => !(x.code === item.code && x.unit === item.unit));
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    };

    root.appendChild(el);
  });

  document.getElementById("cartTotal").innerText = total;
}


// =======================
// INIT
// =======================

async function init() {
  await loadData();
  renderCompanies();
}

init();

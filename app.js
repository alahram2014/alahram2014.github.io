let DATA = { products: [], companies: [] };

const API_URL = "https://script.google.com/macros/s/AKfycbxmF-cXhSTY55MYVBTuv7oos76xhDLQ9HX6XNmSsQfcM46Z6oehEEBXQrB_rD9ykejLwg/exec";

const state = { view: "home", selectedCompanyId: "" };

let cart = JSON.parse(localStorage.getItem("cart") || "[]");

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    DATA.products = typeof data.products === "string"   ? JSON.parse(data.products)   : (data.products || []);

    const map = {};
    DATA.products.forEach(p => {
      if (!map[p.company_id]) {
        map[p.company_id] = { id: p.company_id, name: p.company_name };
      }
    });

    DATA.companies = Object.values(map);

  } catch (e) {
    alert("خطأ في تحميل البيانات");
    console.error(e);
  }
}

function getPrice(id) {
  const p = DATA.products.find(x => x.product_id === id);
  return p ? Number(p.price || 0) : 0;
}

function setView(v) {
  state.view = v;
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));
  document.getElementById(v + "View").classList.add("active");

  if (v === "cart") renderCart();
}

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

function renderProducts() {
  const root = document.getElementById("productsGrid");
  root.innerHTML = "";

  const list = DATA.products.filter(p => p.company_id === state.selectedCompanyId);

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "product-card";

    el.innerHTML = `
      <div>${p.name}</div>
      <div>${getPrice(p.product_id)}</div>
      <button class="plus">+</button>
      <input type="number" value="1">
      <button class="minus">-</button>
      <button class="add">إضافة</button>
    `;

    const input = el.querySelector("input");

    el.querySelector(".plus").onclick = () => input.value++;
    el.querySelector(".minus").onclick = () => input.value = Math.max(1, input.value - 1);

    el.querySelector(".add").onclick = () => {
      const qty = Math.max(1, Number(input.value));
      const existing = cart.find(i => i.product_id === p.product_id);

      if (existing) {
        existing.qty = qty;
      } else {
        cart.push({ product_id: p.product_id, qty });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      alert("تمت الإضافة");
    };

    root.appendChild(el);
  });
}

function renderCart() {
  const root = document.getElementById("cartList");
  root.innerHTML = "";
  let total = 0;

  cart.forEach(i => {
    const p = DATA.products.find(x => x.product_id === i.product_id);
    if (!p) return;

    const price = getPrice(i.product_id) * i.qty;
    total += price;

    const el = document.createElement("div");
    el.innerHTML = `
      <div>${p.name}</div>
      <div>${i.qty}</div>
      <div>${price}</div>
      <button>حذف</button>
    `;

    el.querySelector("button").onclick = () => {
      cart = cart.filter(x => x.product_id !== i.product_id);
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    };

    root.appendChild(el);
  });

  document.getElementById("cartTotal").innerText = total;
}

async function init() {
  await loadData();
  renderCompanies();
}

init();

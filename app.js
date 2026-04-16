// Phase 1 FIXED — بدون تخزين سعر + Price Engine
(function(){
'use strict';

const DATA = window.ALAHRAM_PHASE1_DATA;

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const money = v=>Number(v||0).toLocaleString('en-US');

const state={
 view:'home',
 selectedCompanyId:'',
 companySearch:'',
 productSearch:'',
 cart: JSON.parse(localStorage.getItem('cart_v2')||'[]')
};

function saveCart(){localStorage.setItem('cart_v2',JSON.stringify(state.cart));}

// ✅ Price Engine
function getPrice(productId){
 const p = DATA.products.find(x=>x.id===productId);
 return p ? p.price : 0;
}

// ✅ Total calculation (no stored price)
function getTotal(){
 return state.cart.reduce((sum,i)=>sum+(getPrice(i.product_id)*i.qty),0);
}

function updateTotal(){
 const t=money(getTotal());
 $('#cartTotal').textContent=t;
 $('#footerTotalBtn').textContent=t;
}

function setView(v){
 state.view=v;
 $$('.view').forEach(x=>x.classList.remove('active'));
 $('#'+v+'View').classList.add('active');
 if(v==='catalog') renderProducts();
 if(v==='cart') renderCart();
}

function renderCompanies(){
 const root=$('#companiesGrid');
 root.innerHTML='';
 DATA.companies.forEach(c=>{
  const btn=document.createElement('button');
  btn.className='company-card';
  btn.innerHTML=`<div class="company-circle"><img src="${c.image}"></div><div class="company-name">${c.name}</div>`;
  btn.onclick=()=>{
    state.selectedCompanyId=c.id;
    setView('catalog');
  };
  root.appendChild(btn);
 });
}

function renderProducts(){
 const root=$('#productsGrid');
 root.innerHTML='';
 const list=DATA.products.filter(p=>p.company_id===state.selectedCompanyId);

 list.forEach(p=>{
  const card=document.createElement('div');
  card.className='product-card';

  let unit='',qty=1;

  card.innerHTML=`
    <div class="product-body">
      <div>${p.name}</div>
      <div>${money(getPrice(p.id))}</div>
      <div class="units"></div>
      <input type="number" value="1">
      <button>إضافة</button>
    </div>
  `;

  const unitsEl=card.querySelector('.units');
  ['carton','pack','piece'].forEach(u=>{
    const b=document.createElement('button');
    b.textContent=u;
    b.onclick=()=>unit=u;
    unitsEl.appendChild(b);
  });

  const input=card.querySelector('input');
  input.onchange=()=>qty=Math.max(1,Number(input.value));

  card.querySelector('button').onclick=()=>{
    if(!unit) return alert('اختار الوحدة');

    const existing=state.cart.find(i=>i.product_id===p.id);
    if(existing){
      existing.qty=qty;
      existing.unit=unit;
    }else{
      state.cart.push({
        product_id:p.id,
        unit:unit,
        qty:qty
      });
    }

    saveCart();
    updateTotal();
  };

  root.appendChild(card);
 });
}

function renderCart(){
 const root=$('#cartList');
 root.innerHTML='';

 state.cart.forEach(i=>{
  const p=DATA.products.find(x=>x.id===i.product_id);
  const el=document.createElement('div');

  el.innerHTML=`
    <div>${p.name}</div>
    <div>${i.unit} × ${i.qty}</div>
    <div>${money(getPrice(i.product_id)*i.qty)}</div>
    <button>حذف</button>
  `;

  el.querySelector('button').onclick=()=>{
    state.cart=state.cart.filter(x=>x.product_id!==i.product_id);
    saveCart();
    renderCart();
    updateTotal();
  };

  root.appendChild(el);
 });

 updateTotal();
}

function init(){
 renderCompanies();
 renderCart();
 updateTotal();

 $('#footerCartBtn').onclick=()=>setView('cart');
 $('#footerHomeBtn').onclick=()=>setView('home');
}

init();
})();

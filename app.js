const API="PUT_YOUR_API";

let DATA={products:[],customers:[],reps:[]};
let cart=[];

async function load(){
 const res=await fetch(API);
 const d=await res.json();
 DATA.products=d.products;
 renderCompanies();
}

function login(){
 const phone=document.getElementById('phone').value;
 const pass=document.getElementById('password').value;
 const user=DATA.customers.find(x=>x.phone==phone && x.password==pass);
 if(user){
   show('homeView');
 }else alert('خطأ');
}

function renderCompanies(){
 const c=[...new Set(DATA.products.map(p=>p.company))];
 const root=document.getElementById('companies');
 root.innerHTML='';
 c.forEach(x=>{
   let div=document.createElement('div');
   div.innerText=x;
   div.onclick=()=>showProducts(x);
   root.appendChild(div);
 });
}

function showProducts(company){
 show('productsView');
 const list=DATA.products.filter(p=>p.company==company && p.visible==1);
 const root=document.getElementById('products');
 root.innerHTML='';
 list.forEach(p=>{
   let d=document.createElement('div');
   d.className='product';
   d.innerHTML=`${p.name} <button onclick="add('${p.code}')">+</button>`;
   root.appendChild(d);
 });
}

function add(code){
 let f=cart.find(x=>x.code==code);
 if(f) f.qty++;
 else cart.push({code,qty:1});
 renderCart();
}

function renderCart(){
 show('cartView');
 let t=0;
 const root=document.getElementById('cart');
 root.innerHTML='';
 cart.forEach(i=>{
  let p=DATA.products.find(x=>x.code==i.code);
  let price=p.base_carton*i.qty;
  t+=price;
  root.innerHTML+=`${p.name} ${i.qty} = ${price}<br>`;
 });
 document.getElementById('total').innerText="الإجمالي: "+t;
}

function show(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 document.getElementById(v).classList.add('active');
}

function goHome(){show('homeView')}

load();

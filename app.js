const STORAGE_KEY = "earnsmart_v1";
const starterProducts = [
  {id:"sample-1",name:"Everyday tech accessories",url:"https://example.com/replace-with-your-affiliate-link",sample:true},
  {id:"sample-2",name:"Home and kitchen finds",url:"https://example.com/replace-with-your-affiliate-link",sample:true},
  {id:"sample-3",name:"Study and work essentials",url:"https://example.com/replace-with-your-affiliate-link",sample:true}
];

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved && Array.isArray(saved.products)) return saved;
  } catch(e) {}
  return {products:starterProducts,clicks:0};
}
let state = loadState();
const $ = id => document.getElementById(id);
const safeUrl = value => {
  try { const u = new URL(value); return ["http:","https:"].includes(u.protocol) ? u.href : null; }
  catch { return null; }
};
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function render(){
  $("clickCount").textContent = state.clicks;
  $("productCount").textContent = state.products.length;
  const grid = $("productGrid");
  grid.replaceChildren();
  state.products.forEach(product => {
    const card = document.createElement("article");
    card.className = "product-card";
    const label = document.createElement("span"); label.className="product-label"; label.textContent=product.sample?"Sample — replace link":"Your affiliate link";
    const title = document.createElement("h3"); title.textContent=product.name;
    const desc = document.createElement("p"); desc.textContent=product.sample?"This is a placeholder. Add a real approved affiliate URL before sharing.":"Click to open the product destination. Commission tracking is handled by the affiliate provider.";
    const open = document.createElement("button"); open.className="secondary-button"; open.textContent="Open product link →";
    open.addEventListener("click",()=>{
      if(product.sample || !safeUrl(product.url) || product.url.includes("example.com")){
        alert("This is a sample link. Edit or remove it and add your approved affiliate URL first."); return;
      }
      state.clicks += 1; save(); render();
      window.open(safeUrl(product.url),"_blank","noopener,noreferrer");
    });
    const remove = document.createElement("button"); remove.className="remove"; remove.textContent="Remove";
    remove.addEventListener("click",()=>{ if(confirm("Remove this product from your list?")){state.products=state.products.filter(p=>p.id!==product.id);save();render();} });
    card.append(label,title,desc,open,remove); grid.append(card);
  });
  const url = new URL(window.location.href); url.hash="products"; $("shareUrl").value=url.href;
}
$("productForm").addEventListener("submit",event=>{
  event.preventDefault();
  const name=$("productName").value.trim(), url=safeUrl($("productUrl").value.trim());
  if(!name || !url){alert("Enter a product name and a valid http or https URL.");return;}
  state.products.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,url,sample:false});
  save(); $("productForm").reset(); render();
});
$("copyShare").addEventListener("click",async()=>{
  try { await navigator.clipboard.writeText($("shareUrl").value); $("copyStatus").textContent="Link copied."; }
  catch { $("shareUrl").select(); $("copyStatus").textContent="Select and copy the link manually."; }
});
$("menuButton").addEventListener("click",()=>{
  const nav=$("nav"), open=nav.classList.toggle("open");
  $("menuButton").setAttribute("aria-expanded",String(open));
});
$("nav").querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{$("nav").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");}));
$("year").textContent=new Date().getFullYear();
render();

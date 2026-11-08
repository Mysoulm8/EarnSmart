import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = (id) => document.getElementById(id);
const config = window;
const SUPABASE_URL = config.EARNSMART_SUPABASE_URL;
const SUPABASE_KEY = config.EARNSMART_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY.startsWith("sb_publishable_") && !SUPABASE_KEY.includes("PASTE_YOUR"));
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let currentUser = null;
let products = [];

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
const message = (text, isError = false) => {
  $("authMessage").textContent = text;
  $("authMessage").style.color = isError ? "#b42318" : "";
};
const setSignedIn = (user) => {
  currentUser = user;
  $("authForms").hidden = Boolean(user);
  $("signedInPanel").hidden = !user;
  $("authStatus").textContent = user ? `Signed in: ${user.email}` : "Not signed in";
  $("welcomeText").textContent = user ? `Welcome${user.user_metadata?.display_name ? ", " + user.user_metadata.display_name : ""}! Your products are saved to your account.` : "";
  $("dataStatus").textContent = user ? "Cloud database connected" : "Sign in to load cloud data";
  $("productForm").querySelector("button").disabled = !user;
  if (!user) {
    products = [];
    render();
  }
};
function render() {
  $("clickCount").textContent = $("clickCount").dataset.count || "0";
  $("productCount").textContent = String(products.length);
  const grid = $("productGrid");
  grid.replaceChildren();
  if (!currentUser) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Sign in to load your private products.";
    grid.append(p);
    return;
  }
  if (!products.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No products yet. Add your first approved affiliate link below.";
    grid.append(p);
    return;
  }
  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";
    const label = document.createElement("span");
    label.className = "product-label";
    label.textContent = "Your affiliate link";
    const title = document.createElement("h3");
    title.textContent = product.name;
    const desc = document.createElement("p");
    desc.textContent = product.description || "Commission tracking and purchases are confirmed by the affiliate provider.";
    const open = document.createElement("button");
    open.className = "secondary-button";
    open.textContent = "Open product link →";
    open.addEventListener("click", async () => {
      const url = safeUrl(product.destination_url);
      if (!url) { message("This product URL is invalid.", true); return; }
      const tab = window.open("about:blank", "_blank");
      try {
        const { error } = await supabase.from("click_events").insert({
          user_id: currentUser.id,
          product_id: product.id
        });
        if (error) throw error;
        await loadStats();
      } catch (error) {
        if (tab) tab.close();
        message(`Could not record this click: ${error.message}`, true);
        return;
      }
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      if (!confirm(`Remove "${product.name}"?`)) return;
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) { message(error.message, true); return; }
      await loadProducts();
      message("Product removed.");
    });
    card.append(label, title, desc, open, remove);
    grid.append(card);
  }
}
async function loadProducts() {
  if (!currentUser) return;
  const { data, error } = await supabase.from("products")
    .select("id,name,destination_url,description,is_active,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });
  if (error) { message(`Could not load products: ${error.message}`, true); return; }
  products = data || [];
  render();
}
async function loadStats() {
  if (!currentUser) return;
  const [productResult, clickResult] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", currentUser.id),
    supabase.from("click_events").select("id", { count: "exact", head: true }).eq("user_id", currentUser.id)
  ]);
  if (productResult.error || clickResult.error) {
    message(`Could not load activity: ${(productResult.error || clickResult.error).message}`, true);
    return;
  }
  $("productCount").textContent = String(productResult.count ?? 0);
  $("clickCount").dataset.count = String(clickResult.count ?? 0);
  $("clickCount").textContent = String(clickResult.count ?? 0);
}
async function refreshAccount(user) {
  setSignedIn(user);
  if (user) {
    await Promise.all([loadProducts(), loadStats()]);
  }
}

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  const display_name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  if (password.length < 8) { message("Use a password with at least 8 characters.", true); return; }
  message("Creating your account…");
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { display_name } }
  });
  if (error) { message(error.message, true); return; }
  if (data.session) {
    await refreshAccount(data.user);
    message("Account created and signed in.");
  } else {
    message("Registration received. Check your email for the confirmation link, then sign in.");
  }
  $("signupForm").reset();
});
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  message("Signing in…");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });
  if (error) { message(error.message, true); return; }
  await refreshAccount(data.user);
  message("You're signed in.");
  $("loginForm").reset();
});
$("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { message(error.message, true); return; }
  setSignedIn(null);
  $("clickCount").dataset.count = "0";
  $("clickCount").textContent = "0";
  message("You have signed out.");
});
$("productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) { message("Please sign in before adding a product.", true); return; }
  const name = $("productName").value.trim();
  const destination_url = safeUrl($("productUrl").value.trim());
  const description = $("productDescription").value.trim();
  if (!name || !destination_url) { message("Enter a product name and a valid HTTPS or HTTP URL.", true); return; }
  if (new URL(destination_url).protocol !== "https:") {
    message("For safety, affiliate destination links must use HTTPS.", true); return;
  }
  const { error } = await supabase.from("products").insert({
    user_id: currentUser.id, name, destination_url, description
  });
  if (error) { message(error.message, true); return; }
  $("productForm").reset();
  await Promise.all([loadProducts(), loadStats()]);
  message("Product saved to your account.");
});
$("copyShare").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href.split("#")[0]);
    $("copyStatus").textContent = "Website link copied.";
  } catch {
    $("shareUrl").select();
    $("copyStatus").textContent = "Select and copy the link manually.";
  }
});
$("shareUrl").value = window.location.href.split("#")[0];
$("menuButton").addEventListener("click", () => {
  const nav = $("nav"), open = nav.classList.toggle("open");
  $("menuButton").setAttribute("aria-expanded", String(open));
});
$("nav").querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
  $("nav").classList.remove("open");
  $("menuButton").setAttribute("aria-expanded", "false");
}));
$("year").textContent = new Date().getFullYear();

if (!configured) {
  message("Setup required: add your Supabase sb_publishable_ key to config.js, then reload this page.", true);
  $("productForm").querySelector("button").disabled = true;
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    // Defer database calls to avoid running Supabase queries inside the auth callback.
    setTimeout(() => refreshAccount(session?.user ?? null), 0);
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) message(error.message, true);
    refreshAccount(data.session?.user ?? null);
  });
}

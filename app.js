
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.EARNSMART_SUPABASE_URL;
const SUPABASE_KEY = window.EARNSMART_SUPABASE_PUBLISHABLE_KEY;

const configured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_KEY.startsWith("sb_publishable_")
);

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let currentUser = null;
let products = [];
let listings = [];
let affiliateCommissions = [];
let marketplaceCommissions = [];
let payoutRequests = [];

function showMessage(text, isError = false) {
  $("appMessage").textContent = text;
  $("appMessage").style.color = isError ? "#c43b43" : "#168451";
}

function authMessage(text, isError = false) {
  $("authMessage").textContent = text;
  $("authMessage").style.color = isError ? "#c43b43" : "";
}

function setVisible(id, visible) {
  $(id).classList.toggle("hidden", !visible);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function emptyMessage(container, text) {
  container.replaceChildren(makeElement("p", "empty-state", text));
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  if (pageId === "marketplacePage") loadListings();
  if (pageId === "commissionsPage") loadCommissions();
  if (pageId === "payoutsPage") loadPayouts();
  if (pageId === "adminPage") showMessage("Admin data requires verified administrator access.");
}

function navigateSetup() {
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.go));
  });

  $("currentYear").textContent = new Date().getFullYear();

  $("showLoginBtn").addEventListener("click", () => {
    setVisible("loginForm", true);
    setVisible("signupForm", false);
    $("showLoginBtn").classList.add("active");
    $("showSignupBtn").classList.remove("active");
  });

  $("showSignupBtn").addEventListener("click", () => {
    setVisible("loginForm", false);
    setVisible("signupForm", true);
    $("showSignupBtn").classList.add("active");
    $("showLoginBtn").classList.remove("active");
  });
}

function setSignedIn(user) {
  currentUser = user;

  setVisible("authSection", !user);
  setVisible("appSection", Boolean(user));
  setVisible("logoutBtn", Boolean(user));

  $("userEmail").textContent = user ? user.email : "";

  if (!user) {
    products = [];
    listings = [];
    affiliateCommissions = [];
    marketplaceCommissions = [];
    payoutRequests = [];
    renderProducts();
    renderDashboard();
    return;
  }
}

async function loadProducts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("products")
    .select("id,name,destination_url,description,is_active,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage("Could not load affiliate products: " + error.message, true);
    return;
  }

  products = data || [];
  renderProducts();
  renderDashboard();
}

function renderProducts() {
  const container = $("productList");
  container.replaceChildren();

  if (!currentUser || !products.length) {
    emptyMessage(container, "No affiliate products found.");
    return;
  }

  products.forEach(product => {
    const card = makeElement("article", "product-card");
    const title = makeElement("h3", "", product.name);
    const description = makeElement(
      "p",
      "",
      product.description || "Your affiliate product"
    );

    const open = makeElement("button", "button secondary", "Open product link");
    open.type = "button";

    open.addEventListener("click", async () => {
      const url = safeUrl(product.destination_url);

      if (!url || new URL(url).protocol !== "https:") {
        showMessage("Invalid or unsafe product link.", true);
        return;
      }

      const tab = window.open("about:blank", "_blank");

      const { error } = await supabase.from("click_events").insert({
        user_id: currentUser.id,
        product_id: product.id
      });

      if (error) {
        if (tab) tab.close();
        showMessage("Click could not be recorded: " + error.message, true);
        return;
      }

      if (tab) {
        tab.location.href = url;
      } else {
        window.location.href = url;
      }

      await loadStats();
    });

    const remove = makeElement("button", "button secondary", "Remove");
    remove.type = "button";

    remove.addEventListener("click", async () => {
      if (!confirm("Remove this product?")) return;

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("user_id", currentUser.id);

      if (error) {
        showMessage(error.message, true);
        return;
      }

      await loadProducts();
      showMessage("Product removed.");
    });

    card.append(title, description, open, remove);
    container.append(card);
  });
}

async function loadStats() {
  if (!currentUser) return;

  const [productResult, clickResult] = await Promise.all([
    supabase.from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id),

    supabase.from("click_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
  ]);

  if (productResult.error || clickResult.error) {
    showMessage("Could not load statistics.", true);
    return;
  }

  $("affiliateProductCount").textContent = productResult.count ?? 0;
  $("totalClicks").textContent = clickResult.count ?? 0;
}

async function loadDashboardEarnings() {
  if (!currentUser) return;

  $("affiliateEarnings").textContent = "Unavailable";
  $("marketplaceEarnings").textContent = "Unavailable";

  // Earnings are intentionally not calculated from unverified browser input.
  // We will connect verified commission records after confirming the database schema.
}

function renderDashboard() {
  $("affiliateProductCount").textContent = products.length;
}

async function loadListings() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    emptyMessage($("marketplaceList"), "Could not load marketplace listings: " + error.message);
    return;
  }

  listings = data || [];
  renderListings();
}

function renderListings() {
  const container = $("marketplaceList");
  container.replaceChildren();

  if (!listings.length) {
    emptyMessage(container, "No marketplace products available yet.");
    return;
  }

  listings.forEach(item => {
    const card = makeElement("article", "content-card");
    const title = makeElement("h3", "", item.name || item.title || "Marketplace product");
    const description = makeElement("p", "", item.description || "Marketplace listing");
    const price = makeElement("p", "", "Price: " + money(item.price));

    card.append(title, description, price);

    const status = makeElement("p", "small-note",
      "Promotional links will be enabled after marketplace referral tracking is configured."
    );
    card.append(status);
    container.append(card);
  });
}

async function loadCommissions() {
  if (!currentUser) return;

  // Read-only commission display. Actual commission records must be verified
  // by a trusted server or administrator, not created by ordinary users.

  const affiliateResult = await supabase
    .from("affiliate_commissions")
    .select("*")
    .order("created_at", { ascending: false });

  const marketplaceResult = await supabase
    .from("marketplace_commissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (affiliateResult.error) {
    emptyMessage($("affiliateCommissionList"), "Could not load affiliate commissions.");
  } else {
    affiliateCommissions = affiliateResult.data || [];
    renderRecords(
      $("affiliateCommissionList"),
      affiliateCommissions,
      "No affiliate commission records."
    );
  }

  if (marketplaceResult.error) {
    emptyMessage($("marketplaceCommissionList"), "Could not load marketplace commissions.");
  } else {
    marketplaceCommissions = marketplaceResult.data || [];
    renderRecords(
      $("marketplaceCommissionList"),
      marketplaceCommissions,
      "No marketplace commission records."
    );
  }

  await loadDashboardEarnings();
}

function renderRecords(container, records, emptyText) {
  container.replaceChildren();

  if (!records.length) {
    emptyMessage(container, emptyText);
    return;
  }

  records.forEach(record => {
    const item = makeElement("article", "content-card");
    const amount = makeElement("strong", "", money(record.commission_amount));
    const status = makeElement("p", "", "Status: " + (record.status || "Pending"));
    item.append(amount, status);
    container.append(item);
  });
}

async function loadPayouts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    emptyMessage($("payoutList"), "Could not load payout history.");
    return;
  }

  payoutRequests = data || [];
  renderRecords(
    $("payoutList"),
    payoutRequests.map(item => ({
      ...item,
      commission_amount: item.amount,
      status: item.status
    })),
    "No payout requests yet."
  );
}

// Authentication

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabase) return;

  const displayName = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (password.length < 8) {
    authMessage("Password must contain at least 8 characters.", true);
    return;
  }

  authMessage("Creating account...");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });

  if (error) {
    authMessage(error.message, true);
    return;
  }

  $("signupForm").reset();

  if (data.session) {
    await refreshAccount(data.user);
    authMessage("Account created successfully.");
  } else {
    authMessage("Check your email to confirm your account.");
  }
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabase) return;

  authMessage("Signing in...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });

  if (error) {
    authMessage(error.message, true);
    return;
  }

  $("loginForm").reset();
  await refreshAccount(data.user);
  authMessage("Welcome back!");
});

$("logoutBtn").addEventListener("click", async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage(error.message, true);
    return;
  }

  setSignedIn(null);
  authMessage("You have signed out.");
});

async function refreshAccount(user) {
  setSignedIn(user);

  if (!user) return;

  await Promise.all([
    loadProducts(),
    loadStats()
  ]);
}

// Add personal affiliate product

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const name = $("productName").value.trim();
  const url = safeUrl($("productUrl").value.trim());

  if (!name || !url || new URL(url).protocol !== "https:") {
    $("productMessage").textContent = "Enter a product name and valid HTTPS link.";
    return;
  }

  // Existing products table structure is retained.
  // No unverified commission values are created here.

  const { error } = await supabase.from("products").insert({
    user_id: currentUser.id,
    name,
    destination_url: url
  });

  if (error) {
    $("productMessage").textContent = error.message;
    return;
  }

  $("productForm").reset();
  $("productMessage").textContent = "Product saved successfully.";

  await loadProducts();
  await loadStats();
});

// Submit marketplace listing

$("listingForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const name = $("listingName").value.trim();
  const description = $("listingDescription").value.trim();
  const price = Number($("listingPrice").value);
  const commission = Number($("listingCommission").value);

  if (!name || price <= 0 || commission < 0 || commission > price) {
    $("listingMessage").textContent = "Please check the product price and commission.";
    return;
  }

  // Listing submission is not allowed until we confirm the actual
  // marketplace_listings columns and seller approval rules.
  $("listingMessage").textContent =
    "Listing submission will be enabled after the marketplace database is verified.";
});

// Payout request

$("payoutForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  $("payoutMessage").textContent =
    "Payout submission is temporarily disabled until eligible balances and secure payout rules are configured.";
});

// Initialization

navigateSetup();

if (!configured) {
  authMessage("Supabase configuration is missing. Please check config.js.");
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => refreshAccount(session?.user ?? null), 0);
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      authMessage(error.message, true);
      return;
    }

    refreshAccount(data.session?.user ?? null);
  });
}

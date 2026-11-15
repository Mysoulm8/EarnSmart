
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// EARNSMART V3 - APPLICATION
// =====================================================

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

// =====================================================
// GENERAL HELPERS
// =====================================================

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

    if (url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function emptyMessage(container, text) {
  container.replaceChildren(
    makeElement("p", "empty-state", text)
  );
}

// =====================================================
// NAVIGATION
// =====================================================

function showPage(pageName) {
  const pageId = pageName.endsWith("Page")
    ? pageName
    : `${pageName}Page`;

  document.querySelectorAll(".app-page").forEach(page => {
    page.classList.toggle("hidden", page.id !== pageId);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    const buttonPage = button.dataset.page;

    button.classList.toggle(
      "active",
      buttonPage === pageName ||
      buttonPage === pageId
    );
  });

  if (pageId === "marketplacePage") {
    loadListings();
  }

  if (pageId === "commissionsPage") {
    loadCommissions();
  }

  if (pageId === "payoutsPage") {
    loadPayouts();
  }

  if (pageId === "adminPage") {
    showMessage(
      "Admin data requires verified administrator access."
    );
  }
}

function navigateSetup() {
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
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

// =====================================================
// ACCOUNT DISPLAY
// =====================================================

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

    showPage("dashboard");
  }
}

// =====================================================
// AFFILIATE PRODUCTS
// =====================================================

async function loadProducts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,destination_url,description,is_active,created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(
      "Could not load affiliate products: " + error.message,
      true
    );
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
    const card = makeElement("article", "content-card");

    const title = makeElement("h3", "", product.name);

    const description = makeElement(
      "p",
      "",
      product.description || "Your affiliate product"
    );

    const open = makeElement(
      "button",
      "button secondary",
      "Open product link"
    );

    open.type = "button";

    open.addEventListener("click", async () => {
      const url = safeUrl(product.destination_url);

      if (!url) {
        showMessage("Invalid or unsafe product link.", true);
        return;
      }

      const tab = window.open("about:blank", "_blank");

      try {
        const { error } = await supabase
          .from("click_events")
          .insert({
            user_id: currentUser.id,
            product_id: product.id
          });

        if (error) {
          if (tab) tab.close();

          showMessage(
            "Click could not be recorded: " + error.message,
            true
          );
          return;
        }

        if (tab) {
          tab.location.href = url;
        } else {
          window.location.href = url;
        }

        await loadStats();

      } catch (error) {
        if (tab) tab.close();

        showMessage(error.message, true);
      }
    });

    const remove = makeElement(
      "button",
      "button secondary",
      "Remove"
    );

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

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

async function loadStats() {
  if (!currentUser) return;

  const [productResult, clickResult] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id),

    supabase
      .from("click_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
  ]);

  if (productResult.error || clickResult.error) {
    showMessage("Could not load statistics.", true);
    return;
  }

  $("affiliateProductCount").textContent =
    productResult.count ?? 0;

  $("totalClicks").textContent =
    clickResult.count ?? 0;
}

function renderDashboard() {
  $("affiliateProductCount").textContent =
    products.length;
}

async function loadDashboardEarnings() {
  if (!currentUser) return;

  $("affiliateEarnings").textContent = "Unavailable";
  $("marketplaceEarnings").textContent = "Unavailable";

  // Earnings will be connected to verified commission records
  // after database columns and access policies are checked.
}

// =====================================================
// MARKETPLACE
// =====================================================

async function loadListings() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    emptyMessage(
      $("marketplaceList"),
      "Could not load marketplace listings: " + error.message
    );
    return;
  }

  listings = data || [];

  renderListings();
}

function renderListings() {
  const container = $("marketplaceList");

  container.replaceChildren();

  if (!listings.length) {
    emptyMessage(
      container,
      "No marketplace products available yet."
    );
    return;
  }

  listings.forEach(item => {
    const card = makeElement("article", "content-card");

    const title = makeElement(
      "h3",
      "",
      item.name || item.title || "Marketplace product"
    );

    const description = makeElement(
      "p",
      "",
      item.description || "Marketplace listing"
    );

    const price = makeElement(
      "p",
      "",
      "Price: " + money(item.price)
    );

    const note = makeElement(
      "p",
      "small-note",
      "Referral links will be enabled after marketplace tracking is configured."
    );

    card.append(title, description, price, note);

    container.append(card);
  });
}

// =====================================================
// COMMISSIONS
// =====================================================

async function loadCommissions() {
  if (!currentUser) return;

  // These queries are read-only.
  // Commission records must be verified by a trusted
  // server-side process or authorized administrator.

  const affiliateResult = await supabase
    .from("affiliate_commissions")
    .select("*")
    .order("created_at", { ascending: false });

  const marketplaceResult = await supabase
    .from("marketplace_commissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (affiliateResult.error) {
    emptyMessage(
      $("affiliateCommissionList"),
      "Could not load affiliate commissions."
    );
  } else {
    affiliateCommissions = affiliateResult.data || [];

    renderRecords(
      $("affiliateCommissionList"),
      affiliateCommissions,
      "No affiliate commission records."
    );
  }

  if (marketplaceResult.error) {
    emptyMessage(
      $("marketplaceCommissionList"),
      "Could not load marketplace commissions."
    );
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

    const amount = makeElement(
      "strong",
      "",
      money(
        record.commission_amount ??
        record.amount ??
        0
      )
    );

    const status = makeElement(
      "p",
      "",
      "Status: " + (record.status || "Pending")
    );

    item.append(amount, status);

    container.append(item);
  });
}

// =====================================================
// PAYOUT HISTORY
// =====================================================

async function loadPayouts() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    emptyMessage(
      $("payoutList"),
      "Could not load payout history."
    );
    return;
  }

  payoutRequests = data || [];

  renderRecords(
    $("payoutList"),
    payoutRequests,
    "No payout requests yet."
  );
}

// =====================================================
// REGISTRATION
// =====================================================

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabase) {
    authMessage("Supabase configuration is missing.", true);
    return;
  }

  const displayName = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (password.length < 8) {
    authMessage(
      "Password must contain at least 8 characters.",
      true
    );
    return;
  }

  authMessage("Creating account...");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
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
    authMessage(
      "Check your email to confirm your account."
    );
  }
});

// =====================================================
// LOGIN
// =====================================================

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabase) {
    authMessage("Supabase configuration is missing.", true);
    return;
  }

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

// =====================================================
// LOGOUT
// =====================================================

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

// =====================================================
// REFRESH ACCOUNT
// =====================================================

async function refreshAccount(user) {
  setSignedIn(user);

  if (!user) return;

  await Promise.all([
    loadProducts(),
    loadStats()
  ]);
}

// =====================================================
// ADD AFFILIATE PRODUCT
// =====================================================

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    $("productMessage").textContent =
      "Please log in first.";
    return;
  }

  const name = $("productName").value.trim();
  const url = safeUrl($("productUrl").value.trim());
  const enteredPrice = $("productPrice").value.trim();

  if (!name || !url) {
    $("productMessage").textContent =
      "Enter a product name and valid HTTPS link.";
    return;
  }

  if (
    enteredPrice &&
    (!Number.isFinite(Number(enteredPrice)) ||
      Number(enteredPrice) < 0)
  ) {
    $("productMessage").textContent =
      "Please enter a valid product price.";
    return;
  }

  // Price is not saved yet because the products table's
  // price column has not been verified.
  // Do not guess database column names.

  const { error } = await supabase
    .from("products")
    .insert({
      user_id: currentUser.id,
      name,
      destination_url: url
    });

  if (error) {
    $("productMessage").textContent = error.message;
    return;
  }

  $("productForm").reset();

  $("productMessage").textContent = enteredPrice
    ? "Product saved. Price storage will be enabled after database verification."
    : "Product saved successfully.";

  await loadProducts();
  await loadStats();
});

// =====================================================
// MARKETPLACE LISTING SUBMISSION
// =====================================================

$("listingForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    $("listingMessage").textContent =
      "Please log in first.";
    return;
  }

  $("listingMessage").textContent =
    "Listing submission is not enabled yet. We must verify the marketplace database columns and seller approval rules first.";
});

// =====================================================
// PAYOUT REQUEST
// =====================================================

$("payoutForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    $("payoutMessage").textContent =
      "Please log in first.";
    return;
  }

  $("payoutMessage").textContent =
    "Payout submission is temporarily disabled until eligible balances and secure payout rules are verified.";
});

// =====================================================
// INITIALIZATION
// =====================================================

navigateSetup();

if (!configured) {
  authMessage(
    "Supabase configuration is missing. Please check config.js.",
    true
  );
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      refreshAccount(session?.user ?? null);
    }, 0);
  });

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      authMessage(error.message, true);
      return;
    }

    refreshAccount(data.session?.user ?? null);
  });
}

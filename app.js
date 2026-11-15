
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================================
// EARNSMART V3 - APPLICATION
// =====================================================

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.EARNSMART_SUPABASE_URL;
// EarnSmart short referral link redirect
const shortReferralCode =
  new URLSearchParams(window.location.search).get("go");

if (shortReferralCode) {
  window.location.replace(
    `${SUPABASE_URL}/functions/v1/open-marketplace-referral?ref=${encodeURIComponent(shortReferralCode)}`
  );
}
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
  const message = $("appMessage");

  message.textContent = text;
  message.style.color = isError ? "#c43b43" : "#168451";
  message.classList.remove("hidden");

  message.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    if (message.textContent === text) {
      message.textContent = "";
    }
  }, 3000);
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
      item.name || "Marketplace product"
    );

    const description = makeElement(
      "p",
      "",
      item.description || "Marketplace listing"
    );

    const note = makeElement(
      "p",
      "small-note",
      "Share your unique referral link with customers."
    );

    const createButton = makeElement(
      "button",
      "button primary",
      "Create Referral Link"
    );

    createButton.type = "button";

    createButton.addEventListener("click", async () => {
      createButton.disabled = true;
      createButton.textContent = "Creating...";

      try {
        const { data, error } = await supabase.functions.invoke(
          "create-marketplace-referral",
          {
            body: {
              listing_id: item.id
            }
          }
        );

        if (error) {
          throw error;
        }

        if (!data || !data.success || !data.referral_url) {
          throw new Error(
            data?.error || "Could not create referral link."
          );
        }

        const result = makeElement(
          "p",
          "small-note",
          "Your referral link is ready:"
        );

        const linkInput = document.createElement("input");
        linkInput.type = "text";
        linkInput.readOnly = true;
        linkInput.value = data.referral_url;
        linkInput.style.width = "100%";

        const copyButton = makeElement(
          "button",
          "button secondary",
          "Copy Referral Link"
        );

        copyButton.type = "button";

        copyButton.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(
              data.referral_url
            );
            copyButton.textContent = "Copied!";
          } catch {
            linkInput.select();
            document.execCommand("copy");
            copyButton.textContent = "Copied!";
          }
        });

        card.append(result, linkInput, copyButton);

        createButton.textContent = "Referral Created";

      } catch (error) {
        console.error("Referral creation error:", error);

if (error.context) {
  try {
    console.error("Server response:", await error.context.json());
  } catch (e) {
    console.error("Could not read server response:", e);
  }
}

        let details = error.message || "Please try again.";

if (error.context) {
  try {
    details = await error.context.text();
  } catch (e) {
    console.error("Could not read error details:", e);
  }
}

showMessage("Referral error: " + details, true);

        createButton.disabled = false;
        createButton.textContent = "Try Again";
      }
    });

    card.append(
      title,
      description,
      note,
      createButton
    );

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
await loadPromoterDashboard();
}

async function loadPromoterDashboard() {
  if (!currentUser) return;

  const list = $("promoterReferralList");

  const { data: referrals, error } = await supabase
    .from("marketplace_referrals")
    .select("id, referral_code, listing_id, created_at, is_active")
    .eq("promoter_id", currentUser.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    emptyMessage(list, "Could not load referral links.");
    return;
  }
console.log("Promoter dashboard user:", currentUser.id);
console.log("Promoter dashboard referrals:", { referrals, error });
  const myReferrals = referrals || [];

  $("promoterReferralCount").textContent = myReferrals.length;

  if (myReferrals.length === 0) {
    $("promoterClickCount").textContent = "0";
    emptyMessage(list, "You have no referral links yet.");
    return;
  }

  const referralIds = myReferrals.map(item => item.id);
  const listingIds = [...new Set(myReferrals.map(item => item.listing_id))];

  const [clickResult, listingResult] = await Promise.all([
    supabase
      .from("marketplace_click_events")
      .select("referral_id")
      .in("referral_id", referralIds),

    supabase
      .from("marketplace_listings")
      .select("id, name")
      .in("id", listingIds)
  ]);

  if (clickResult.error || listingResult.error) {
    emptyMessage(list, "Could not load referral details.");
    return;
  }

  const clicks = clickResult.data || [];
  const listingRows = listingResult.data || [];

  const listingNames = {};
  listingRows.forEach(item => {
    listingNames[item.id] = item.name;
  });

  const clickCounts = {};
  clicks.forEach(item => {
    clickCounts[item.referral_id] =
      (clickCounts[item.referral_id] || 0) + 1;
  });

  $("promoterClickCount").textContent = clicks.length;

  list.replaceChildren();

  myReferrals.forEach(referral => {
    const card = document.createElement("div");
    card.className = "data-item";

    const name = document.createElement("strong");
    name.textContent =
      listingNames[referral.listing_id] || "Marketplace listing";

    const count = document.createElement("p");
    count.textContent =
      "Clicks: " + (clickCounts[referral.id] || 0);

    const url =
      `https://mysoulm8.github.io/EarnSmart/?go=${referral.referral_code}`;

    const link = document.createElement("input");
    link.type = "text";
    link.value = url;
    link.readOnly = true;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy Referral Link";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        showMessage("Referral link copied!");
      } catch {
        link.select();
        showMessage("Select and copy the referral link.", true);
      }
    });

    card.append(name, count, link, copyButton);
    list.appendChild(card);
  });

  const totalEarnings = (marketplaceCommissions || [])
    .reduce((sum, item) => sum + Number(item.promoter_earnings || 0), 0);

  $("promoterEarnings").textContent = money(totalEarnings);
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
    $("listingMessage").textContent = "Please log in first.";
    return;
  }

  const name = $("listingName").value.trim();
  const description = $("listingDescription").value.trim();
  const affiliateUrl = safeUrl(
    $("listingAffiliateUrl").value.trim()
  );

  if (!name || !affiliateUrl) {
    $("listingMessage").textContent =
      "Enter a product name and valid HTTPS Shopee affiliate URL.";
    return;
  }

  const hostname = new URL(affiliateUrl).hostname.toLowerCase();

const allowedHosts = [
  "shopee.ph",
  "collshp.com"
];

if (!allowedHosts.includes(hostname) &&
    !hostname.endsWith(".shopee.ph")) {
  $("listingMessage").textContent =
    "Please enter a valid Shopee or Collshp affiliate link.";
  return;
}

  $("listingMessage").textContent = "Submitting listing...";

  const { error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: currentUser.id,
      name,
      affiliate_url: affiliateUrl,
      description,
      is_active: true
    });

  if (error) {
    $("listingMessage").textContent =
      "Could not submit listing: " + error.message;
    return;
  }

  $("listingForm").reset();

  $("listingMessage").textContent =
    "Your marketplace product was submitted successfully!";

  await loadListings();
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

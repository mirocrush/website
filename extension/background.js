const TARGET_URL_PATTERN = "https://dev--idc5pwg.us.auth0.com/";
const PROTON_URL = "https://mail.proton.me";
const STARTUP_DELAY_MS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, timeoutMs);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Script 1: fill username and click Continue (auth0 page 1) ─────────────────
function fillUsername(email) {
  function waitForElement(selector, timeout = 10000) {
    return new Promise((res, rej) => {
      const el = document.querySelector(selector);
      if (el) return res(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); res(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); rej(new Error("Timeout: " + selector)); }, timeout);
    });
  }

  return (async () => {
    const usernameInput = await waitForElement('input[name="username"][id="username"]');
    usernameInput.focus();
    usernameInput.value = email;
    usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
    usernameInput.dispatchEvent(new Event("change", { bubbles: true }));

    const continueBtn = await waitForElement(
      'button[type="submit"][name="action"][value="default"]'
    );
    continueBtn.click();
  })();
}

// ── Mouse tracker: injected once after page load ──────────────────────────────
// Listens to mousemove and writes throttled (x, y) to chrome.storage.local
// so the popup can display the live cursor position.
function injectMouseTracker() {
  if (window.__alpMouseTrackerInjected) return;
  window.__alpMouseTrackerInjected = true;

  let lastWrite = 0;
  document.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastWrite < 100) return; // throttle: max 10 writes/sec
    lastWrite = now;
    chrome.storage.local.set({ mousePos: { x: e.clientX, y: e.clientY } });
  });
}

// ── Script 2: click at a configurable (x, y) coordinate ──────────────────────
function clickProtonEmail(x, y) {

  // Show a red dot at the click point
  const dot = document.createElement("div");
  dot.style.cssText = `
    position:fixed; z-index:2147483647; pointer-events:none;
    width:16px; height:16px; border-radius:50%;
    background:red; border:2px solid darkred;
    left:${x - 8}px; top:${y - 8}px;
  `;
  document.documentElement.appendChild(dot);

  const el = document.elementFromPoint(x, y);
  const classes = el ? (el.className || "") : "";

  // Fire a real mouse click immediately (10s wait already done in background)
  const evt = new MouseEvent("click", {
    bubbles: true, cancelable: true,
    clientX: x, clientY: y,
    view: window,
  });
  if (el) el.dispatchEvent(evt);

  dot.style.background = "green";
  setTimeout(() => dot.remove(), 1000);

  return { found: !!el, method: "coordinate", classes, count: el ? 1 : 0 };
}

// ── Script 3: extract verification code from iframe inside email ───────────────
// Steps:
//   1. Find the LAST div.message-content in the main document
//   2. Inside it, find the <iframe>
//   3. Access iframe.contentDocument and find div#proton-root
//   4. Search all <p> elements for one containing "Your verification code is:"
//   5. Return the text of its <b> child
// Fallback: if div.message-content not found, use elementFromPoint to get container.
// Returns { content, code }
function extractCodeFromEmail(fallbackX, fallbackY) {
  function highlight(el, color) {
    el.style.setProperty("outline", `2px solid ${color}`, "important");
    setTimeout(() => el.style.removeProperty("outline"), 3000);
  }

  // ── Step 1: find the message-content container ──────────────────────────────
  let container = null;
  const allContainers = document.querySelectorAll("div.message-content");
  if (allContainers.length > 0) {
    container = allContainers[allContainers.length - 1];
  } else {
    // Fallback: walk up from the coordinate
    let el = document.elementFromPoint(fallbackX, fallbackY);
    while (el && el.tagName !== "DIV") el = el.parentElement;
    container = el || null;
  }

  if (!container) return { content: null, code: null };
  highlight(container, "orange");

  // ── Step 2: find the iframe inside the container ────────────────────────────
  const iframe = container.querySelector("iframe");
  if (!iframe) return { content: container.innerText.trim(), code: null };

  // ── Step 3: access iframe document and find #proton-root ────────────────────
  let iframeDoc = null;
  try {
    iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  } catch (e) {
    return { content: container.innerText.trim(), code: null };
  }
  if (!iframeDoc) return { content: container.innerText.trim(), code: null };

  const protonRoot = iframeDoc.getElementById("proton-root") || iframeDoc.body;
  if (!protonRoot) return { content: container.innerText.trim(), code: null };

  highlight(protonRoot, "blue");

  // ── Step 4: find <p> containing "Your verification code is:" ────────────────
  const allP = Array.from(protonRoot.querySelectorAll("p"));
  const codeP = allP.find((p) => p.textContent.includes("Your verification code is:"));

  const content = protonRoot.innerText.trim();

  if (!codeP) return { content, code: null };

  highlight(codeP, "green");

  // ── Step 5: get the <b> value ────────────────────────────────────────────────
  const bold = codeP.querySelector("b");
  const code = bold ? bold.textContent.trim() : null;

  return { content, code };
}

// ── Script 4: fill code input and click Continue (auth0 page 2) ──────────────
function fillCode(code) {
  function waitForElement(selector, timeout = 15000) {
    return new Promise((res, rej) => {
      const el = document.querySelector(selector);
      if (el) return res(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); res(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); rej(new Error("Timeout: " + selector)); }, timeout);
    });
  }

  return (async () => {
    const codeInput = await waitForElement('input[name="code"][id="code"][type="text"]');
    codeInput.focus();
    codeInput.value = code;
    codeInput.dispatchEvent(new Event("input", { bubbles: true }));
    codeInput.dispatchEvent(new Event("change", { bubbles: true }));

    const submitBtn = await waitForElement(
      'button[type="submit"][name="action"][value="default"]'
    );
    submitBtn.click();
  })();
}

// ── ProtonMail single attempt ─────────────────────────────────────────────────
// Opens (or reuses) a ProtonMail tab, reloads it, clicks the email row,
// extracts the code. Returns the code string or null on failure.
// protonTabRef is an object { id } so the tab can be reused across retries.
async function tryGetCodeFromProtonMail(waitSeconds, clickX, clickY, dblClickDelay, dblClickX, dblClickY, protonTabRef) {
  try {
    // Open a new tab only on the first attempt; reuse on retries
    if (!protonTabRef.id) {
      const tab = await chrome.tabs.create({ url: PROTON_URL, active: true });
      protonTabRef.id = tab.id;
      await waitForTabLoad(protonTabRef.id, 30000);
    }

    // Wait the configured seconds then reload
    await sleep(waitSeconds * 1000);
    chrome.tabs.reload(protonTabRef.id);
    await waitForTabLoad(protonTabRef.id, 30000);

    // Inject mouse tracker
    await chrome.scripting.executeScript({
      target: { tabId: protonTabRef.id },
      func: injectMouseTracker,
    });

    // Wait 10 seconds after reload before clicking
    await sleep(10000);

    // Click the email row
    const clickResults = await chrome.scripting.executeScript({
      target: { tabId: protonTabRef.id },
      func: clickProtonEmail,
      args: [clickX, clickY],
    });

    const clickResult = clickResults?.[0]?.result ?? { found: false };
    await chrome.storage.local.set({
      protonSearchResult: {
        found: clickResult.found,
        method: clickResult.method,
        count: clickResult.count,
        classes: clickResult.classes,
        time: new Date().toLocaleTimeString(),
      },
    });

    if (!clickResult.found) return null;

    // Wait then extract code from iframe
    await sleep(dblClickDelay * 1000);
    const extractResults = await chrome.scripting.executeScript({
      target: { tabId: protonTabRef.id },
      func: extractCodeFromEmail,
      args: [dblClickX, dblClickY],
    });

    const extracted = extractResults?.[0]?.result ?? { content: null, code: null };
    const code = extracted.code ?? null;

    await chrome.storage.local.set({
      lastVerificationCode: {
        code: code ?? "(not found)",
        time: new Date().toLocaleTimeString(),
      },
      lastEmailContent: extracted.content ?? "(not found)",
    });

    return code;
  } catch (err) {
    console.error("[ALpA] ProtonMail attempt error:", err);
    return null;
  }
}

// ── ProtonMail retry loop ─────────────────────────────────────────────────────
// Retries indefinitely until a code is retrieved. Updates retry status in
// chrome.storage.local so the popup can display progress.
async function getCodeFromProtonMail(waitSeconds, clickX, clickY, dblClickDelay, dblClickX, dblClickY) {
  const protonTabRef = { id: null };
  let attempt = 0;

  while (true) {
    attempt++;
    const time = new Date().toLocaleTimeString();

    await chrome.storage.local.set({
      protonRetryStatus: { attempt, status: "trying", time },
    });
    console.log(`[ALpA] ProtonMail attempt #${attempt}…`);

    const code = await tryGetCodeFromProtonMail(
      waitSeconds, clickX, clickY, dblClickDelay, dblClickX, dblClickY,
      protonTabRef
    );

    if (code) {
      await chrome.storage.local.set({
        protonRetryStatus: { attempt, status: "success", time: new Date().toLocaleTimeString() },
      });
      return code;
    }

    await chrome.storage.local.set({
      protonRetryStatus: { attempt, status: "failed — retrying", time: new Date().toLocaleTimeString() },
    });
    console.warn(`[ALpA] Attempt #${attempt} failed. Retrying…`);

    // Brief pause before next attempt to avoid hammering
    await sleep(3000);
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
async function attemptAutoLogin() {
  const {
    expertEmail, autoRun,
    protonWaitSeconds,
    clickX, clickY,
    dblClickDelay, dblClickX, dblClickY,
    wrongCodeWait,
  } = await chrome.storage.sync.get([
    "expertEmail", "autoRun",
    "protonWaitSeconds",
    "clickX", "clickY",
    "dblClickDelay", "dblClickX", "dblClickY",
    "wrongCodeWait",
  ]);

  if (!autoRun || !expertEmail) return;

  const waitSeconds = protonWaitSeconds ?? 15;

  // Find the most recently accessed tab matching the auth0 URL
  const tabs = await chrome.tabs.query({});
  const matching = tabs.filter((t) => t.url && t.url.includes(TARGET_URL_PATTERN));
  if (matching.length === 0) {
    console.warn("[ALpA] No matching tab found for", TARGET_URL_PATTERN);
    return;
  }
  matching.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  const auth0Tab = matching[0];

  // Ensure the auth0 tab is fully loaded
  if (auth0Tab.status !== "complete") {
    await waitForTabLoad(auth0Tab.id);
  }

  // Set up the auth0 navigation listener BEFORE clicking Continue so we
  // cannot miss the "complete" event while ProtonMail is being processed.
  const auth0NavigatedPromise = waitForTabLoad(auth0Tab.id, 60000);

  // Step 1 — fill username and click Continue on auth0
  try {
    await chrome.scripting.executeScript({
      target: { tabId: auth0Tab.id },
      func: fillUsername,
      args: [expertEmail],
    });
  } catch (err) {
    console.error("[ALpA] Step 1 (fillUsername) failed:", err);
    return;
  }

  const codeWaitSeconds    = dblClickDelay ?? 7;
  const codeClickX         = dblClickX ?? 1130;
  const codeClickY         = dblClickY ?? 620;
  const wrongCodeWaitSecs  = wrongCodeWait ?? 6;

  // Step 2 — fetch the verification code from ProtonMail while auth0 navigates
  let code = await getCodeFromProtonMail(
    waitSeconds,
    clickX ?? 600, clickY ?? 160,
    codeWaitSeconds, codeClickX, codeClickY
  );
  if (!code) {
    console.error("[ALpA] Aborting: no verification code retrieved.");
    return;
  }
  console.log("[ALpA] Retrieved code:", code);

  // Step 3 — wait for auth0 verification screen to be ready
  await auth0NavigatedPromise.catch(() => {
    console.warn("[ALpA] auth0 navigation wait timed out — proceeding anyway");
  });

  // Step 4 — fill code + retry loop if the page doesn't close after submission
  let codeAttempt = 0;
  while (true) {
    codeAttempt++;

    await chrome.storage.local.set({
      codeSubmitStatus: {
        attempt: codeAttempt,
        code,
        status: "submitting",
        time: new Date().toLocaleTimeString(),
      },
    });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: auth0Tab.id },
        func: fillCode,
        args: [code],
      });
    } catch (err) {
      console.error("[ALpA] fillCode failed:", err);
      break;
    }

    // Wait the configured seconds, then check if the auth0 tab is still open
    await sleep(wrongCodeWaitSecs * 1000);

    const tabs = await chrome.tabs.query({ url: TARGET_URL_PATTERN + "*" });
    const stillOpen = tabs.some((t) => t.id === auth0Tab.id);

    if (!stillOpen) {
      // Tab closed or navigated away — login succeeded
      await chrome.storage.local.set({
        codeSubmitStatus: {
          attempt: codeAttempt,
          code,
          status: "success — tab closed",
          time: new Date().toLocaleTimeString(),
        },
      });
      console.log("[ALpA] Login succeeded.");
      break;
    }

    // Tab still open — wrong code. Get a fresh code and retry.
    console.warn(`[ALpA] Code attempt #${codeAttempt} failed (tab still open). Fetching new code…`);
    await chrome.storage.local.set({
      codeSubmitStatus: {
        attempt: codeAttempt,
        code,
        status: "wrong code — fetching new",
        time: new Date().toLocaleTimeString(),
      },
    });

    code = await getCodeFromProtonMail(
      waitSeconds,
      clickX ?? 600, clickY ?? 160,
      codeWaitSeconds, codeClickX, codeClickY
    );
    if (!code) {
      console.error("[ALpA] Could not retrieve new code. Aborting.");
      break;
    }
    console.log(`[ALpA] New code for attempt #${codeAttempt + 1}:`, code);
  }
}

// Trigger auto-login 10 seconds after the browser starts up
chrome.runtime.onStartup.addListener(() => {
  setTimeout(attemptAutoLogin, STARTUP_DELAY_MS);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ALpA] Extension installed/updated.");
});

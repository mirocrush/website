const emailInput      = document.getElementById("expertEmail");
const searchResultEl  = document.getElementById("searchResult");
const clearResultBtn  = document.getElementById("clearResult");
const mousePosEl          = document.getElementById("mousePos");
const verificationCodeEl  = document.getElementById("verificationCode");
const emailContentEl      = document.getElementById("emailContent");
const retryStatusEl       = document.getElementById("retryStatus");
const codeSubmitStatusEl  = document.getElementById("codeSubmitStatus");
const protonWaitInput = document.getElementById("protonWait");
const clickXInput       = document.getElementById("clickX");
const clickYInput       = document.getElementById("clickY");
const dblClickDelayInput  = document.getElementById("dblClickDelay");
const wrongCodeWaitInput  = document.getElementById("wrongCodeWait");
const dblClickXInput    = document.getElementById("dblClickX");
const dblClickYInput    = document.getElementById("dblClickY");
const toggleInput = document.getElementById("autoRunToggle");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load saved settings when popup opens
chrome.storage.sync.get([
  "expertEmail", "autoRun", "protonWaitSeconds",
  "clickX", "clickY",
  "dblClickDelay", "dblClickX", "dblClickY",
  "wrongCodeWait",
], (data) => {
  if (data.expertEmail) emailInput.value = data.expertEmail;
  if (data.autoRun !== undefined) toggleInput.checked = data.autoRun;
  protonWaitInput.value    = data.protonWaitSeconds ?? 15;
  clickXInput.value        = data.clickX ?? 600;
  clickYInput.value        = data.clickY ?? 160;
  dblClickDelayInput.value = data.dblClickDelay ?? 7;
  dblClickXInput.value     = data.dblClickX ?? 1130;
  dblClickYInput.value     = data.dblClickY ?? 620;
  wrongCodeWaitInput.value = data.wrongCodeWait ?? 6;
});

// Load last search result
function renderSearchResult(r) {
  if (!r) { searchResultEl.textContent = "No search run yet."; return; }
  if (r.found) {
    searchResultEl.innerHTML =
      `<span style="color:#4caf50;font-weight:bold;">FOUND</span> at ${r.time}<br>` +
      `Method: <b>${r.method}</b> &nbsp;|&nbsp; Matches: <b>${r.count}</b><br>` +
      `Classes: <span style="color:#666">${r.classes}</span>`;
  } else {
    searchResultEl.innerHTML =
      `<span style="color:#e53935;font-weight:bold;">NOT FOUND</span> at ${r.time}<br>` +
      `Method tried: <b>${r.method}</b> &nbsp;|&nbsp; Matches: <b>${r.count}</b>`;
  }
}

function renderCodeSubmitStatus(r) {
  if (!r) return;
  const colors = {
    "submitting": "#f59e0b",
    "success — tab closed": "#4caf50",
    "wrong code — fetching new": "#e53935",
  };
  const color = colors[r.status] || "#555";
  codeSubmitStatusEl.innerHTML =
    `Attempt <b style="font-size:14px">#${r.attempt}</b> &nbsp;` +
    `code: <b>${r.code}</b><br>` +
    `<span style="color:${color};font-weight:bold">${r.status}</span>` +
    `<span style="color:#999;font-size:10px;float:right">${r.time}</span>`;
}

function renderRetryStatus(r) {
  if (!r) return;
  const colors = { trying: "#f59e0b", success: "#4caf50", "failed — retrying": "#e53935" };
  const color = colors[r.status] || "#555";
  retryStatusEl.innerHTML =
    `Attempt <b style="font-size:14px">#${r.attempt}</b> &nbsp;` +
    `<span style="color:${color};font-weight:bold">${r.status}</span>` +
    `<span style="color:#999;font-size:10px;float:right">${r.time}</span>`;
}

function renderVerificationCode(v) {
  if (!v) return;
  verificationCodeEl.textContent = v.code;
  verificationCodeEl.style.color = v.code === "(not found)" ? "#e53935" : "#1a73e8";
  verificationCodeEl.title = `Retrieved at ${v.time}`;
}

chrome.storage.local.get([
  "protonSearchResult", "mousePos",
  "lastVerificationCode", "lastEmailContent",
  "protonRetryStatus", "codeSubmitStatus",
], (data) => {
  renderRetryStatus(data.protonRetryStatus);
  renderCodeSubmitStatus(data.codeSubmitStatus);
  renderSearchResult(data.protonSearchResult);
  if (data.mousePos) mousePosEl.textContent = `x: ${data.mousePos.x}, y: ${data.mousePos.y}`;
  renderVerificationCode(data.lastVerificationCode);
  if (data.lastEmailContent) emailContentEl.textContent = data.lastEmailContent;
});

// Live-update while popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.protonRetryStatus)    renderRetryStatus(changes.protonRetryStatus.newValue);
  if (changes.codeSubmitStatus)     renderCodeSubmitStatus(changes.codeSubmitStatus.newValue);
  if (changes.protonSearchResult)   renderSearchResult(changes.protonSearchResult.newValue);
  if (changes.mousePos) {
    const p = changes.mousePos.newValue;
    mousePosEl.textContent = `x: ${p.x}, y: ${p.y}`;
  }
  if (changes.lastVerificationCode) renderVerificationCode(changes.lastVerificationCode.newValue);
  if (changes.lastEmailContent)     emailContentEl.textContent = changes.lastEmailContent.newValue;
});

clearResultBtn.addEventListener("click", () => {
  chrome.storage.local.remove("protonSearchResult", () => {
    searchResultEl.textContent = "No search run yet.";
  });
});

saveBtn.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const autoRun = toggleInput.checked;
  const protonWaitSeconds = Math.max(1, parseInt(protonWaitInput.value, 10) || 15);
  const clickX        = parseInt(clickXInput.value, 10)        || 600;
  const clickY        = parseInt(clickYInput.value, 10)        || 160;
  const dblClickDelay  = parseInt(dblClickDelayInput.value, 10)  || 7;
  const dblClickX      = parseInt(dblClickXInput.value, 10)      || 1130;
  const dblClickY      = parseInt(dblClickYInput.value, 10)      || 620;
  const wrongCodeWait  = parseInt(wrongCodeWaitInput.value, 10)  || 6;

  if (!email) {
    statusEl.style.color = "#e53935";
    statusEl.textContent = "Please enter a valid email.";
    return;
  }

  chrome.storage.sync.set({
    expertEmail: email, autoRun, protonWaitSeconds,
    clickX, clickY,
    dblClickDelay, dblClickX, dblClickY,
    wrongCodeWait,
  }, () => {
    statusEl.style.color = "#4caf50";
    statusEl.textContent = "Settings saved!";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  });
});

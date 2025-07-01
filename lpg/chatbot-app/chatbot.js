import { BASE_URL, API_ENDPOINTS } from "../api/api-config.js";
import { actions } from './actions/registry.js';

let fuse;
let intents = [];
let fuseThreshold = 0.4;
let pendingIntent = null;
let pendingConfirmation = null;
let pendingClarify = false;
let pendingClarifyIntent = null;

const chatbox = document.getElementById("chatbox");

async function loadIntents() {
  const res = await fetch("../chatbot-app/intents.json");
  intents = await res.json();
  fuse = new Fuse(intents, {
    keys: ["patterns"],
    threshold: fuseThreshold,
    includeScore: true,
  });
  window.intents = intents;
}
loadIntents();

async function fetchCSRFToken() {
  const csrfURL = `${BASE_URL}${API_ENDPOINTS.CSRF}?_t=${Date.now()}`;
  const res = await fetch(csrfURL, {
    method: "GET",
    credentials: "include",
    headers: { "Cache-Control": "no-cache" },
  });
  return res.headers.get("X-CSRF-TOKEN");
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  addChat("user", message);
  input.value = "";

  const payload = { QUESTION: message };
  console.log("Sending chatbot API payload:", payload);

  try {
    const csrfToken = await fetchCSRFToken();

    fetch(`${BASE_URL}${API_ENDPOINTS.CHATBOT_CHATS}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        "Cache-Control": "no-cache"
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Failed to fetch CSRF token, but continuing chat flow.", err);
  }

  if (pendingClarify) {
    return handleClarification(message);
  }

  if (pendingConfirmation) {
    handleConfirmation(message);
  } else if (pendingIntent) {
    handleFollowUp(message);
  } else {
    detectIntent(message);
  }
}

function addChat(type, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-bubble ${type}`;
  let avatarHTML =
    type === "user"
      ? '<div class="avatar user">🙋</div>'
      : '<div class="avatar bot">🤖</div>';
  // bubble should be styled according to type (user/bot)
  wrapper.innerHTML =
    (type === "user"
      ? `<div class="bubble user">${text}</div>${avatarHTML}`
      : `${avatarHTML}<div class="bubble bot">${text}</div>`);
  chatbox.appendChild(wrapper);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "chat-bubble bot typing-indicator";
  indicator.innerHTML = `
    <div class="avatar bot">🤖</div>
    <div class="bubble bot">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
  `;
  chatbox.appendChild(indicator);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function hideTypingIndicator() {
  const indicators = chatbox.getElementsByClassName("typing-indicator");
  Array.from(indicators).forEach((el) => el.remove());
}

function respondWithDelay(content, isHTML = false) {
  showTypingIndicator();
  setTimeout(() => {
    hideTypingIndicator();
    isHTML ? addHTML(content) : addChat("bot", content);
  }, 700); // Simulates typing delay
}

function addHTML(html) {
  const wrapper = document.createElement("div");
  wrapper.className = "bot";
  wrapper.innerHTML = html;
  chatbox.appendChild(wrapper);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function detectIntent(text) {
  const lower = text.toLowerCase();
  // quick‐catch for “term” / “termial” etc.
  if (!pendingConfirmation && !pendingIntent && /^(term|termia?l?)$/.test(lower)) {
    pendingClarifyIntent = intents.find(i => i.intent === "update_terminal_avails_adj");
    pendingClarify = true;
    return respondWithDelay(
      "🤔 It looks like you might be trying to update Terminal Avails Adjustment. Is that right? (yes/no)"
    );
  }

  const match = fuse.search(text)[0];

  if (!match || match.score > 0.4) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      respondWithDelay("🤔 I didn’t quite catch that. Could you rephrase?");
    }, 1000);
    return;
  }

  // If match is valid, continue intent handling (no fallback here)
  const intent = { ...match.item, _originalText: text };
  const collected = extractParameters(intent, text);
  const remaining = (intent.params || []).filter(p => !(p.name in collected));
  const minConfirmScore = intent.minConfirmationScore ?? 0.25;

  if (remaining.length === 0 && intent.autofillSkipConfirmation) {
    respondToIntent(intent, collected);
  } else if (intent.confirmationPrompt && match.score >= minConfirmScore) {
    pendingConfirmation = { ...intent, collected, remainingParams: remaining };
    respondWithDelay(intent.confirmationPrompt + " (yes/no)");
  } else {
    prepareIntent(intent, text);
  }
}

function handleClarification(reply) {
  const yes = reply.trim().toLowerCase().startsWith("y");
  const intent = pendingClarifyIntent;
  pendingClarify = false;
  pendingClarifyIntent = null;

  if (yes) {
    // route into the normal param‐collection flow:
    prepareIntent(intent);
  } else {
    addChat("bot", "👍 Okay, let me know what you’d like to do instead.");
  }
}

function handleConfirmation(userReply) {
  const confirmed = userReply.toLowerCase().startsWith("y");
  const intent = pendingConfirmation;
  const text = intent._originalText || "";
  const collected = intent.collected || {};
  const remaining = intent.remainingParams || [];
  pendingConfirmation = null;

  if (confirmed) {
    if (remaining.length > 0) {
      pendingIntent = {
        ...intent,
        collected,
        currentParamIndex: 0,
        remainingParams: remaining,
      };
      promptNextParam();
    } else {
      return respondToIntent(intent, collected);
    }
  } else {
    addChat("bot", "Okay, let’s start over. What would you like to do?");
  }
}

function prepareIntent(intent, userText = "") {
  const collected = extractParameters(intent, userText);
  const remainingParams = (intent.params || []).filter(
    (p) => !(p.name in collected) || collected[p.name] == null
  );

  if (remainingParams.length > 0) {
    pendingIntent = {
      ...intent,
      collected,
      currentParamIndex: 0,
      remainingParams,
    };
    promptNextParam();
  } else {
    respondToIntent(intent, collected);
  }
}

function promptNextParam() {
  const intent = pendingIntent;
  const param = intent.remainingParams[intent.currentParamIndex];

  if (param.name === "startDay") {
    addHTML(`
    <div>
      <label>Start Day: <input type="number" id="startDayInput" min="1" max="31"></label>
      <label>End Day: <input type="number" id="endDayInput" min="1" max="31"></label>
      <button onclick="submitDayRange()">Submit</button>
    </div>
  `);
    return;
  }

  if (param.name === "adjustmentType") {
    addHTML(`
      <div>
        <p>Select adjustment type:</p>
        <button onclick="selectAdjustmentType('increase')">Increase</button>
        <button onclick="selectAdjustmentType('decrease')">Decrease</button>
        <button onclick="selectAdjustmentType('add')">Add</button>
        <button onclick="selectAdjustmentType('remove')">Remove</button>
      </div>
    `);
    return;
  }

  if (param.name === "day") {
    const today = new Date();
    const currentDay = today.getDate();
    const maxDay = 31;

    // Build options from today → 31
    let optionsHTML = "<div><p>Select a valid day:</p>";
    for (let i = currentDay; i <= maxDay; i++) {
      optionsHTML += `<button onclick="submitDay(${i})">${i}</button> `;
    }
    optionsHTML += "</div>";

    return addHTML(optionsHTML);
  }

  if (param.name === "product") {
    let productCodes = window.selection?.products || [];
    if (!productCodes.length && window.liftingAmendmentData?.length) {
      productCodes = Object.keys(window.liftingAmendmentData[0])
        .filter(k => k.startsWith("terminalAvails_"))
        .map(k => k.replace("terminalAvails_", ""));
    }
    const nameMap = window.productNameMap || {};

    if (!productCodes.length) {
      return addChat("bot", "⚠️ No products found from selection.");
    }

    let buttonsHTML = `<div><p>📦 For which product? (or type 'all')</p>`;
    productCodes.forEach(code => {
      const label = nameMap[code] || code;
      buttonsHTML += `<button class="product-button" onclick="selectProduct('${code}')">${label}</button> `;
    });
    buttonsHTML += `<button class="product-button" onclick="selectProduct('all')">All</button>`;
    buttonsHTML += `</div>`;
    return respondWithDelay(buttonsHTML, true);
  }

  const prompt = param.prompt || `Please provide ${param.name}`;
  respondWithDelay(prompt);
}

function selectProduct(productLabel) {
  const lowerLabel = productLabel.toLowerCase();

  let productCode;
  if (lowerLabel === 'all') {
    productCode = 'all';
  } else {
    const availableCodes = window.selection?.products || [];
    if (availableCodes.includes(productLabel)) {
      productCode = productLabel;
    } else {
      productCode = Object.keys(window.productCodeMap || {}).find(
        code => (window.productCodeMap[code] || code).toLowerCase() === lowerLabel
      ) || productLabel;
    }
  }

  pendingIntent.collected["product"] = productCode;

  // Disable product buttons after selection
  const productButtons = document.querySelectorAll('.product-button');
  productButtons.forEach(btn => {
    btn.disabled = true;
    btn.classList.add('disabled-button');
  });

  // Show selected product above
  addHTML(`<div><strong>✅ Selected Product:</strong> ${productCode === 'all' ? 'All Products' : productCode}</div>`);

  pendingIntent.currentParamIndex++;

  if (pendingIntent.currentParamIndex < pendingIntent.remainingParams.length) {
    promptNextParam();
  } else {
    const args = pendingIntent.collected;
    respondToIntent(pendingIntent, args);
    pendingIntent = null;
  }
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function submitDay(day) {
  pendingIntent.collected["day"] = day;
  pendingIntent.currentParamIndex++;
  promptNextParam();
}

function submitDayRange() {
  const start = document.getElementById("startDayInput").value;
  const end = document.getElementById("endDayInput").value;
  if (!start || !end)
    return addChat("bot", "⚠️ Please enter both start and end day.");

  pendingIntent.collected["startDay"] = start;
  pendingIntent.collected["endDay"] = end;

  // Skip BOTH startDay and endDay
  pendingIntent.currentParamIndex += 2;

  if (pendingIntent.currentParamIndex < pendingIntent.remainingParams.length) {
    promptNextParam();
  } else {
    const args = pendingIntent.collected;
    respondToIntent(pendingIntent, args);
    pendingIntent = null;
  }
}

function selectAdjustmentType(type) {
  pendingIntent.collected["adjustmentType"] = type;
  pendingIntent.currentParamIndex++;
  promptNextParam();
}

function handleFollowUp(text) {
  const userInput = text.trim();

  // Support gratitude response
  if (["thanks", "thank you", "thx"].includes(userInput.toLowerCase())) {
    return respondToGratitude();
  }

  if (
    ["cancel", "start again", "start over", "stop", "reset"].includes(userInput.toLowerCase())
  ) {
    pendingIntent = null;
    addChat("bot", "🔄 No problem, let’s start fresh. What would you like to do?");
    return;
  }

  const intent = pendingIntent;
  const param = intent.remainingParams[intent.currentParamIndex];
  let value = userInput;

  if (param.name === "product") {
    // rebuild the same array of labels you rendered in promptNextParam()
    let productCodes = window.selection?.products || [];
    if (!productCodes.length && window.liftingAmendmentData?.length) {
      productCodes = Object.keys(window.liftingAmendmentData[0])
        .filter(k => k.startsWith("terminalAvails_"))
        .map(k => k.replace("terminalAvails_", ""));
    }
    const nameMap = window.productNameMap || {};
    const allowedLabels = productCodes.map(code => nameMap[code] || code);

    if (value.toLowerCase() !== 'all' && !allowedLabels.includes(value)) {
      return respondWithDelay(
        `⚠️ Please select a product from the options above, or type "start over" to begin again.`
      );
    }
  }

  // Map product name back to code
  if (param.name === "product") {
    const reverseMap = window.productNameMap || {};
    const entry = Object.entries(reverseMap).find(
      ([code, name]) => name.toLowerCase() === userInput.toLowerCase()
    );
    if (entry) {
      value = entry[1]; // original product name used for display
    }
  }

  if (param.validation) {
    const regex = new RegExp(param.validation);
    if (!regex.test(value)) {
      // special case for the 'day' prompt
      if (param.name === "day") {
        return respondWithDelay(
          `⚠️ Please select a date from the options above, or type "start over" to begin again.`
        );
      }
      // fallback for everything else
      return respondWithDelay(`⚠️ Invalid format for "${param.name}". Please try again.`);
    }
  }

  intent.collected[param.name] = value;
  intent.currentParamIndex++;

  if (intent.currentParamIndex < intent.remainingParams.length) {
    promptNextParam();
  } else {
    const args = intent.collected;
    respondToIntent(intent, args);
    pendingIntent = null;
  }
}

function extractParameters(intent, text) {
  const params = intent.params || [];
  const result = {};

  params.forEach((param) => {
    if (param.extraction) {
      const regex = new RegExp(param.extraction, "i");
      const match = text.match(regex);
      if (match) {
        result[param.name] = match[1];
      }
    } else if (param.name === "product") {
      const possibleProducts = (window.selection?.products || []).map(p => p.toLowerCase());
      const words = text.toLowerCase().split(/\s+/);
      const foundProduct = words.find(w => possibleProducts.includes(w) || w === "all");
      if (foundProduct) {
        result["product"] = foundProduct;
      } else {
        result["product"] = null;
      }
    } else if (param.validation) {
      const regex = new RegExp(param.validation);
      const match = text.match(regex);
      if (match) {
        result[param.name] = match[0];
      }
    }
  });

  return result;
}

function respondToIntent(intentObj, args) {
  if (intentObj.function) {
    const fn = window[intentObj.function];
    if (typeof fn === "function") {
      const result = fn(args);
      if (result === false) {
        return;
      }
    }
  }

  if (intentObj.responseTemplate) {
    const msg = fillTemplate(intentObj.responseTemplate, args);
    return respondWithDelay(msg);
  }
}

function fillTemplate(template, values) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => values[key] || "");
}

// END CHAT CONVERSATION
function respondToGratitude() {
  const responses = [
    "😊 You're welcome!",
    "🙌 Glad I could help!",
    "👍 Anytime!",
    "😄 No problem!",
    "🫶 Always here for you!",
    "👌 Happy to assist!",
    "💡 Let me know if you need anything else!"
  ];

  const buttons = `
    <br><br>
    <button onclick='endChat()'>End Chat</button>
    <button onclick='restartChat()'>Start Over</button>
  `;

  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  addChat("bot", randomResponse + buttons);
}

function endChat() {
  addChat("bot", "👋 Chat ended. Have a great day!");
  pendingIntent = null;
  pendingConfirmation = null;
}

function restartChat() {
  pendingIntent = null;
  pendingConfirmation = null;
  addChat("bot", "🔄 Alright! What would you like to do?");
}

// Attach global helpers
Object.entries({
  sendMessage, endChat, restartChat, addChat, addHTML, showTypingIndicator, hideTypingIndicator, respondWithDelay, selectProduct, selectAdjustmentType, submitDay, submitDayRange, respondToGratitude, capitalize, respondWithDelay, prepareIntent, promptNextParam
}).forEach(([name, fn]) => {
  window[name] = fn;
});

// Attach actions dynamically
Object.entries(actions).forEach(([name, fn]) => {
  window[name] = fn;
});


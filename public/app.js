const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const empty = document.getElementById("empty");

let history = []; // [{role: "user"|"assistant", content: "..."}]

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Minimal formatting: ```code blocks```, `inline code`, **bold**
function format(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return html;
}

function addMessage(kind, text, asHtml = false) {
  if (empty) empty.remove();
  const wrap = document.createElement("div");
  wrap.className = `msg ${kind}`;
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = kind === "user" ? "You" : kind === "bot" ? "Study Desk" : "Problem";
  const body = document.createElement("div");
  body.className = "body";
  if (asHtml) body.innerHTML = format(text); else body.textContent = text;
  wrap.append(who, body);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}

async function send(text) {
  text = text.trim();
  if (!text) return;
  addMessage("user", text);
  history.push({ role: "user", content: text });
  input.value = "";
  autoGrow();
  sendBtn.disabled = true;
  const typing = addMessage("bot", "Thinking…");
  typing.querySelector(".body").classList.add("typing");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json().catch(() => ({}));
    typing.remove();
    if (!res.ok) {
      history.pop(); // let the student retry the same question
      addMessage("error", data.error || "Something went wrong. Please try again.");
    } else {
      history.push({ role: "assistant", content: data.reply });
      addMessage("bot", data.reply, true);
    }
  } catch {
    typing.remove();
    history.pop();
    addMessage("error", "Cannot reach the server. Make sure it is running (npm start).");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
input.addEventListener("input", autoGrow);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => send(c.textContent)));
clearBtn.addEventListener("click", () => { history = []; location.reload(); });

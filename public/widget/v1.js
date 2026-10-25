(function () {
  "use strict";

  var SCRIPT =
    document.currentScript ||
    (function () {
      var nodes = document.getElementsByTagName("script");
      return nodes[nodes.length - 1] || null;
    })();

  if (!SCRIPT) return;

  var PUBLIC_ID = (SCRIPT.getAttribute("data-chatbot-id") || "").trim();
  if (!PUBLIC_ID) return;

  var API_ORIGIN = (function () {
    try {
      return new URL(SCRIPT.src, window.location.href).origin;
    } catch {
      return "";
    }
  })();

  if (!API_ORIGIN) return;

  var STORAGE_KEY = "cp_widget_v1_" + PUBLIC_ID;
  var AUTO_OPEN = SCRIPT.getAttribute("data-open") === "true";
  var host = document.createElement("div");
  host.setAttribute("data-chatpilot-widget", "v1");
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var state = {
    config: null,
    session: null,
    open: AUTO_OPEN,
    pending: false,
    error: "",
    messages: [],
  };

  function headers(extra) {
    var next = {
      "content-type": "application/json",
      "x-chatpilot-public-id": PUBLIC_ID,
    };
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) next[key] = extra[key];
      }
    }
    if (state.session) {
      next["x-chatpilot-session"] = state.session.sessionId;
      next["x-chatpilot-token"] = state.session.token;
    }
    return next;
  }

  function apiUrl(path) {
    return API_ORIGIN + path + (path.indexOf("?") === -1 ? "?" : "&") + "publicId=" + encodeURIComponent(PUBLIC_ID);
  }

  function loadSession() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.sessionId && parsed.token) return parsed;
    } catch {
      return null;
    }
    return null;
  }

  function saveSession(session) {
    state.session = session;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function css(color) {
    return (
      ":host{all:initial;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;}" +
      "*,*::before,*::after{box-sizing:border-box;}" +
      ".wrap{position:fixed;z-index:2147483000;inset:auto 16px 16px auto;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}" +
      ".panel{width:min(400px,calc(100vw - 24px));height:min(640px,calc(100vh - 96px));background:#fff;color:#111827;border:1px solid rgba(15,23,42,.12);border-radius:20px;box-shadow:0 18px 50px rgba(15,23,42,.22);display:none;flex-direction:column;overflow:hidden;}" +
      ".panel.open{display:flex;}" +
      ".head{display:flex;align-items:center;gap:12px;padding:14px 16px;color:#fff;background:" +
      color +
      ";}" +
      ".avatar{width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;overflow:hidden;}" +
      ".avatar img{width:100%;height:100%;object-fit:cover;}" +
      ".title{font-size:14px;font-weight:700;margin:0;}" +
      ".sub{font-size:11px;opacity:.85;margin:2px 0 0;}" +
      ".close{margin-left:auto;border:0;background:rgba(255,255,255,.16);color:#fff;width:28px;height:28px;border-radius:999px;cursor:pointer;}" +
      ".log{flex:1;overflow:auto;padding:14px 16px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;}" +
      ".bubble{max-width:88%;padding:10px 12px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word;}" +
      ".visitor{align-self:flex-end;background:" +
      color +
      ";color:#fff;border-bottom-right-radius:6px;}" +
      ".assistant{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:6px;}" +
      ".sources{margin:8px 0 0;padding:8px 0 0;border-top:1px solid #e5e7eb;font-size:11px;color:#64748b;}" +
      ".sources strong{display:block;color:#0f172a;}" +
      ".err{padding:0 16px 8px;color:#b91c1c;font-size:12px;}" +
      ".composer{border-top:1px solid #e5e7eb;padding:12px 16px;background:#fff;}" +
      ".chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}" +
      ".chip{border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:6px 10px;font-size:12px;cursor:pointer;}" +
      ".row{display:flex;gap:8px;}" +
      ".row input{flex:1;border:1px solid #d1d5db;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;}" +
      ".row button{border:0;border-radius:12px;padding:0 14px;background:" +
      color +
      ";color:#fff;font-weight:600;cursor:pointer;}" +
      ".row button[disabled]{opacity:.6;cursor:wait;}" +
      ".brand{margin-top:8px;font-size:10px;color:#94a3b8;text-align:center;}" +
      ".launcher{width:56px;height:56px;border:0;border-radius:999px;background:" +
      color +
      ";color:#fff;box-shadow:0 10px 24px rgba(15,23,42,.28);cursor:pointer;font-size:22px;}" +
      ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}" +
      "@media (max-width:560px){.wrap{inset:0;padding:0;align-items:stretch;}" +
      ".panel{width:100%;height:100%;max-height:none;border-radius:0;}" +
      ".launcher{position:fixed;right:16px;bottom:16px;}" +
      ".wrap.is-open .launcher{display:none;}}"
    );
  }

  function initials(name) {
    return (name || "AI")
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("") || "AI";
  }

  function render() {
    var config = state.config;
    if (!config) {
      root.innerHTML = "";
      return;
    }
    var color = config.brandColor || "#2563EB";
    var html = '<style>' + css(color) + "</style>";
    html += '<div class="wrap' + (state.open ? " is-open" : "") + '">';
    html += '<section class="panel' + (state.open ? " open" : "") + '" role="dialog" aria-label="' + escapeHtml(config.name) + '">';
    html += '<header class="head">';
    html += '<div class="avatar">';
    if (config.avatarUrl) {
      html += '<img alt="" src="' + escapeHtml(config.avatarUrl) + '">';
    } else {
      html += escapeHtml(initials(config.name));
    }
    html += "</div><div><p class=\"title\">" + escapeHtml(config.name) + "</p>";
    html += '<p class="sub">Typically replies instantly</p></div>';
    html += '<button type="button" class="close" data-action="close" aria-label="Close chat">×</button></header>';
    html += '<div class="log" data-log="1">';
    for (var i = 0; i < state.messages.length; i += 1) {
      var item = state.messages[i];
      html += '<div class="bubble ' + (item.role === "visitor" ? "visitor" : "assistant") + '">';
      html += escapeHtml(item.content || (state.pending && i === state.messages.length - 1 ? "…" : ""));
      if (item.citations && item.citations.length) {
        html += '<div class="sources">';
        for (var c = 0; c < item.citations.length; c += 1) {
          html += "<strong>" + escapeHtml(item.citations[c].title) + "</strong>";
          html += "<span>" + escapeHtml(item.citations[c].snippet) + "</span>";
        }
        html += "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    if (state.error) html += '<p class="err">' + escapeHtml(state.error) + "</p>";
    html += '<div class="composer">';
    if (!state.messages.some(function (item) { return item.role === "visitor"; }) && config.suggestedQuestions && config.suggestedQuestions.length) {
      html += '<div class="chips">';
      for (var q = 0; q < config.suggestedQuestions.length; q += 1) {
        html += '<button type="button" class="chip" data-question="' + escapeHtml(config.suggestedQuestions[q]) + '">' + escapeHtml(config.suggestedQuestions[q]) + "</button>";
      }
      html += "</div>";
    }
    html += '<form class="row" data-form="1"><label class="sr" for="cp-input">Message</label>';
    html += '<input id="cp-input" name="message" maxlength="4000" placeholder="Ask a question" ' + (state.pending ? "disabled" : "") + ">";
    html += '<button type="submit" ' + (state.pending ? "disabled" : "") + ">" + (state.pending ? "…" : "Send") + "</button></form>";
    if (!config.removeBranding) html += '<p class="brand">Powered by ChatPilot</p>';
    html += "</div></section>";
    html += '<button type="button" class="launcher" data-action="toggle" aria-label="' + (state.open ? "Close chat" : "Open chat") + '">';
    html += state.open ? "×" : "💬";
    html += "</button></div>";
    root.innerHTML = html;
    var log = root.querySelector("[data-log]");
    if (log) log.scrollTop = log.scrollHeight;
  }

  function parseSse(buffer, onEvent) {
    var parts = buffer.split("\n\n");
    var rest = parts.pop() || "";
    for (var i = 0; i < parts.length; i += 1) {
      var line = parts[i].replace(/^data:\s*/, "");
      if (!line) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        /* ignore malformed chunk */
      }
    }
    return rest;
  }

  async function ensureSession() {
    if (state.session) return state.session;
    var cached = loadSession();
    if (cached) {
      state.session = cached;
      return cached;
    }
    var response = await fetch(apiUrl("/api/widget/v1/session"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ publicId: PUBLIC_ID }),
    });
    var payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok || !payload.sessionId || !payload.token) {
      throw new Error(payload.error || "Could not start a visitor session.");
    }
    saveSession(payload);
    return payload;
  }

  async function send(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed || state.pending) return;
    state.pending = true;
    state.error = "";
    state.messages.push({ role: "visitor", content: trimmed });
    state.messages.push({ role: "assistant", content: "" });
    render();
    try {
      await ensureSession();
      var response = await fetch(apiUrl("/api/widget/v1/chat"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ publicId: PUBLIC_ID, message: trimmed }),
      });
      if (!response.ok || !response.body) {
        var failed = await response.json().catch(function () {
          return {};
        });
        throw new Error(failed.error || "The chat request failed.");
      }
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        buffer = parseSse(buffer, function (event) {
          if (event.type === "delta" && event.text) {
            var last = state.messages[state.messages.length - 1];
            if (last && last.role === "assistant") last.content += event.text;
            render();
          }
          if (event.type === "citations" && event.citations) {
            var assistant = state.messages[state.messages.length - 1];
            if (assistant && assistant.role === "assistant") assistant.citations = event.citations;
            render();
          }
          if (event.type === "error") {
            state.error = event.message || "The model request failed.";
          }
        });
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : "The chat request failed.";
    } finally {
      state.pending = false;
      render();
    }
  }

  root.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var close = target.closest("[data-action='close']");
    var toggle = target.closest("[data-action='toggle']");
    var chip = target.closest("[data-question]");
    if (close) {
      state.open = false;
      render();
    } else if (toggle) {
      state.open = !state.open;
      render();
    } else if (chip) {
      send(chip.getAttribute("data-question") || "");
    }
  });

  root.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.getAttribute || form.getAttribute("data-form") !== "1") return;
    event.preventDefault();
    var input = form.querySelector("input");
    send(input ? input.value : "");
  });

  async function boot() {
    try {
      var response = await fetch(apiUrl("/api/widget/v1/config"), { headers: headers() });
      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.error || "Widget is not available on this website.");
      }
      state.config = payload;
      state.messages = [{ role: "assistant", content: payload.welcomeMessage || "Hi! How can I help you today?" }];
      render();
    } catch {
      host.remove();
    }
  }

  boot();
})();

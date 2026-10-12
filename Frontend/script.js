(() => {
  "use strict";

  // Backend URL — change this if your FastAPI runs on another port
  const API_BASE = "http://127.0.0.1:8000";

  // ---------------------------------------------------------
  // Elements
  // ---------------------------------------------------------
  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const states = {
    idle: document.getElementById("state-idle"),
    loading: document.getElementById("state-loading"),
    result: document.getElementById("state-result"),
    error: document.getElementById("state-error"),
  };

  const horizon = document.getElementById("horizon");
  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const tipsEl = document.getElementById("tips");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  // ---------------------------------------------------------
  // Rotating quotes (top of page)
  // ---------------------------------------------------------
  const QUOTES = [
    { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
    { text: "Self-care is not self-indulgence, it is self-preservation.", author: "Audre Lorde" },
    { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
    { text: "It's okay to not be okay, as long as you don't stay that way alone.", author: "" },
    { text: "Sleep is the best meditation.", author: "Dalai Lama" },
    { text: "One small positive thought in the morning can change your whole day.", author: "" },
  ];

  const quoteEl = document.getElementById("quote");
  const quoteText = document.getElementById("quote-text");
  const quoteAuthor = document.getElementById("quote-author");
  const dotsEl = document.getElementById("quote-dots");
  let quoteIndex = Math.floor(Math.random() * QUOTES.length);
  let quoteTimer = null;

  QUOTES.forEach((_, i) => {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "dot";
    d.setAttribute("aria-label", `Show quote ${i + 1}`);
    d.addEventListener("click", () => { showQuote(i); restartQuoteTimer(); });
    dotsEl.appendChild(d);
  });

  function paintQuote(i) {
    quoteIndex = i;
    quoteText.textContent = QUOTES[i].text;
    quoteAuthor.textContent = QUOTES[i].author;
    dotsEl.querySelectorAll(".dot").forEach((d, n) => d.classList.toggle("active", n === i));
  }

  function showQuote(i) {
    if (i === quoteIndex) return;
    quoteEl.classList.add("swap");
    setTimeout(() => {
      paintQuote(i);
      quoteEl.classList.remove("swap");
    }, 600);
  }

  function restartQuoteTimer() {
    clearInterval(quoteTimer);
    quoteTimer = setInterval(() => showQuote((quoteIndex + 1) % QUOTES.length), 9000);
  }

  paintQuote(quoteIndex);
  restartQuoteTimer();

  // ---------------------------------------------------------
  // Stress selector
  // ---------------------------------------------------------
  const segGroup = document.getElementById("stress_level_group");
  const stressInput = document.getElementById("stress_level");

  segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      segGroup.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-checked", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");
      stressInput.value = btn.dataset.value;
      clearFieldError(stressInput);
    });
  });

  // ---------------------------------------------------------
  // Field error helpers
  // ---------------------------------------------------------
  function setFieldError(input, message) {
    const wrap = input.closest(".field");
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msg = wrap.querySelector(".error-msg");
    if (msg) msg.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = input.closest(".field");
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msg = wrap.querySelector(".error-msg");
    if (msg) msg.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------------------------------------------------------
  // Payload + validation (mirrors StudentData in main.py)
  // ---------------------------------------------------------
  const num = (v, parser) => (v === "" || v === null ? NaN : parser(v));

  function collectPayload() {
    const fd = new FormData(form);
    return {
      age: num(fd.get("age"), (v) => parseInt(v, 10)),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: num(fd.get("avg_daily_usage_hours"), parseFloat),
      daily_unlocks: num(fd.get("daily_unlocks"), (v) => parseInt(v, 10)),
      study_hours: num(fd.get("study_hours"), parseFloat),
      physical_activity_hours: num(fd.get("physical_activity_hours"), parseFloat),
      sleep_hours_per_night: num(fd.get("sleep_hours_per_night"), parseFloat),
      stress_level: fd.get("stress_level") || "",
    };
  }

  function validate(payload) {
    const errors = [];
    const ranges = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    ranges.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (Number.isNaN(val)) {
        errors.push([input, "Please fill this in."]);
      } else if (val < min || val > max) {
        errors.push([input, max === Infinity ? "Must be 0 or more." : `Enter a value between ${min} and ${max}.`]);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      if (!payload[key]) errors.push([document.getElementById(key), "Please choose an option."]);
    });

    if (!payload.stress_level) errors.push([stressInput, "Pick how stressed you feel."]);
    return errors;
  }

  // ---------------------------------------------------------
  // UI states
  // ---------------------------------------------------------
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => (el.hidden = key !== name));
  }

  function setSubmitting(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
  }

  // The sun: score 0 = fully below the hills, score 10 = high in the sky
  function setSun(score, band) {
    const rise = score === null ? -30 : -100 + (score / 10) * 224;
    horizon.style.setProperty("--rise", `${rise}px`);
    horizon.dataset.band = band;
  }
  setSun(null, "idle");

  function bandFor(score) {
    if (score < 4) {
      return { key: "low", label: "Running low", context: "Your habits point to a lot of strain right now. Small changes in sleep and screen time can lift this." };
    }
    if (score < 7) {
      return { key: "mid", label: "Holding steady", context: "Your routine looks fairly balanced, with room to recover and reset." };
    }
    return { key: "high", label: "Looking bright", context: "Your habits point to a well-supported baseline. Keep doing what works." };
  }

  // Simple, rule-based nudges from the form values
  function tipsFor(p) {
    const tips = [];
    if (p.sleep_hours_per_night < 7) tips.push("Aim for 7–8 hours of sleep — it's the biggest single lever.");
    if (p.avg_daily_usage_hours > 5) tips.push("Try a screen-free hour before bed or during meals.");
    if (p.physical_activity_hours < 0.5) tips.push("A 20-minute walk a day makes a real difference.");
    if (p.stress_level === "High" || p.stress_level === "Very High") tips.push("Stress is high — talk to a friend, family member, or counsellor.");
    return tips.slice(0, 3);
  }

  function renderResult(score, payload) {
    const clamped = Math.max(0, Math.min(10, score));
    const band = bandFor(clamped);

    scoreNumberEl.textContent = score.toFixed(2);
    scoreBandEl.textContent = band.label;
    scoreContextEl.textContent = band.context;

    tipsEl.innerHTML = "";
    tipsFor(payload).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      tipsEl.appendChild(li);
    });

    showState("result");
    setSun(clamped, band.key);
  }

  function renderError(label, copy) {
    errorLabelEl.textContent = label;
    errorCopyEl.textContent = copy;
    showState("error");
    setSun(null, "idle");
  }

  // Map FastAPI 422 errors onto the matching form fields
  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const input = field ? document.getElementById(field) : null;
      if (input) {
        setFieldError(input, err.msg || "Invalid value.");
        matched = true;
      }
    });
    return matched;
  }

  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const errors = validate(payload);

    if (errors.length) {
      errors.forEach(([input, msg]) => input && setFieldError(input, msg));
      const first = errors[0][0];
      if (first && first.type !== "hidden") first.focus();
      return;
    }

    setSubmitting(true);
    showState("loading");
    setSun(null, "idle");

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        renderError(
          "Check your answers",
          matched
            ? "A few fields were rejected. They're marked on the form."
            : "The server rejected this submission. Review your answers and try again."
        );
        return;
      }

      if (!res.ok) {
        let msg = `The server responded with status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") msg = body.detail;
        renderError("Prediction failed", msg);
        return;
      }

      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        renderError("Unexpected response", "The server replied, but the score was missing.");
        return;
      }

      renderResult(data.predicted_mental_health_score, payload);
    } catch (err) {
      renderError(
        "Can't reach the server",
        `Couldn't connect to ${API_BASE}. Start the backend with: uvicorn main:app --reload (default port 8000).`
      );
    } finally {
      setSubmitting(false);
    }
  });

  // Clear a field's error as soon as the user edits it
  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => clearFieldError(el));
    el.addEventListener("change", () => clearFieldError(el));
  });

  resetBtn.addEventListener("click", () => { showState("idle"); setSun(null, "idle"); });
  errorRetryBtn.addEventListener("click", () => { showState("idle"); setSun(null, "idle"); });
})();
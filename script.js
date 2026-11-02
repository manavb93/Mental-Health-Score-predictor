/* ==========================================================
   MindScope – script.js
   Handles: validation, building the JSON payload, calling the
   FastAPI backend, loading state, result display, error handling.
   The score shown is ALWAYS the value returned by the API.
   ========================================================== */

"use strict";

// ----- Backend settings (do not change the endpoint or field names) -----
const API_URL = "http://127.0.0.1:8000/predict";
const REQUEST_TIMEOUT_MS = 30000;

/*
  The 12 fields, using the EXACT names from the Pydantic model `Student_data`.
  type: "int"    -> sent as a whole number
        "float"  -> sent as a decimal number
        "string" -> sent as text
*/
const FIELDS = [
  { name: "Age",                     label: "Age",                       type: "int",   min: 0, max: 100 },
  { name: "Gender",                  label: "Gender",                    type: "string" },
  { name: "Country",                 label: "Country",                   type: "string" },
  { name: "Academic_Level",          label: "Academic level",            type: "string" },
  { name: "Most_Used_Platform",      label: "Most used platform",        type: "string" },
  { name: "Purpose_Of_Use",          label: "Purpose of use",            type: "string" },
  { name: "Avg_Daily_Usage_Hours",   label: "Average daily usage",       type: "float", min: 0, max: 24 },
  { name: "Daily_Unlocks",           label: "Daily phone unlocks",       type: "int",   min: 0 },
  { name: "Study_Hours",             label: "Study hours",               type: "float", min: 0, max: 24 },
  { name: "Physical_Activity_Hours", label: "Physical activity hours",   type: "float", min: 0, max: 24 },
  { name: "Sleep_Hours_Per_Night",   label: "Sleep hours per night",     type: "float", min: 0, max: 24 },
  { name: "Stress_Level",            label: "Stress level",              type: "string" },
];

// ----- DOM references -----
const form        = document.getElementById("prediction-form");
const predictBtn  = document.getElementById("predict-btn");
const predictText = predictBtn.querySelector(".btn-label");
const resetBtn    = document.getElementById("reset-btn");
const loadingBox  = document.getElementById("loading");
const alertBox    = document.getElementById("alert");
const resultBox   = document.getElementById("result");
const scoreValue  = document.getElementById("score-value");
const newPredBtn  = document.getElementById("new-prediction-btn");

let isSubmitting = false; // guards against double submissions

/* ---------------------------------------------------------
   Field helpers
   --------------------------------------------------------- */

function getFieldWrapper(fieldName) {
  return document.getElementById(fieldName).closest(".field");
}

function showFieldError(fieldName, message) {
  const wrapper = getFieldWrapper(fieldName);
  wrapper.classList.add("invalid");
  wrapper.querySelector(".error").textContent = message;
  document.getElementById(fieldName).setAttribute("aria-invalid", "true");
}

function clearFieldError(fieldName) {
  const wrapper = getFieldWrapper(fieldName);
  wrapper.classList.remove("invalid");
  wrapper.querySelector(".error").textContent = "";
  document.getElementById(fieldName).removeAttribute("aria-invalid");
}

function clearAllErrors() {
  FIELDS.forEach((field) => clearFieldError(field.name));
  hideAlert();
}

/* ---------------------------------------------------------
   Validation (runs before anything is sent to the API)
   Returns an object { fieldName: message } – empty if valid.
   --------------------------------------------------------- */

function validateForm() {
  const errors = {};

  FIELDS.forEach((field) => {
    const raw = document.getElementById(field.name).value.trim();

    if (raw === "") {
      errors[field.name] = `${field.label} is required.`;
      return;
    }

    if (field.type === "string") return; // dropdowns / text: presence is enough

    const number = Number(raw);

    if (!Number.isFinite(number)) {
      errors[field.name] = `${field.label} must be a number.`;
    } else if (field.type === "int" && !Number.isInteger(number)) {
      errors[field.name] = `${field.label} must be a whole number.`;
    } else if (field.min !== undefined && number < field.min) {
      errors[field.name] = `${field.label} must be at least ${field.min}.`;
    } else if (field.max !== undefined && number > field.max) {
      errors[field.name] = `${field.label} must be at most ${field.max}.`;
    }
  });

  return errors;
}

/* ---------------------------------------------------------
   Build the JSON payload – numbers are real numbers, not strings
   --------------------------------------------------------- */

function buildPayload() {
  const payload = {};

  FIELDS.forEach((field) => {
    const raw = document.getElementById(field.name).value.trim();
    payload[field.name] = field.type === "string" ? raw : Number(raw);
  });

  return payload;
}

/* ---------------------------------------------------------
   UI state helpers
   --------------------------------------------------------- */

function setLoading(isLoading) {
  isSubmitting = isLoading;
  predictBtn.disabled = isLoading;
  resetBtn.disabled = isLoading;
  predictBtn.classList.toggle("is-loading", isLoading);
  predictText.textContent = isLoading ? "Analyzing..." : "Predict my score";
  loadingBox.hidden = !isLoading;
  if (isLoading) document.getElementById("score-empty").hidden = true;
  form.setAttribute("aria-busy", String(isLoading));
}

/* Shows a banner. `details` is an optional array of strings. */
function showAlert(title, message, details = []) {
  alertBox.innerHTML = "";

  const heading = document.createElement("strong");
  heading.textContent = title;
  alertBox.appendChild(heading);

  const text = document.createElement("span");
  text.textContent = message;
  alertBox.appendChild(text);

  if (details.length > 0) {
    const list = document.createElement("ul");
    details.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    alertBox.appendChild(list);
  }

  alertBox.hidden = false;
  alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideAlert() {
  alertBox.hidden = true;
  alertBox.innerHTML = "";
}

function hideResult() {
  resultBox.hidden = true;
  document.getElementById("score-empty").hidden = loadingBox.hidden === false;
}

/* Counts the number up to the real score for a smooth reveal.
   The final value is always exactly the API value. */
function animateScore(targetScore) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !Number.isFinite(targetScore)) {
    scoreValue.textContent = targetScore;
    return;
  }

  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    scoreValue.textContent = Math.round(targetScore * eased);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      scoreValue.textContent = targetScore; // exact API value
    }
  }
  requestAnimationFrame(tick);
}

function showResult(score) {
  document.getElementById("score-empty").hidden = true;
  resultBox.hidden = false;
  animateScore(score);
  resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------------------------------------------------------
   Error handling for API responses
   --------------------------------------------------------- */

/* HTTP 422: FastAPI returns { detail: [ { loc: ["body","Age"], msg: "..." }, ... ] } */
function handleValidationError(responseBody) {
  const messages = [];
  const detail = responseBody && Array.isArray(responseBody.detail) ? responseBody.detail : [];

  detail.forEach((issue) => {
    // The field name is the last item of `loc`, e.g. ["body", "Age"]
    const fieldName = Array.isArray(issue.loc) ? issue.loc[issue.loc.length - 1] : null;
    const knownField = FIELDS.find((field) => field.name === fieldName);

    if (knownField) {
      showFieldError(knownField.name, issue.msg);
      messages.push(`${knownField.label}: ${issue.msg}`);
    } else {
      messages.push(issue.msg || "Unknown validation problem.");
    }
  });

  showAlert(
    "Some inputs were rejected by the server",
    "Please correct the highlighted fields and try again.",
    messages
  );
}

/* ---------------------------------------------------------
   Submit handler – the main flow
   --------------------------------------------------------- */

async function handleSubmit(event) {
  event.preventDefault(); // 1. stop the normal form submission

  if (isSubmitting) return; // prevent multiple submissions

  clearAllErrors();
  hideResult();

  // Client-side validation
  const errors = validateForm();
  const errorFields = Object.keys(errors);
  if (errorFields.length > 0) {
    errorFields.forEach((name) => showFieldError(name, errors[name]));
    showAlert(
      "Please check your answers",
      "Some fields are missing or outside the allowed range.",
      errorFields.map((name) => errors[name])
    );
    getFieldWrapper(errorFields[0]).scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // 2-4. Collect values, convert numbers, build JSON with exact backend names
  const formData = buildPayload();

  setLoading(true);

  // Abort the request if the backend takes too long, so the UI never hangs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // 5. POST to the existing FastAPI endpoint
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
      signal: controller.signal,
    });

    // Try to read JSON; error responses might not contain any
    let body = null;
    try {
      body = await response.json();
    } catch (parseError) {
      body = null;
    }

    if (response.status === 422) {
      handleValidationError(body);
      return;
    }

    if (response.status >= 500) {
      showAlert(
        "The server hit a problem",
        "The prediction service had an internal error. Please try again in a moment. If it keeps happening, check the FastAPI terminal for the error message."
      );
      return;
    }

    if (!response.ok) {
      showAlert("Request failed", `The server responded with status ${response.status}. Please try again.`);
      return;
    }

    // Read the real prediction from the API response
    const score = body ? body.predicted_mental_health_score : undefined;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      showAlert(
        "Unexpected response",
        "The server replied, but the response did not contain a valid predicted_mental_health_score."
      );
      return;
    }

    showResult(score);
  } catch (error) {
    if (error.name === "AbortError") {
      showAlert(
        "The request timed out",
        "The backend took too long to respond. Check that FastAPI is running and try again."
      );
    } else {
      // fetch() rejects with a TypeError when the server is unreachable or the browser blocks the request (CORS)
      showAlert(
        "Cannot reach the backend",
        "Please check that FastAPI is running at http://127.0.0.1:8000 (for example: uvicorn main:app --reload). If it is running, open the browser console (F12) – a CORS error there means the backend must allow requests from this page."
      );
    }
  } finally {
    // Always restore the interface, whatever happened above
    clearTimeout(timeoutId);
    setLoading(false);
  }
}

/* ---------------------------------------------------------
   Event listeners
   --------------------------------------------------------- */

form.addEventListener("submit", handleSubmit);

// Clear a field's error as soon as the user edits it
FIELDS.forEach((field) => {
  const element = document.getElementById(field.name);
  element.addEventListener("input", () => clearFieldError(field.name));
  element.addEventListener("change", () => clearFieldError(field.name));
});

// Reset button: clear errors, result and banner
form.addEventListener("reset", () => {
  clearAllErrors();
  hideResult();
  setTimeout(updateProfile, 0); // after the browser has cleared the values
});

// "Make another prediction": reset the form and scroll back to it
newPredBtn.addEventListener("click", () => {
  form.reset();
  document.getElementById("form-section").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById(FIELDS[0].name).focus({ preventScroll: true });
});

/* ---------------------------------------------------------
   Dashboard widgets: segmented buttons, sliders, live snapshot
   (display helpers only – predictions always come from the API)
   --------------------------------------------------------- */

document.querySelectorAll(".seg").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.for);
    input.value = button.dataset.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
});

function updateProfile() {
  document.querySelectorAll(".seg").forEach((button) => {
    const selected = document.getElementById(button.dataset.for).value === button.dataset.value;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll(".slider-out").forEach((output) => {
    const slider = document.getElementById(output.dataset.for);
    output.textContent = `${slider.value} h`;
    slider.style.setProperty("--pct", `${(slider.value / 24) * 100}%`);
  });
  document.querySelectorAll(".gauge").forEach((gauge) => {
    const hours = parseFloat(document.getElementById(gauge.dataset.gauge).value);
    const valid = Number.isFinite(hours) && hours >= 0;
    gauge.style.setProperty("--pct", valid ? `${Math.min(hours / 24, 1) * 100}%` : "0%");
    gauge.querySelector("b").textContent = valid ? `${hours}h` : "–";
  });
  const unlocks = document.getElementById("Daily_Unlocks").value;
  document.getElementById("chip-unlocks").textContent = `${unlocks === "" ? "–" : unlocks} unlocks a day`;
  const stress = document.getElementById("Stress_Level").value;
  const chip = document.getElementById("chip-stress");
  chip.textContent = `Stress: ${stress || "–"}`;
  chip.dataset.level = stress;
}
form.addEventListener("input", updateProfile);
form.addEventListener("change", updateProfile);
updateProfile();

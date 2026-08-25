const storageKey = "academic-site-theme";
const abstractsStorageKey = "academic-site-abstracts";
const root = document.documentElement;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const researchAnimationDuration = 200;
const researchAnimationTimers = new WeakMap();
const mathJaxReadyEvent = "academic-site-mathjax-ready";

function readSavedTheme() {
  try {
    return window.localStorage?.getItem(storageKey);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage?.setItem(storageKey, theme);
  } catch {
    return;
  }
}

function readSavedAbstracts() {
  try {
    return window.localStorage?.getItem(abstractsStorageKey);
  } catch {
    return null;
  }
}

function saveAbstracts(value) {
  try {
    window.localStorage?.setItem(abstractsStorageKey, value);
  } catch {
    return;
  }
}

function setTheme(theme) {
  root.dataset.theme = theme;
  saveTheme(theme);
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", String(theme === "dark"));
  });
}

function setAbstracts(value) {
  root.dataset.abstracts = value;
  saveAbstracts(value);
  const hidden = value === "hidden";
  document.querySelectorAll(".paper-abstract-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", String(!hidden));
    button.setAttribute(
      "aria-label",
      hidden ? "Show paper abstracts" : "Hide paper abstracts",
    );
  });
  document.querySelectorAll(".abstract-disclosure").forEach((disclosure) => {
    disclosure.setAttribute("aria-hidden", String(hidden));
  });
}

function stopResearchAnimation(details) {
  const timer = researchAnimationTimers.get(details);
  if (timer) window.clearTimeout(timer);
  researchAnimationTimers.delete(details);
  details.classList.remove("is-opening", "is-closing");
  details.style.removeProperty("--research-expanded-height");
}

function typesetResearchMath(details) {
  if (!details.querySelector('[data-has-math="true"]')) return;
  if (["waiting", "pending", "true"].includes(details.dataset.mathTypeset)) return;

  const typeset = () => {
    if (["pending", "true"].includes(details.dataset.mathTypeset)) return;
    if (typeof window.MathJax?.typesetPromise !== "function") return;

    details.dataset.mathTypeset = "pending";
    window.MathJax
      .typesetPromise([details])
      .then(() => {
        details.dataset.mathTypeset = "true";
      })
      .catch((error) => {
        details.dataset.mathTypeset = "error";
        console.error("Unable to typeset research mathematics.", error);
      });
  };

  if (typeof window.MathJax?.typesetPromise === "function") {
    typeset();
    return;
  }

  details.dataset.mathTypeset = "waiting";
  document.addEventListener(
    mathJaxReadyEvent,
    () => {
      details.dataset.mathTypeset = "";
      if (!details.hidden) typeset();
    },
    { once: true },
  );
}

function setResearchExpanded(button, details, expanded) {
  stopResearchAnimation(details);
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute(
    "aria-label",
    expanded ? "Hide research directions" : "Show research directions",
  );
  const label = button.querySelector(".research-toggle-word");
  if (label) {
    label.textContent = expanded
      ? button.dataset.lessLabel
      : button.dataset.moreLabel;
  }

  if (expanded) {
    details.hidden = false;
    typesetResearchMath(details);
  } else if (details.hidden) {
    return;
  }

  if (reducedMotionQuery.matches) {
    details.hidden = !expanded;
    return;
  }

  details.style.setProperty(
    "--research-expanded-height",
    `${details.getBoundingClientRect().height}px`,
  );
  void details.offsetHeight;
  const motionClass = expanded ? "is-opening" : "is-closing";
  details.classList.add(motionClass);

  const timer = window.setTimeout(() => {
    if (button.getAttribute("aria-expanded") === String(expanded) && !expanded) {
      details.hidden = true;
    }
    details.classList.remove(motionClass);
    details.style.removeProperty("--research-expanded-height");
    researchAnimationTimers.delete(details);
  }, researchAnimationDuration);
  researchAnimationTimers.set(details, timer);
}

const defaultTheme = root.dataset.theme === "light" ? "light" : "dark";
const savedTheme = readSavedTheme();
const initialTheme =
  savedTheme === "light" || savedTheme === "dark" ? savedTheme : defaultTheme;
setTheme(initialTheme);

if (document.querySelector(".paper-abstract-toggle")) {
  const savedAbstracts = readSavedAbstracts();
  setAbstracts(savedAbstracts === "hidden" ? "hidden" : "visible");
  window.requestAnimationFrame(() => {
    root.dataset.abstractsReady = "true";
  });
} else {
  root.dataset.abstracts = "visible";
}

document.addEventListener("click", (event) => {
  const themeButton = event.target.closest(".theme-toggle");
  if (themeButton) {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    return;
  }

  const abstractsButton = event.target.closest(".paper-abstract-toggle");
  if (abstractsButton) {
    setAbstracts(root.dataset.abstracts === "hidden" ? "visible" : "hidden");
    return;
  }

  const researchButton = event.target.closest(".research-toggle");
  if (researchButton) {
    const details = document.getElementById(researchButton.getAttribute("aria-controls"));
    if (!details) return;

    const expanded = researchButton.getAttribute("aria-expanded") === "true";
    const nextExpanded = !expanded;
    setResearchExpanded(researchButton, details, nextExpanded);
  }
});

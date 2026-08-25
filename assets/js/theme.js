const themeStorageKey = "academic-site-theme";
const root = document.documentElement;
const mathJaxReadyEvent = "academic-site-mathjax-ready";
const mathTypesetPromises = new WeakMap();
let subjectViewHideGeneration = 0;

function readSavedTheme() {
  try {
    return window.localStorage?.getItem(themeStorageKey);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage?.setItem(themeStorageKey, theme);
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

function paperElementsInTimeOrder() {
  return Array.from(document.querySelectorAll(".paper")).sort(
    (first, second) =>
      Number(first.dataset.paperOrder) - Number(second.dataset.paperOrder),
  );
}

function movePapersToSubjectGroups() {
  paperElementsInTimeOrder().forEach((paper) => {
    const subjectID = paper.dataset.subjectId;
    const target = document.querySelector(
      `.subject-paper-list[data-subject-id="${subjectID}"]`,
    );
    if (target) target.append(paper);
  });
}

function movePapersToChronologicalGroups() {
  paperElementsInTimeOrder().forEach((paper) => {
    const completionYear = paper.dataset.completionYear;
    const target = document.querySelector(
      `.paper-year-group[data-completion-year="${completionYear}"] .chronological-paper-list`,
    );
    if (target) target.append(paper);
  });
}

function subjectOverviewPanel(button) {
  return document.getElementById(button.getAttribute("aria-controls"));
}

function isPanelVisible(panel) {
  return !panel.hidden && !panel.closest(".paper-view[hidden]");
}

function finishDeferredPanelClose(panel) {
  if (panel.dataset.hideAfterMath !== "true") return;
  panel.hidden = true;
  panel.classList.remove("is-typesetting-closed");
  delete panel.dataset.hideAfterMath;
}

function typesetResearchMath(panel) {
  if (!panel.querySelector('[data-has-math="true"]')) {
    return Promise.resolve();
  }
  if (panel.dataset.mathTypeset === "true") return Promise.resolve();
  if (panel.dataset.mathTypeset === "pending") {
    return mathTypesetPromises.get(panel) || Promise.resolve();
  }

  const typeset = () => {
    if (panel.dataset.mathTypeset === "true") return Promise.resolve();
    if (panel.dataset.mathTypeset === "pending") {
      return mathTypesetPromises.get(panel) || Promise.resolve();
    }
    if (typeof window.MathJax?.typesetPromise !== "function") {
      return Promise.resolve();
    }

    panel.dataset.mathTypeset = "pending";
    const promise = window.MathJax
      .typesetPromise([panel])
      .then(() => {
        panel.dataset.mathTypeset = "true";
      })
      .catch((error) => {
        panel.dataset.mathTypeset = "error";
        console.error("Unable to typeset research mathematics.", error);
      })
      .finally(() => {
        mathTypesetPromises.delete(panel);
        finishDeferredPanelClose(panel);
      });
    mathTypesetPromises.set(panel, promise);
    return promise;
  };

  if (typeof window.MathJax?.typesetPromise === "function") return typeset();

  if (panel.dataset.mathTypeset !== "waiting") {
    panel.dataset.mathTypeset = "waiting";
    document.addEventListener(
      mathJaxReadyEvent,
      () => {
        panel.dataset.mathTypeset = "";
        if (isPanelVisible(panel)) typeset();
      },
      { once: true },
    );
  }
  return Promise.resolve();
}

function setSubjectOverviewExpanded(button, expanded) {
  const panel = subjectOverviewPanel(button);
  if (!panel) return;

  button.setAttribute("aria-expanded", String(expanded));
  if (expanded) {
    delete panel.dataset.hideAfterMath;
    panel.classList.remove("is-typesetting-closed");
    panel.hidden = false;
    typesetResearchMath(panel);
    return;
  }

  if (panel.dataset.mathTypeset === "pending") {
    panel.dataset.hideAfterMath = "true";
    panel.classList.add("is-typesetting-closed");
    return;
  }
  panel.hidden = true;
}

function closeSubjectOverviews(exceptButton = null) {
  document
    .querySelectorAll('.subject-overview-toggle[aria-expanded="true"]')
    .forEach((button) => {
      if (button !== exceptButton) setSubjectOverviewExpanded(button, false);
    });
}

function hideSubjectViewAfterTypesetting(subjectView) {
  const hideGeneration = ++subjectViewHideGeneration;
  const pendingTypesets = Array.from(
    subjectView.querySelectorAll(".subject-overview"),
  )
    .map((panel) => mathTypesetPromises.get(panel))
    .filter(Boolean);

  if (pendingTypesets.length === 0) {
    subjectView.hidden = true;
    subjectView.classList.remove("is-background-typesetting");
    subjectView.removeAttribute("aria-hidden");
    return;
  }

  subjectView.classList.add("is-background-typesetting");
  subjectView.setAttribute("aria-hidden", "true");
  Promise.allSettled(pendingTypesets).then(() => {
    if (hideGeneration !== subjectViewHideGeneration) return;
    const stillPending = Array.from(
      subjectView.querySelectorAll(".subject-overview"),
    ).some((panel) => mathTypesetPromises.has(panel));
    if (stillPending) {
      hideSubjectViewAfterTypesetting(subjectView);
      return;
    }
    if (root.dataset.paperView === "chronological") {
      subjectView.hidden = true;
    }
    subjectView.classList.remove("is-background-typesetting");
    subjectView.removeAttribute("aria-hidden");
  });
}

function setPaperView(view) {
  const chronologicalView = document.getElementById("papers-chronological");
  const subjectView = document.getElementById("papers-subject");
  const button = document.querySelector(".paper-view-toggle");
  if (!chronologicalView || !subjectView || !button) return;

  const showSubject = view === "subject";
  root.dataset.paperView = showSubject ? "subject" : "chronological";
  if (showSubject) {
    subjectViewHideGeneration += 1;
    subjectView.hidden = false;
    subjectView.classList.remove("is-background-typesetting");
    subjectView.removeAttribute("aria-hidden");
    movePapersToSubjectGroups();
    chronologicalView.hidden = true;
  } else {
    closeSubjectOverviews();
    movePapersToChronologicalGroups();
    chronologicalView.hidden = false;
    hideSubjectViewAfterTypesetting(subjectView);
  }

  const label = button.querySelector(".paper-view-toggle-label");
  if (label) {
    label.textContent = showSubject
      ? button.dataset.chronologicalLabel
      : button.dataset.subjectLabel;
  }
  button.setAttribute(
    "aria-label",
    showSubject
      ? "Currently grouped by subject. Show papers chronologically."
      : "Currently grouped chronologically. Group papers by subject.",
  );
}

const defaultTheme = root.dataset.theme === "light" ? "light" : "dark";
const savedTheme = readSavedTheme();
const initialTheme =
  savedTheme === "light" || savedTheme === "dark" ? savedTheme : defaultTheme;
setTheme(initialTheme);

if (document.querySelector(".paper-view-toggle")) {
  root.dataset.paperView = "chronological";
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const themeButton = event.target.closest(".theme-toggle");
  if (themeButton) {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    return;
  }

  const paperViewButton = event.target.closest(".paper-view-toggle");
  if (paperViewButton) {
    setPaperView(
      root.dataset.paperView === "subject" ? "chronological" : "subject",
    );
    return;
  }

  const subjectButton = event.target.closest(".subject-overview-toggle");
  if (subjectButton) {
    const expanded = subjectButton.getAttribute("aria-expanded") === "true";
    if (!expanded) closeSubjectOverviews(subjectButton);
    setSubjectOverviewExpanded(subjectButton, !expanded);
  }
});

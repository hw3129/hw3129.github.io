const themeStorageKey = "academic-site-theme";
const root = document.documentElement;
const mathJaxReadyEvent = "academic-site-mathjax-ready";
const mathTypesetPromises = new WeakMap();
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let subjectViewHideGeneration = 0;

function trackPaperEvent(action, element) {
  const paperID = element.closest(".paper")?.dataset.paperId;
  if (!paperID || typeof window.cronitor !== "function") return;
  try {
    window.cronitor("track", `${action}.${paperID}`);
  } catch {
    // Analytics failures must not interrupt links or summary controls.
  }
}

function trackPaperLink(event) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest(".paper-title-link");
  if (link) trackPaperEvent("paper_click", link);
}

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

function movePapersToChronologicalList() {
  const target = document.querySelector(
    "#papers-chronological .chronological-paper-list",
  );
  if (!target) return;
  paperElementsInTimeOrder().forEach((paper) => {
    target.append(paper);
  });
}

function subjectOverviewPanel(button) {
  return document.getElementById(button.getAttribute("aria-controls"));
}

function isPanelVisible(panel) {
  return (
    panel.classList.contains("is-open") &&
    !panel.closest(".paper-view[hidden]")
  );
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
  panel.setAttribute("aria-hidden", String(!expanded));
  panel.toggleAttribute("inert", !expanded);
  panel.classList.toggle("is-open", expanded);
  if (expanded) {
    typesetResearchMath(panel);
  }
}

function closeSubjectOverviews(exceptButton = null) {
  document
    .querySelectorAll('.subject-overview-toggle[aria-expanded="true"]')
    .forEach((button) => {
      if (button !== exceptButton) setSubjectOverviewExpanded(button, false);
    });
}

function setPaperSummaryExpanded(button, expanded) {
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  if (!panel) return;

  const wasExpanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(expanded));
  panel.setAttribute("aria-hidden", String(!expanded));
  panel.toggleAttribute("inert", !expanded);
  panel.classList.toggle("is-open", expanded);
  panel.closest(".paper")?.classList.toggle("is-summary-open", expanded);
  if (expanded) {
    if (!wasExpanded) trackPaperEvent("summary_open", button);
    typesetResearchMath(panel);
  }
}

function closePaperSummaries(exceptButton = null) {
  document
    .querySelectorAll('.paper-summary-toggle[aria-expanded="true"]')
    .forEach((button) => {
      if (button !== exceptButton) setPaperSummaryExpanded(button, false);
    });
}

function preloadPaperFigure(event) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest(".paper-summary-toggle");
  button
    ?.closest(".paper")
    ?.querySelectorAll(".paper-figure img[loading='lazy']")
    .forEach((image) => {
      image.loading = "eager";
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

function animatePaperViewEntry(view) {
  view.classList.remove("is-view-entering");
  if (reducedMotionQuery.matches) return;
  void view.offsetWidth;
  view.classList.add("is-view-entering");
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
    movePapersToChronologicalList();
    chronologicalView.hidden = false;
    hideSubjectViewAfterTypesetting(subjectView);
  }
  animatePaperViewEntry(showSubject ? subjectView : chronologicalView);

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

document.querySelectorAll(".subject-overview, .paper-summary").forEach((panel) => {
  panel.setAttribute("aria-hidden", "true");
  panel.setAttribute("inert", "");
  panel.hidden = false;
});

if (document.querySelector(".paper-view-toggle")) {
  root.dataset.paperView = "chronological";
}

document.addEventListener("animationend", (event) => {
  if (
    event.animationName === "paper-view-enter" &&
    event.target instanceof Element
  ) {
    event.target.classList.remove("is-view-entering");
  }
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.button === 0) trackPaperLink(event);

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

  const paperSummaryButton = event.target.closest(".paper-summary-toggle");
  if (paperSummaryButton) {
    const expanded = paperSummaryButton.getAttribute("aria-expanded") === "true";
    if (!expanded) closePaperSummaries(paperSummaryButton);
    setPaperSummaryExpanded(paperSummaryButton, !expanded);
    return;
  }

  const subjectButton = event.target.closest(".subject-overview-toggle");
  if (subjectButton) {
    const expanded = subjectButton.getAttribute("aria-expanded") === "true";
    if (!expanded) closeSubjectOverviews(subjectButton);
    setSubjectOverviewExpanded(subjectButton, !expanded);
  }
});

document.addEventListener("auxclick", (event) => {
  if (event.button === 1) trackPaperLink(event);
});

document.addEventListener("pointerover", preloadPaperFigure);
document.addEventListener("focusin", preloadPaperFigure);

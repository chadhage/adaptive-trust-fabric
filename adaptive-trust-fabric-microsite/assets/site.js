(() => {
  "use strict";

  const storageKey = "adaptive-trust-fabric.theme";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const isTheme = value => value === "light" || value === "dark";
  let storageAvailable = true;

  function reportStorageError(error) {
    if (!(error instanceof DOMException) ||
        !["SecurityError", "QuotaExceededError"].includes(error.name)) {
      throw error;
    }
    storageAvailable = false;
    console.warn("The theme preference could not be saved in browser storage.", error);
  }

  function readPreference() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null && !isTheme(saved)) {
        console.warn("Ignoring an unsupported saved theme preference.");
        return null;
      }
      return saved;
    } catch (error) {
      reportStorageError(error);
      return null;
    }
  }

  function savePreference(theme) {
    try {
      if (theme === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, theme);
      storageAvailable = true;
    } catch (error) {
      reportStorageError(error);
    }
  }

  let preference = readPreference();
  const requested = new URLSearchParams(window.location.search).get("clawpilotTheme");
  if (isTheme(requested)) {
    preference = requested;
    savePreference(preference);
  } else if (requested !== null) {
    console.warn("Ignoring an unsupported clawpilotTheme value; use light or dark.");
  }

  function renderTheme() {
    const theme = preference || (systemTheme.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(control => {
      control.setAttribute("aria-checked", String(theme === "dark"));
      const state = control.querySelector("[data-theme-state]");
      if (state) state.textContent = theme === "dark" ? "On" : "Off";
    });
    document.querySelectorAll("[data-theme-system]").forEach(control => {
      control.disabled = preference === null;
    });
    document.querySelectorAll("[data-theme-status]").forEach(status => {
      status.textContent = !storageAvailable
        ? `Using ${theme} theme on this page. Browser storage is unavailable; the preference is not saved.`
        : preference === null
          ? `Using the system theme (${theme}).`
          : `Using the saved ${theme} theme.`;
    });
  }

  function chooseTheme(theme) {
    if (theme !== null && !isTheme(theme)) throw new TypeError("Unsupported theme.");
    preference = theme;
    savePreference(theme);
    const url = new URL(window.location.href);
    if (url.searchParams.has("clawpilotTheme")) {
      if (theme === null) url.searchParams.delete("clawpilotTheme");
      else url.searchParams.set("clawpilotTheme", theme);
      window.history.replaceState(null, "", url);
    }
    renderTheme();
  }

  renderTheme();
  systemTheme.addEventListener("change", () => {
    if (preference === null) renderTheme();
  });

  function initialize() {
    document.querySelectorAll("[data-theme-toggle]").forEach(control => {
      control.disabled = false;
      control.addEventListener("click", () => {
        chooseTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });
    document.querySelectorAll("[data-theme-system]").forEach(control => {
      control.addEventListener("click", () => {
        chooseTheme(null);
        const toggle = document.querySelector("[data-theme-toggle]");
        if (toggle instanceof HTMLButtonElement) toggle.focus();
      });
    });
    renderTheme();

    const trigger = document.querySelector("#menu-toggle");
    const drawer = document.querySelector("#site-menu");
    const close = document.querySelector("#menu-close");
    if (!trigger && !drawer && !close) return;
    if (!(trigger instanceof HTMLButtonElement) ||
        !(drawer instanceof HTMLDialogElement) ||
        !(close instanceof HTMLButtonElement)) {
      throw new Error("The navigation drawer markup is incomplete.");
    }

    trigger.addEventListener("click", () => {
      drawer.showModal();
      drawer.scrollTop = 0;
      trigger.setAttribute("aria-expanded", "true");
      document.body.classList.add("drawer-open");
    });
    close.addEventListener("click", () => drawer.close());
    drawer.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      drawer.close();
    });
    drawer.addEventListener("close", () => {
      trigger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("drawer-open");
      trigger.focus();
    });
    drawer.addEventListener("click", event => {
      if (event.target !== drawer) return;
      const bounds = drawer.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) {
        drawer.close();
      }
    });
    drawer.querySelectorAll("a[href]").forEach(link => {
      link.addEventListener("click", () => drawer.close());
    });
    trigger.hidden = false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();

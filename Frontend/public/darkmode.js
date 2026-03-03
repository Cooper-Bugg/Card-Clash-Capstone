/*
Dark mode toggle — persists preference to localStorage.
Include this script on every page. The button with id="darkModeBtn"
will toggle the "dark-mode" class on <body> and update its own label.
*/
(function () {
  const STORAGE_KEY = "cardClashDarkMode";

  function applyMode(isDark) {
    document.body.classList.toggle("dark-mode", isDark);
    const btn = document.getElementById("darkModeBtn");
    if (btn) {
      btn.textContent = isDark ? "Light Mode" : "Dark Mode";
    }
  }

  // Apply saved preference before paint to avoid flash
  const saved = localStorage.getItem(STORAGE_KEY);
  const prefersDark = saved === "true";
  // Apply immediately if body already exists (deferred script), else on DOMContentLoaded
  if (document.body) {
    applyMode(prefersDark);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      applyMode(prefersDark);
    });
  }

  // Wire the button after DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("darkModeBtn");
    if (!btn) { return; }
    btn.addEventListener("click", function () {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem(STORAGE_KEY, String(isDark));
      btn.textContent = isDark ? "Light Mode" : "Dark Mode";
    });
  });
})();

/**
 * AR Menu Platform — Global Theme Manager (Light & Dark Mode)
 * Ensures zero-FOUC theme loading, persistence via localStorage,
 * and attaches toggle handlers to all #themeToggleBtn elements.
 */

(function () {
  const SAVED_THEME_KEY = 'armenu_theme';
  const BITE_THEME_KEY = 'bite-theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(SAVED_THEME_KEY) || localStorage.getItem(BITE_THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    const isLight = theme === 'light';
    const docEl = document.documentElement;
    const bodyEl = document.body;

    // Apply class & attribute to ensure full site coverage
    if (isLight) {
      docEl.classList.add('theme-light');
      if (bodyEl) bodyEl.classList.add('theme-light');
      docEl.setAttribute('data-theme', 'light');
    } else {
      docEl.classList.remove('theme-light');
      if (bodyEl) bodyEl.classList.remove('theme-light');
      docEl.setAttribute('data-theme', 'dark');
    }

    localStorage.setItem(SAVED_THEME_KEY, theme);
    localStorage.setItem(BITE_THEME_KEY, theme);
    updateToggleIcons(isLight);
  }

  function updateToggleIcons(isLight) {
    const buttons = document.querySelectorAll('#themeToggleBtn, .theme-toggle-btn');
    buttons.forEach((btn) => {
      const sunIcon = btn.querySelector('.sun-icon');
      const moonIcon = btn.querySelector('.moon-icon');

      if (isLight) {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
        btn.setAttribute('title', 'Switch to Dark Theme');
        btn.setAttribute('aria-label', 'Switch to Dark Theme');
      } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
        btn.setAttribute('title', 'Switch to Light Theme');
        btn.setAttribute('aria-label', 'Switch to Light Theme');
      }
    });

    const landingIcon = document.getElementById('themeToggleIcon');
    if (landingIcon) {
      landingIcon.textContent = isLight ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    const current = (document.documentElement.classList.contains('theme-light') || document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
    const nextTheme = current === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
  }

  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  function initDOM() {
    applyTheme(getPreferredTheme());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#themeToggleBtn, .theme-toggle-btn, [onclick*="toggleTheme"]');
      if (btn) {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOM);
  } else {
    initDOM();
  }

  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;
})();


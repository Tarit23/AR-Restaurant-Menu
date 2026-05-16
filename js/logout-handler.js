import { supabase } from './supabase-config.js?v=2';

/**
 * Robust logout handler that clears session and redirects to login.
 */
export async function handleLogout() {
  try {
    // Show a loading state on the button if possible
    const logoutBtns = document.querySelectorAll('#logoutBtn');
    logoutBtns.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = 'Signing out...';
    });

    // Sign out from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.auth.signOut();
    }

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Redirect to login page
    // Using origin ensures we go back to the root login.html
    window.location.href = window.location.origin + '/login.html';
  } catch (err) {
    console.error('Logout failed:', err);
    // Fallback redirect even on error
    window.location.href = window.location.origin + '/login.html';
  }
}

// Global delegated click handler for all logout buttons
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#logoutBtn');
  if (btn) {
    e.preventDefault();
    await handleLogout();
  }
});

// Also expose to window for any inline calls (though we prefer the delegated listener)
window.handleLogout = handleLogout;

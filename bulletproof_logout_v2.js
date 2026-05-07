
const fs = require('fs');
const path = require('path');

const files = [
  'admin/index.html',
  'admin/menu.html',
  'admin/restaurants.html',
  'admin/payments.html',
  'admin/qr.html',
  'restaurant/index.html',
  'restaurant/menu.html',
  'restaurant/subscription.html',
  'restaurant/qr.html'
];

const criticalStyles = `
  <style id="critical-logout-styles">
    .sidebar-footer { margin-top: auto; padding: 12px; border-top: 1px solid var(--border); }
    .btn-logout { 
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; 
      padding: 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); 
      border-radius: var(--radius-md); color: #ef4444; font-size: 0.85rem; font-weight: 600; 
      cursor: pointer; transition: all 0.2s; 
    }
    .btn-logout:hover { background: #ef4444; color: #fff; border-color: #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
  </style>
`;

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Add Critical Styles to Head
  if (!content.includes('critical-logout-styles')) {
    content = content.replace('</head>', criticalStyles + '\n</head>');
  }

  // 2. Standardize Sidebar Footer HTML (Ensure it exists)
  const isAltRole = file.includes('admin/');
  const avatar = isAltRole ? 'A' : 'R';
  const roleTitle = isAltRole ? 'Super Admin' : 'Restaurant Owner';
  const nameId = isAltRole ? 'adminName' : 'restaurantName';
  
  const footerHtml = `    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar" id="avatarInitial">${avatar}</div>
        <div style="flex:1; min-width:0;">
          <div class="user-name" id="${nameId}">Loading...</div>
          <div class="user-role">${roleTitle}</div>
        </div>
      </div>
      <div class="sidebar-logout">
        <button class="btn-logout" id="logoutBtn" type="button" onclick="window.handleLogout()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </div>`;

  if (content.includes('sidebar-footer')) {
    content = content.replace(/<div class="sidebar-footer">[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/, footerHtml + '\n  </aside>');
  } else {
    // Inject before the end of sidebar
    content = content.replace('</aside>', footerHtml + '\n  </aside>');
  }

  // 3. Standardize Script Logic
  // Expose handleLogout immediately
  const globalHandler = `
  // --- EXPLICIT GLOBAL LOGOUT ---
  window.handleLogout = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    try {
      // Direct call to avoid any authManager dependency issues
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = window.location.origin + '/login.html';
    } catch (err) {
      console.error('Logout failed:', err);
      window.location.href = window.location.origin + '/login.html';
    }
  };
  `;

  // Remove previous listener attempts
  content = content.replace(/\/\/ Global Logout Handler[\s\S]*?\}\);\s*\}\);\s*/g, '');
  content = content.replace(/\/\/ --- EXPLICIT GLOBAL LOGOUT ---[\s\S]*?\};/g, '');

  // Inject at the very start of the module script
  content = content.replace('<script type="module">', '<script type="module">\n' + globalHandler);

  // 4. Fix initialization crashes (Handle empty array / null)
  content = content.replace(
    /if \(!profile\.restaurants\) \{[\s\S]*?throw new Error\('No restaurant linked'\);\s*\}/,
    `if (!profile.restaurants || (Array.isArray(profile.restaurants) && profile.restaurants.length === 0)) {
        console.warn('User has no linked restaurant. Redirecting to pending...');
        window.location.href = '../pending.html';
        return;
    }`
  );

  content = content.replace(
    'const restaurant = profile.restaurants;',
    'const restaurant = Array.isArray(profile.restaurants) ? profile.restaurants[0] : profile.restaurants;'
  );

  fs.writeFileSync(fullPath, content);
  console.log(`Deep fixed ${file}`);
});

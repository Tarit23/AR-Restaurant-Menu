
const fs = require('fs');
const path = require('path');

const files = [
  'admin/menu.html',
  'admin/restaurants.html',
  'admin/payments.html',
  'admin/qr.html',
  'restaurant/menu.html',
  'restaurant/subscription.html',
  'restaurant/qr.html'
];

const sidebarFooterOld = /<div class="sidebar-footer">[\s\S]*?<\/aside>/;
const sidebarFooterNew = `    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar" id="avatarInitial">U</div>
        <div style="flex:1; min-width:0;">
          <div class="user-name" id="userNameDisplay">User</div>
          <div class="user-role" id="userRoleDisplay">Role</div>
        </div>
      </div>
      <div class="sidebar-logout">
        <button class="btn-logout" id="logoutBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </div>
  </aside>`;

const jsSignOutOld = /document\.getElementById\('sidebarUserBtn'\)\.addEventListener\('click'[\s\S]*?\}\);/;
const jsSignOutNew = `    document.getElementById('logoutBtn').addEventListener('click', async () => {
      if (confirm('Sign out?')) {
        await supabase.auth.signOut();
        window.location.href = window.location.origin + '/login.html';
      }
    });`;

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Update HTML
  content = content.replace(sidebarFooterOld, sidebarFooterNew);
  
  // Update JS
  content = content.replace(jsSignOutOld, jsSignOutNew);
  
  // Fix IDs for dynamic display
  if (file.includes('admin/')) {
    content = content.replace('userNameDisplay', 'adminName');
    content = content.replace('userRoleDisplay', 'Admin Role');
    content = content.replace('Role', 'Super Admin');
  } else {
    content = content.replace('userNameDisplay', 'restaurantName');
    content = content.replace('userRoleDisplay', 'Owner Role');
    content = content.replace('Role', 'Restaurant Owner');
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file}`);
});

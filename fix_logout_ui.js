
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

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  if (file.includes('admin/')) {
    const footer = `    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar" id="avatarInitial">A</div>
        <div style="flex:1; min-width:0;">
          <div class="user-name" id="adminName">Admin</div>
          <div class="user-role">Super Admin</div>
        </div>
      </div>
      <div class="sidebar-logout">
        <button class="btn-logout" id="logoutBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </div>`;
    content = content.replace(/<div class="sidebar-footer">[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/, footer + '\n  </aside>');
  } else {
    const footer = `    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar" id="avatarInitial">R</div>
        <div style="flex:1; min-width:0;">
          <div class="user-name" id="restaurantName">Loading...</div>
          <div class="user-role">Restaurant Owner</div>
        </div>
      </div>
      <div class="sidebar-logout">
        <button class="btn-logout" id="logoutBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign Out
        </button>
      </div>
    </div>`;
    content = content.replace(/<div class="sidebar-footer">[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/, footer + '\n  </aside>');
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Fixed ${file}`);
});

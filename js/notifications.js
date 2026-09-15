import { supabase } from './supabase-config.js?v=5';
import { realtimeManager } from './realtime.js?v=5';
import { showToast } from './utils.js?v=5';

/**
 * Shared Notifications Controller
 */
class NotificationsController {
  constructor() {
    this.unreadCount = 0;
  }

  init(restaurantId) {
    if (!restaurantId) return;
    
    // 1. Fetch unread counts and initialize bell
    this.loadUnreadNotifications(restaurantId);

    // 2. Subscribe to realtime notifications
    realtimeManager.subscribeToChanges(restaurantId, 'notifications', (payload) => {
      if (payload.eventType === 'INSERT') {
        const newNotif = payload.new;
        showToast(`🔔 ${newNotif.title}: ${newNotif.message}`, 'info');
        this.incrementBadge();
        
        // Play audio chime if allowed
        try {
          const audio = new Audio('/audio/chime.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}

        // Custom dispatch event for dashboards to re-fetch notifications feeds
        window.dispatchEvent(new CustomEvent('new-notification', { detail: newNotif }));
      }
    });

    this.renderBellUI();
  }

  async loadUnreadNotifications(restaurantId) {
    try {
      const { data, count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('is_read', false);

      if (!error) {
        this.unreadCount = count || 0;
        this.updateBadge();
      }
    } catch (e) {
      console.error(e);
    }
  }

  incrementBadge() {
    this.unreadCount++;
    this.updateBadge();
  }

  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  renderBellUI() {
    // Check if bell element already exists
    if (document.getElementById('notifBellContainer')) return;

    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Create bell HTML element
    const container = document.createElement('div');
    container.id = 'notifBellContainer';
    container.style.cssText = `
      position: relative;
      margin-left: auto;
      margin-right: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      transition: all 0.2s;
    `;
    container.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary);"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
      <span id="notifBadge" style="
        display: none;
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ef4444;
        color: white;
        font-size: 0.65rem;
        font-weight: 800;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--bg-card);
      ">0</span>
    `;

    container.addEventListener('click', () => this.toggleNotificationDrawer());
    topbar.appendChild(container);
  }

  toggleNotificationDrawer() {
    // Show sliding drawer with recent notifications feed
    let drawer = document.getElementById('notifDrawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'notifDrawer';
      drawer.style.cssText = `
        position: fixed;
        top: 0;
        right: -360px;
        width: 320px;
        height: 100vh;
        background: var(--bg-card);
        border-left: 1px solid var(--border);
        box-shadow: var(--shadow-2xl);
        z-index: 2500;
        transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        padding: 20px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 16px;
      `;
      document.body.appendChild(drawer);
    }

    if (drawer.classList.contains('open')) {
      drawer.style.right = '-360px';
      drawer.classList.remove('open');
    } else {
      this.renderNotificationList(drawer);
      drawer.style.right = '0';
      drawer.classList.add('open');
    }
  }

  async renderNotificationList(drawer) {
    drawer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:12px;">
        <h3 style="margin:0; font-size:1.1rem; color:#fff;">Notifications</h3>
        <button onclick="document.getElementById('notifDrawer').style.right='-360px'; document.getElementById('notifDrawer').classList.remove('open');" style="background:none; border:none; color:var(--text-muted); font-size:1.4rem; cursor:pointer;">×</button>
      </div>
      <div id="notifListContainer" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
        <p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Loading notifications...</p>
      </div>
      <button id="markAllReadBtn" class="btn btn-secondary btn-sm" style="width:100%;">Mark All as Read</button>
    `;

    const list = document.getElementById('notifListContainer');
    const { data: profile } = await supabase.auth.getSession();
    const { data: userProfile } = await supabase.from('users').select('restaurant_id').eq('id', profile?.session?.user?.id).single();
    if (!userProfile) return;

    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('restaurant_id', userProfile.restaurant_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !notifs || notifs.length === 0) {
      list.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding-top:20px;">No notifications yet.</p>`;
      return;
    }

    list.innerHTML = notifs.map(n => {
      const readStyle = n.is_read ? 'opacity: 0.6;' : 'border-left: 3px solid var(--primary);';
      const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="background:var(--bg-elevated); padding:10px; border-radius:8px; border:1px solid var(--border); ${readStyle} font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:4px;">
            <span>${n.title}</span>
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">${timeStr}</span>
          </div>
          <div style="color:var(--text-secondary); line-height:1.4;">${n.message}</div>
        </div>
      `;
    }).join('');

    document.getElementById('markAllReadBtn').addEventListener('click', async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('restaurant_id', userProfile.restaurant_id);

      this.unreadCount = 0;
      this.updateBadge();
      this.toggleNotificationDrawer(); // Close it
      showToast("All notifications marked as read.", "success");
    });
  }
}

export const notificationsController = new NotificationsController();

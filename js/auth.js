import { supabase } from './supabase-config.js?v=2';

// =====================================================
// AUTH MODULE
// =====================================================

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentProfile = null;
  }

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const profile = await this.loadProfile(data.user.id);
      
      // Trigger login confirmation email in background (non-blocking)
      this.notifyLogin(email).catch(() => {});

      return { user: data.user, profile };
    } catch (error) {
      throw error;
    }
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
    this.currentProfile = null;
  }

  async loadProfile(userId, retryCount = 0) {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, restaurants(*)')
        .eq('id', userId)
        .maybeSingle(); 
      
      if (error) {
        console.warn('Profile fetch error:', error.message);
        return null;
      }
      
      if (!data && retryCount < 2) {
        console.log(`Profile not found, retrying... (${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, 400));
        return this.loadProfile(userId, retryCount + 1);
      }
      
      this.currentProfile = data || { id: userId, role: 'restaurant' };
      return this.currentProfile;
    } catch (err) {
      console.error('Critical profile loading failure:', err);
      this.currentProfile = null;
      return null;
    }
  }

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      const profile = await this.loadProfile(session.user.id);
      
      // If profile is still missing after retries, try to initialize it
      if (!profile) {
        console.log('Profile missing after load, attempting initialization...');
        await this.ensureProfile();
        await this.loadProfile(session.user.id);
      }
    }
    return session;
  }

  async ensureProfile() {
    try {
      const { data, error } = await supabase.functions.invoke('init-user-profile');
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to ensure profile:', err);
      return null;
    }
  }

  async requireAuth(allowedRoles = null) {
    const session = await this.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    
    const userRole = this.currentProfile?.role;
    if (userRole === 'super_admin') {
      return this.currentProfile;
    }

    if (allowedRoles) {
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!rolesArray.includes(userRole)) {
        window.location.href = '/unauthorized.html';
        return null;
      }
    }
    return this.currentProfile;
  }

  async createRestaurantUser(email, password, restaurantId, role = 'restaurant_owner') {
    // Calls the admin-create-restaurant or manage-staff edge function instead of direct admin API
    const session = await this.getSession();
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/manage-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': session.access_token
      },
      body: JSON.stringify({
        action: 'create',
        restaurantId,
        email,
        name: 'Staff Member',
        password,
        role
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to create user");
    return result;
  }

  isAdmin() {
    return this.currentProfile?.role === 'super_admin';
  }

  isRestaurant() {
    return this.currentProfile?.role === 'restaurant_owner' || this.currentProfile?.role === 'restaurant';
  }

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/index.html',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      }
    });
    if (error) throw error;
    return data;
  }

  async notifyLogin(email) {
    try {
      // Get user agent and generic IP info
      const device = navigator.userAgent.substring(0, 50) + '...';
      
      await supabase.functions.invoke('user-login-notify', {
        body: { email, device, ip: 'Detecting...' }
      });
    } catch (err) {
      console.warn('Could not send login notification:', err);
    }
  }

  async signUpRestaurant(data) {
    try {
      const { data: result, error } = await supabase.functions.invoke('public-signup-restaurant', {
        body: data
      });
      
      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Perform standard sign-in so session is established
      await this.signIn(data.email, data.password);
      return result;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  }
}

const authManager = new AuthManager();
export default authManager;
export { authManager };

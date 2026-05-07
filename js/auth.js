import { supabase } from './supabase-config.js';

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
      
      // Trigger login notification for restaurant owners
      if (profile.role === 'restaurant') {
        this.notifyLogin(email);
      }

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
      
      if (!data && retryCount < 3) {
        console.log(`Profile not found, retrying... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 800)); // Wait 800ms
        return this.loadProfile(userId, retryCount + 1);
      }
      
      this.currentProfile = data || null;
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
      await this.loadProfile(session.user.id);
    }
    return session;
  }

  async requireAuth(role = null) {
    const session = await this.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }
    if (role && this.currentProfile?.role !== role && this.currentProfile?.role !== 'super_admin') {
      window.location.href = '/unauthorized.html';
      return null;
    }
    return this.currentProfile;
  }

  async createRestaurantUser(email, password, restaurantId, role = 'restaurant') {
    // This should be called from admin panel via Supabase admin SDK or Edge Function
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { role, restaurant_id: restaurantId }
    });
    if (error) throw error;
    return data;
  }

  isAdmin() {
    return this.currentProfile?.role === 'super_admin';
  }

  isRestaurant() {
    return this.currentProfile?.role === 'restaurant';
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

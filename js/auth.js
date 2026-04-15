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
      await this.loadProfile(data.user.id);
      return { user: data.user, profile: this.currentProfile };
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

  async loadProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*, restaurants(*)')
      .eq('id', userId)
      .single();
    if (error) throw error;
    this.currentProfile = data;
    return data;
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
}

const authManager = new AuthManager();
export default authManager;
export { authManager };

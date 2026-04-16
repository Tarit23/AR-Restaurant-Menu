import { supabase, APP_CONFIG } from './supabase-config.js';
import { uploadFile } from './utils.js';

// =====================================================
// RESTAURANTS API
// =====================================================

export const restaurantsAPI = {
  async getAll() {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(restaurantData) {
    const { data, error } = await supabase
      .from('restaurants')
      .insert([restaurantData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createWithAuth(payload) {
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const { data, error } = await supabase.functions.invoke('admin-create-restaurant', {
      body: payload,
      headers: {
        'x-user-token': token // Custom header to bypass Gateway JWT algorithm mismatch
      }
    });
    
    // If invoke fails with a non-2xx, 'error' is a FunctionsHttpError
    if (error) {
      console.error('Edge Function Error:', error);
      // Try to parse error from response body
      try {
        const body = await error.context.json();
        if (body.error) throw new Error(body.error);
      } catch (parseErr) {
        throw error;
      }
      throw error;
    }
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getStats() {
    const { data, error } = await supabase
      .from('restaurants')
      .select('subscription_status, plan');
    if (error) throw error;

    const total = data.length;
    const active = data.filter(r => r.subscription_status === 'active').length;
    const expired = data.filter(r => r.subscription_status === 'expired').length;

    return { total, active, expired };
  }
};

// =====================================================
// MENU ITEMS API
// =====================================================

export const menuAPI = {
  async getByRestaurant(restaurantId) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*, restaurants(name, subscription_status)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(itemData) {
    const { data, error } = await supabase
      .from('menu_items')
      .insert([itemData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadImage(file, restaurantId) {
    const ext = file.name.split('.').pop();
    const path = `${restaurantId}/images/${Date.now()}.${ext}`;
    return uploadFile(supabase, 'menu-images', file, path);
  },

  async uploadModel(file, restaurantId) {
    const path = `${restaurantId}/models/${Date.now()}.glb`;
    return uploadFile(supabase, 'menu-models', file, path);
  },

  async toggleAvailability(id, currentState) {
    return menuAPI.update(id, { is_available: !currentState });
  }
};

// =====================================================
// USERS API
// =====================================================

export const usersAPI = {
  async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByRestaurant(restaurantId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
    return data;
  },

  async getProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*, restaurants(*)')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }
};

// =====================================================
// PAYMENTS API (via Edge Functions)
// =====================================================

export const paymentsAPI = {
  async createCustomer(restaurantId, email, name) {
    const { data, error } = await supabase.functions.invoke('create-razorpay-customer', {
      body: { restaurantId, email, name }
    });
    if (error) throw error;
    return data;
  },

  async createSubscription(restaurantId, planId, customerId) {
    const { data, error } = await supabase.functions.invoke('create-razorpay-subscription', {
      body: { restaurantId, planId, customerId }
    });
    if (error) throw error;
    return data;
  },

  async getSubscriptionStatus(restaurantId) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('subscription_status, next_payment_date, autopay_enabled, razorpay_subscription_id, plan')
      .eq('id', restaurantId)
      .single();
    if (error) throw error;
    return data;
  },

  async cancelSubscription(restaurantId) {
    const { data, error } = await supabase.functions.invoke('cancel-razorpay-subscription', {
      body: { restaurantId }
    });
    if (error) throw error;
    return data;
  },

  async getPaymentHistory(restaurantId) {
    // These would come from a payments table populated by webhooks
    const { data, error } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error) return []; // graceful fallback
    return data;
  },

  async getAllPaymentLogs() {
    const { data, error } = await supabase
      .from('payment_logs')
      .select('*, restaurants(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return data;
  }
};

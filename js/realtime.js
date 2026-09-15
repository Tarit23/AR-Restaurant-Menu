import { supabase } from './supabase-config.js?v=5';

/**
 * Centralized Real-time Subscriptions Manager
 */
class RealtimeManager {
  constructor() {
    this.channels = {};
  }

  /**
   * Subscribe to restaurant-specific table changes
   */
  subscribeToChanges(restaurantId, tableName, callback) {
    const channelKey = `${tableName}_sync_${restaurantId}`;
    
    if (this.channels[channelKey]) {
      console.log(`Already subscribed to realtime ${tableName} for restaurant ${restaurantId}`);
      return this.channels[channelKey];
    }

    console.log(`Subscribing to realtime ${tableName} for restaurant ${restaurantId}`);
    
    // Create channel filtered by restaurant_id
    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Realtime status for ${tableName} (${restaurantId}):`, status);
      });

    this.channels[channelKey] = channel;
    return channel;
  }

  unsubscribe(restaurantId, tableName) {
    const channelKey = `${tableName}_sync_${restaurantId}`;
    if (this.channels[channelKey]) {
      supabase.removeChannel(this.channels[channelKey]);
      delete this.channels[channelKey];
      console.log(`Unsubscribed from ${channelKey}`);
    }
  }

  unsubscribeAll() {
    Object.keys(this.channels).forEach(key => {
      supabase.removeChannel(this.channels[key]);
    });
    this.channels = {};
    console.log("Unsubscribed from all realtime channels");
  }
}

export const realtimeManager = new RealtimeManager();

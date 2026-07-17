// =====================================================
// LOYALTY API  ·  js/loyalty-api.js
// Complete client-side API for the loyalty system
// =====================================================
import { supabase } from './supabase-config.js';

const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTMzNzIsImV4cCI6MjA5MTc4OTM3Mn0.wIhnSy1L-U9s-BH4UB7KE6Wf3nt-PyGyaKutMMsv0tk';

/* ─── Session helpers ─── */

export const loyaltySession = {
  set(data) { localStorage.setItem('loyalty_session', JSON.stringify(data)); },
  get()     { try { return JSON.parse(localStorage.getItem('loyalty_session')); } catch { return null; } },
  clear()   { localStorage.removeItem('loyalty_session'); },
  is(restaurantId) {
    const s = this.get();
    return s && s.restaurant_id === restaurantId ? s : null;
  }
};

/* ─── Tier helpers ─── */

export const TIERS = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', bg: 'rgba(205,127,50,0.15)',  shadow: 'rgba(205,127,50,0.3)',  icon: '🥉', min: 0    },
  silver:   { label: 'Silver',   color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', shadow: 'rgba(148,163,184,0.3)', icon: '🥈', min: 500  },
  gold:     { label: 'Gold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  shadow: 'rgba(245,158,11,0.3)',  icon: '🥇', min: 2000 },
  platinum: { label: 'Platinum', color: '#e2e8f0', bg: 'rgba(226,232,240,0.15)', shadow: 'rgba(226,232,240,0.4)', icon: '💎', min: 5000 }
};

export function getTier(totalPointsEarned, settings) {
  const s = settings || {};
  if (totalPointsEarned >= (s.tier_platinum_min || 5000)) return 'platinum';
  if (totalPointsEarned >= (s.tier_gold_min    || 2000)) return 'gold';
  if (totalPointsEarned >= (s.tier_silver_min  || 500))  return 'silver';
  return 'bronze';
}

export function getNextTier(tier, settings) {
  const s = settings || {};
  const map = { bronze: ['silver', s.tier_silver_min || 500], silver: ['gold', s.tier_gold_min || 2000], gold: ['platinum', s.tier_platinum_min || 5000], platinum: null };
  return map[tier];
}

export function generateVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ─── Settings API ─── */

export const loyaltySettingsAPI = {
  async get(restaurantId) {
    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsert(restaurantId, updates) {
    const { data, error } = await supabase
      .from('loyalty_settings')
      .upsert({ restaurant_id: restaurantId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

/* ─── Customers API ─── */

export const loyaltyCustomersAPI = {
  async getOrCreate(restaurantId, email, name, signupSource = 'menu_qr') {
    // Check if customer exists
    const { data: existing } = await supabase
      .from('loyalty_customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) return { customer: existing, isNew: false };

    // Create new customer
    const { data: created, error } = await supabase
      .from('loyalty_customers')
      .insert([{
        restaurant_id: restaurantId,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        signup_source: signupSource
      }])
      .select()
      .single();

    if (error) throw error;

    // Log signup activity
    await loyaltyActivityAPI.log(restaurantId, created.id, 'signup',
      '🎉 Joined the loyalty program!',
      `Signed up via ${signupSource}`, '🎉', 0);

    return { customer: created, isNew: true };
  },

  async getById(customerId) {
    const { data, error } = await supabase
      .from('loyalty_customers')
      .select('*')
      .eq('id', customerId)
      .single();
    if (error) throw error;
    return data;
  },

  async getByRestaurant(restaurantId, opts = {}) {
    let q = supabase
      .from('loyalty_customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (opts.search) {
      q = q.or(`email.ilike.%${opts.search}%,name.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`);
    }
    if (opts.tier) q = q.eq('tier', opts.tier);
    if (opts.vip)  q = q.eq('is_vip', true);
    if (opts.inactive) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      q = q.lt('last_activity_at', cutoff);
    }
    if (opts.birthday_today) {
      const today = new Date();
      const mmdd  = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      q = q.like('birthday', `%-${mmdd}`);
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async update(customerId, updates) {
    const { data, error } = await supabase
      .from('loyalty_customers')
      .update({ ...updates, last_activity_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setBirthday(customerId, birthday) {
    // Check birthday_set flag — only allow if not yet set
    const { data: c } = await supabase.from('loyalty_customers').select('birthday_set').eq('id', customerId).single();
    if (c?.birthday_set) throw new Error('Birthday can only be set once and cannot be changed.');
    return this.update(customerId, { birthday, birthday_set: true });
  },

  async addPoints(restaurantId, customerId, points, description, type = 'earn', referenceId = null) {
    // Get current balance
    const { data: customer } = await supabase
      .from('loyalty_customers').select('points, total_points_earned, total_points_spent').eq('id', customerId).single();

    const newBalance    = (customer.points || 0) + points;
    const newTotalEarned = points > 0 ? (customer.total_points_earned || 0) + points : customer.total_points_earned;
    const newTotalSpent  = points < 0 ? (customer.total_points_spent  || 0) + Math.abs(points) : customer.total_points_spent;

    await supabase.from('loyalty_customers').update({
      points: Math.max(0, newBalance),
      total_points_earned: newTotalEarned,
      total_points_spent: newTotalSpent,
      last_activity_at: new Date().toISOString()
    }).eq('id', customerId);

    // Log transaction
    await supabase.from('loyalty_transactions').insert([{
      restaurant_id: restaurantId,
      customer_id: customerId,
      type,
      points,
      balance_after: Math.max(0, newBalance),
      description,
      reference_id: referenceId
    }]);

    return Math.max(0, newBalance);
  },

  async incrementVisit(restaurantId, customerId) {
    const { data: c } = await supabase
      .from('loyalty_customers').select('visit_count').eq('id', customerId).single();
    const newCount = (c?.visit_count || 0) + 1;

    await supabase.from('loyalty_customers').update({
      visit_count: newCount,
      last_activity_at: new Date().toISOString()
    }).eq('id', customerId);

    // Log visit
    await supabase.from('loyalty_visits').insert([{
      restaurant_id: restaurantId,
      customer_id: customerId,
      source: 'qr'
    }]);

    await loyaltyActivityAPI.log(restaurantId, customerId, 'visit',
      `🚶 Visit #${newCount}`, 'Checked in via QR code', '🚶', 0);

    return newCount;
  },

  async getStats(restaurantId) {
    const { data, error } = await supabase
      .from('loyalty_customers')
      .select('tier, visit_count, points, is_vip, last_activity_at, created_at')
      .eq('restaurant_id', restaurantId);
    if (error) throw error;

    const total      = data.length;
    const vip        = data.filter(c => c.is_vip).length;
    const cutoff     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activeWeek = data.filter(c => c.last_activity_at > cutoff).length;
    const tiers      = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    data.forEach(c => { tiers[c.tier] = (tiers[c.tier] || 0) + 1; });
    const totalPoints = data.reduce((s, c) => s + (c.points || 0), 0);

    return { total, vip, activeWeek, tiers, totalPoints };
  }
};

/* ─── Vouchers API ─── */

export const loyaltyVouchersAPI = {
  async getByCustomer(customerId, restaurantId) {
    const { data, error } = await supabase
      .from('loyalty_vouchers')
      .select('*')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async issue(restaurantId, customerId, type, value, description, source, expiryDays = 90) {
    let code = generateVoucherCode();
    // Ensure unique
    let attempts = 0;
    while (attempts < 5) {
      const { data: exists } = await supabase.from('loyalty_vouchers').select('id').eq('code', code).single();
      if (!exists) break;
      code = generateVoucherCode();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('loyalty_vouchers')
      .insert([{ restaurant_id: restaurantId, customer_id: customerId, code, type, value, description, source, expires_at: expiresAt }])
      .select()
      .single();
    if (error) throw error;

    await loyaltyActivityAPI.log(restaurantId, customerId, 'voucher_issued',
      `🎟️ Voucher ${code} issued`, description, '🎟️', 0, { voucher_id: data.id, code });

    return data;
  },

  async redeem(voucherId) {
    const { data, error } = await supabase
      .from('loyalty_vouchers')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', voucherId)
      .eq('is_used', false)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async checkVisitRewards(restaurantId, customerId, visitCount, settings) {
    const issued = [];
    const s = settings || {};

    // 3 visits → free dessert
    if (visitCount === 3 || visitCount % 15 === 3) {
      const v = await this.issue(restaurantId, customerId, 'free_item',
        s.visit_3_reward || 'Free Dessert',
        `🎉 ${s.visit_3_reward || 'Free Dessert'} — earned after 3 visits!`, 'visit_reward', 60);
      issued.push(v);
    }
    // 5 visits → ₹200 coupon
    if (visitCount === 5 || visitCount % 15 === 5) {
      const v = await this.issue(restaurantId, customerId, 'discount_flat',
        '200',
        `🎉 ₹200 Off — earned after 5 visits!`, 'visit_reward', 60);
      issued.push(v);
    }
    // 10 visits → VIP + ₹500
    if (visitCount === 10 || visitCount % 30 === 10) {
      await loyaltyCustomersAPI.update(customerId, { is_vip: true });
      const v = await this.issue(restaurantId, customerId, 'vip',
        '500',
        `👑 VIP Membership + ₹500 Coupon — earned after 10 visits!`, 'visit_reward', 90);
      issued.push(v);
    }
    return issued;
  }
};

/* ─── Birthday Rewards API ─── */

export const loyaltyBirthdayAPI = {
  isBirthdayWeek(birthday) {
    if (!birthday) return false;
    const today = new Date();
    const bday  = new Date(birthday);
    bday.setFullYear(today.getFullYear());
    const diff = Math.abs(today - bday);
    return diff <= 3 * 24 * 60 * 60 * 1000; // 3 days before/after
  },

  async hasClaimedThisYear(customerId) {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('loyalty_birthday_rewards')
      .select('id')
      .eq('customer_id', customerId)
      .eq('year', year)
      .single();
    return !!data;
  },

  async claim(restaurantId, customerId, settings) {
    const year = new Date().getFullYear();
    const already = await this.hasClaimedThisYear(customerId);
    if (already) throw new Error('Birthday reward already claimed this year.');

    const s = settings || {};
    const desc = s.birthday_reward_value || 'Any 1 complimentary item (Cake / Dessert / Drink)';

    // Issue birthday voucher (valid 7 days)
    const voucher = await loyaltyVouchersAPI.issue(
      restaurantId, customerId, 'birthday', 'birthday_gift', desc, 'birthday', 7
    );

    // Record claim (one per year)
    await supabase.from('loyalty_birthday_rewards').insert([{
      restaurant_id: restaurantId,
      customer_id: customerId,
      voucher_id: voucher.id,
      year
    }]);

    await loyaltyActivityAPI.log(restaurantId, customerId, 'birthday_claim',
      '🎂 Birthday reward claimed!', desc, '🎂', 0, { voucher_id: voucher.id });

    return voucher;
  }
};

/* ─── Activity API ─── */

export const loyaltyActivityAPI = {
  async log(restaurantId, customerId, type, title, description, icon = '⭐', pointsDelta = 0, metadata = null) {
    await supabase.from('loyalty_activity').insert([{
      restaurant_id: restaurantId,
      customer_id: customerId,
      type,
      title,
      description,
      icon,
      points_delta: pointsDelta,
      metadata
    }]);
  },

  async getByCustomer(customerId, limit = 30) {
    const { data, error } = await supabase
      .from('loyalty_activity')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};

/* ─── Campaigns API ─── */

export const loyaltyCampaignsAPI = {
  async getByRestaurant(restaurantId) {
    const { data, error } = await supabase
      .from('loyalty_campaigns')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(restaurantId, campaignData) {
    const { data, error } = await supabase
      .from('loyalty_campaigns')
      .insert([{ restaurant_id: restaurantId, ...campaignData }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async sendViaResend(restaurantId, campaignId, resendApiKey, senderEmail, senderName) {
    // Get campaign
    const { data: campaign } = await supabase.from('loyalty_campaigns').select('*').eq('id', campaignId).single();

    // Get target customers
    let q = supabase.from('loyalty_customers').select('*').eq('restaurant_id', restaurantId).eq('opted_in_email', true);
    if (campaign.target_segment !== 'all') q = q.eq('tier', campaign.target_segment);
    const { data: customers } = await q;

    let sentCount = 0;
    for (const c of customers) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${senderName} <${senderEmail}>`,
            to: [c.email],
            subject: campaign.subject,
            html: campaign.body_html.replace(/\{\{name\}\}/g, c.name || 'Valued Customer')
          })
        });
        if (res.ok) {
          const r = await res.json();
          await supabase.from('loyalty_email_log').insert([{
            restaurant_id: restaurantId,
            customer_id: c.id,
            campaign_id: campaignId,
            email: c.email,
            subject: campaign.subject,
            type: 'campaign',
            resend_id: r.id
          }]);
          sentCount++;
        }
      } catch (e) { console.warn('Email failed for', c.email, e.message); }
    }

    await supabase.from('loyalty_campaigns').update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: sentCount }).eq('id', campaignId);
    return sentCount;
  }
};

/* ─── Points Redemption helpers ─── */

export async function redeemPointsForDiscount(restaurantId, customerId, settings) {
  const s = settings || {};
  const ptsNeeded = s.points_for_50_discount || 100;
  const { data: c } = await supabase.from('loyalty_customers').select('points').eq('id', customerId).single();

  if ((c?.points || 0) < ptsNeeded) throw new Error(`Need ${ptsNeeded} points. You have ${c?.points || 0}.`);

  await loyaltyCustomersAPI.addPoints(restaurantId, customerId, -ptsNeeded, `Redeemed ${ptsNeeded} points for ₹50 discount`, 'redeem');
  const voucher = await loyaltyVouchersAPI.issue(restaurantId, customerId, 'discount_flat', '50', `₹50 Discount (${ptsNeeded} points redeemed)`, 'points_redemption', 30);

  await loyaltyActivityAPI.log(restaurantId, customerId, 'points_redeemed',
    `💸 Redeemed ${ptsNeeded} points`, '₹50 discount voucher issued', '💸', -ptsNeeded, { voucher_id: voucher.id });

  return voucher;
}

export async function redeemPointsForFreeItem(restaurantId, customerId, settings) {
  const s = settings || {};
  const ptsNeeded = s.points_for_free_item || 500;
  const freeItem  = s.free_item_description || 'Free Burger / Pizza / Drink';
  const { data: c } = await supabase.from('loyalty_customers').select('points').eq('id', customerId).single();

  if ((c?.points || 0) < ptsNeeded) throw new Error(`Need ${ptsNeeded} points. You have ${c?.points || 0}.`);

  await loyaltyCustomersAPI.addPoints(restaurantId, customerId, -ptsNeeded, `Redeemed ${ptsNeeded} points for ${freeItem}`, 'redeem');
  const voucher = await loyaltyVouchersAPI.issue(restaurantId, customerId, 'free_item', freeItem, `${freeItem} (${ptsNeeded} points redeemed)`, 'points_redemption', 30);

  await loyaltyActivityAPI.log(restaurantId, customerId, 'points_redeemed',
    `🎁 Redeemed ${ptsNeeded} points`, `${freeItem} voucher issued`, '🎁', -ptsNeeded, { voucher_id: voucher.id });

  return voucher;
}

/* ─── Email helpers (Resend.com) ─── */

export async function sendLoyaltyEmail(apiKey, fromEmail, fromName, toEmail, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [toEmail], subject, html })
  });
  if (!res.ok) throw new Error(`Resend error: ${res.status}`);
  return res.json();
}

export function buildWelcomeEmail(customerName, restaurantName, points) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a12;color:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🥉</div>
      <h1 style="margin:0;font-size:1.8rem;">Welcome to ${restaurantName} Rewards!</h1>
      <p style="opacity:.8;margin-top:8px;">You're now a Bronze member</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:1.1rem;">Hi ${customerName || 'there'} 👋</p>
      <p>You've joined our loyalty program and earned your first <strong style="color:#f59e0b;">${points} points</strong>!</p>
      <div style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 12px;color:#a78bfa;">How to earn more:</h3>
        <ul style="margin:0;padding-left:20px;line-height:1.9;">
          <li>Spend ₹100 = earn 10 points</li>
          <li>3 visits = Free Dessert</li>
          <li>5 visits = ₹200 Coupon</li>
          <li>10 visits = VIP Membership!</li>
        </ul>
      </div>
      <p style="color:#94a3b8;font-size:.85rem;">You'll receive weekly offers and birthday surprises. Unsubscribe anytime from your dashboard.</p>
    </div>
  </div>`;
}

export function buildBirthdayEmail(customerName, restaurantName, voucherCode, rewardDescription) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a12;color:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f59e0b,#ec4899);padding:40px 32px;text-align:center;">
      <div style="font-size:60px;">🎂</div>
      <h1 style="margin:8px 0 0;">Happy Birthday, ${customerName || 'Friend'}!</h1>
      <p style="opacity:.9;margin-top:8px;">A special gift from ${restaurantName}</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:1.1rem;">Wishing you a wonderful birthday! As a thank you, here's your gift:</p>
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(236,72,153,.2));border:2px dashed #f59e0b;border-radius:16px;padding:28px;margin:24px 0;">
        <div style="font-size:2rem;margin-bottom:8px;">🎁</div>
        <h2 style="color:#f59e0b;margin:0 0 8px;">${rewardDescription}</h2>
        <div style="font-size:2rem;font-weight:900;letter-spacing:.2em;color:#fff;background:rgba(0,0,0,.4);padding:12px 24px;border-radius:10px;margin-top:16px;">${voucherCode}</div>
        <p style="font-size:.8rem;color:#94a3b8;margin-top:12px;">Valid for 7 days · Show this code at the counter</p>
      </div>
    </div>
  </div>`;
}

export function buildWeeklyPromoEmail(customerName, restaurantName, points, offers) {
  const offerHtml = offers.map(o => `<li style="padding:6px 0;">${o}</li>`).join('');
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a12;color:#fff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);padding:32px;text-align:center;border-bottom:1px solid rgba(99,102,241,.3);">
      <h1 style="margin:0;color:#a78bfa;">Weekend Specials 🎉</h1>
      <p style="color:#94a3b8;margin-top:8px;">From ${restaurantName}</p>
    </div>
    <div style="padding:32px;">
      <p>Hi ${customerName || 'there'},</p>
      <p>You have <strong style="color:#f59e0b;">${points} reward points</strong> waiting for you! Come visit us this weekend and enjoy:</p>
      <ul style="background:rgba(99,102,241,.08);border-radius:12px;padding:16px 16px 16px 36px;line-height:1.8;">${offerHtml}</ul>
      <p style="color:#94a3b8;font-size:.85rem;margin-top:24px;">Unsubscribe anytime from your loyalty dashboard.</p>
    </div>
  </div>`;
}

/* ─── Orders API ─── */
export const ordersAPI = {
  async create(orderData, items) {
    const { data: order, error } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();
    if (error) throw error;

    const orderItems = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);
    if (itemsError) throw itemsError;

    return order;
  },

  async getByCustomer(customerId, restaurantId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getActiveByRestaurant(restaurantId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async updateStatus(orderId, status) {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

/* ─── Favorites API ─── */
export const favoritesAPI = {
  async toggle(restaurantId, customerId, menuItemId) {
    // Check if exists
    const { data: existing } = await supabase
      .from('customer_favorites')
      .select('id')
      .eq('customer_id', customerId)
      .eq('menu_item_id', menuItemId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('customer_favorites')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { isFavorite: false };
    } else {
      const { error } = await supabase
        .from('customer_favorites')
        .insert([{ restaurant_id: restaurantId, customer_id: customerId, menu_item_id: menuItemId }]);
      if (error) throw error;
      return { isFavorite: true };
    }
  },

  async getByCustomer(customerId, restaurantId) {
    const { data, error } = await supabase
      .from('customer_favorites')
      .select('menu_item_id, menu_items(*)')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
    return data.map(d => d.menu_items).filter(Boolean);
  },

  async getIdsByCustomer(customerId, restaurantId) {
    const { data, error } = await supabase
      .from('customer_favorites')
      .select('menu_item_id')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
    return data.map(d => d.menu_item_id);
  }
};

/* ─── Upsell API ─── */
export const upsellAPI = {
  async getRules(restaurantId) {
    const { data, error } = await supabase
      .from('upsell_rules')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) throw error;
    return data;
  },

  async getRuleByItem(menuItemId) {
    const { data, error } = await supabase
      .from('upsell_rules')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async saveRules(restaurantId, menuItemId, upsellItemIds) {
    const { data, error } = await supabase
      .from('upsell_rules')
      .upsert({
        restaurant_id: restaurantId,
        menu_item_id: menuItemId,
        upsell_item_ids: upsellItemIds,
        created_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id,menu_item_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

/* ─── Theme API ─── */
export const themeAPI = {
  async get(restaurantId) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('theme_settings')
      .eq('id', restaurantId)
      .single();
    if (error) throw error;
    return data.theme_settings;
  },

  async save(restaurantId, themeSettings) {
    const { data, error } = await supabase
      .from('restaurants')
      .update({ theme_settings: themeSettings })
      .eq('id', restaurantId)
      .select()
      .single();
    if (error) throw error;
    return data.theme_settings;
  }
};

/* ─── Tables API ─── */
export const tablesAPI = {
  async getAll(restaurantId) {
    const { data, error } = await supabase
      .from('tables')
      .select('*, dining_sessions(*)')
      .eq('restaurant_id', restaurantId)
      .order('table_number', { ascending: true });
    if (error) throw error;
    return data;
  },

  async updateStatus(tableId, status) {
    const { data, error } = await supabase
      .from('tables')
      .update({ status })
      .eq('id', tableId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async setSession(tableId, sessionId) {
    const { data, error } = await supabase
      .from('tables')
      .update({ current_session_id: sessionId })
      .eq('id', tableId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markClean(tableId) {
    return this.updateStatus(tableId, 'available');
  }
};

/* ─── Dining Sessions API ─── */
export const sessionsAPI = {
  async getActive(restaurantId) {
    const { data, error } = await supabase
      .from('dining_sessions')
      .select('*, tables(*), orders(*, order_items(*))')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getSessionById(sessionId) {
    const { data, error } = await supabase
      .from('dining_sessions')
      .select('*, tables(*), orders(*, order_items(*))')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return data;
  },

  async getActiveByTable(restaurantId, tableNumber) {
    // Get table first
    const { data: table, error: tErr } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', parseInt(tableNumber))
      .single();
    if (tErr && tErr.code !== 'PGRST116') throw tErr;
    
    // If table doesn't exist, create it!
    if (!table) {
      const { data: newTable, error: createTableErr } = await supabase
        .from('tables')
        .insert([{ restaurant_id: restaurantId, table_number: parseInt(tableNumber), status: 'available' }])
        .select()
        .single();
      if (createTableErr) throw createTableErr;
      return null;
    }

    if (!table.current_session_id) return null;

    // Get active session
    const { data: session, error: sErr } = await supabase
      .from('dining_sessions')
      .select('*')
      .eq('id', table.current_session_id)
      .eq('status', 'active')
      .single();
    if (sErr && sErr.code !== 'PGRST116') throw sErr;
    return session;
  },

  async startSession(restaurantId, tableNumber, customerName, customerEmail, customerId) {
    // 1. Get or create table
    let { data: table, error: tErr } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', parseInt(tableNumber))
      .single();
    if (tErr && tErr.code === 'PGRST116') {
      const { data: nt, error: ntErr } = await supabase
        .from('tables')
        .insert([{ restaurant_id: restaurantId, table_number: parseInt(tableNumber), status: 'available' }])
        .select()
        .single();
      if (ntErr) throw ntErr;
      table = nt;
    } else if (tErr) {
      throw tErr;
    }

    // 2. Create dining session
    const { data: session, error: sErr } = await supabase
      .from('dining_sessions')
      .insert([{
        restaurant_id: restaurantId,
        table_id: table.id,
        customer_name: customerName || 'Dine-In Customer',
        customer_email: customerEmail || null,
        customer_id: customerId || null,
        status: 'active',
        payment_status: 'unpaid'
      }])
      .select()
      .single();
    if (sErr) throw sErr;

    // 3. Link session to table and change status to 'seated'
    await supabase
      .from('tables')
      .update({ current_session_id: session.id, status: 'seated' })
      .eq('id', table.id);

    return session;
  },

  async addOrder(sessionId, restaurantId, items, specialInstructions) {
    // 1. Get session details to find the linked table
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    // 2. Create Order linked to session
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert([{
        session_id: sessionId,
        restaurant_id: restaurantId,
        table_number: session.tables.table_number,
        customer_name: session.customer_name,
        customer_email: session.customer_email,
        customer_id: session.customer_id,
        status: 'new',
        special_instructions: specialInstructions || ''
      }])
      .select()
      .single();
    if (oErr) throw oErr;

    // 3. Add order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || ''
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems);
    if (itemsErr) throw itemsErr;

    // 4. Update session running total
    const orderTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newTotal = parseFloat(session.running_total || 0) + orderTotal;
    await supabase
      .from('dining_sessions')
      .update({ running_total: newTotal })
      .eq('id', sessionId);

    // 5. Set table status to 'preparing'
    await supabase
      .from('tables')
      .update({ status: 'preparing' })
      .eq('id', session.table_id);

    return order;
  },

  async closeSession(sessionId, paymentMethod, discountAmount = 0, voucherCode = '') {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    // 1. Update Dining Session to completed and paid
    const finalTotal = parseFloat(session.running_total) - parseFloat(discountAmount);
    const { data: updatedSession, error: sErr } = await supabase
      .from('dining_sessions')
      .update({
        status: 'completed',
        payment_status: 'paid',
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        voucher_code: voucherCode || null,
        end_time: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();
    if (sErr) throw sErr;

    // 2. Mark all orders under this session as completed
    await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('session_id', sessionId);

    // 3. Update table status to 'cleaning' and decouple current_session_id
    await supabase
      .from('tables')
      .update({ current_session_id: null, status: 'cleaning' })
      .eq('id', session.table_id);

    // 4. Credit loyalty points trigger replacement
    if (session.customer_id && finalTotal > 0) {
      const earned_pts = Math.floor(finalTotal * 0.1);
      if (earned_pts > 0) {
        const { data: customer } = await supabase
          .from('loyalty_customers')
          .select('points')
          .eq('id', session.customer_id)
          .single();
        const currentPoints = customer ? (customer.points || 0) : 0;

        await supabase
          .from('loyalty_customers')
          .update({
            points: currentPoints + earned_pts,
            total_points_earned: currentPoints + earned_pts,
            total_spent_amount: finalTotal,
            visit_count: 1
          })
          .eq('id', session.customer_id);
      }
    }

    return updatedSession;
  }
};

/* ─── Customer Assistance Requests API ─── */
export const requestsAPI = {
  async create(restaurantId, tableNumber, sessionId, requestType) {
    const { data, error } = await supabase
      .from('customer_requests')
      .insert([{
        restaurant_id: restaurantId,
        table_number: parseInt(tableNumber),
        session_id: sessionId,
        request_type: requestType,
        status: 'pending'
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getActive(restaurantId) {
    const { data, error } = await supabase
      .from('customer_requests')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async resolve(requestId) {
    const { data, error } = await supabase
      .from('customer_requests')
      .update({ status: 'completed' })
      .eq('id', requestId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

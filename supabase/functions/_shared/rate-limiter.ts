import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

/**
 * IP and Email-based Rate Limiter for Edge Functions
 * 
 * Rules:
 * - Login/Register: Max 5 failed attempts per 10 minutes, then lockout.
 * - OTP Resend: Disabled for 60 seconds (enforced in frontend + backend).
 */
export async function checkRateLimit(
  supabaseAdmin: any,
  key: string,
  maxAttempts: number = 5,
  windowMinutes: number = 10
): Promise<{ allowed: boolean; remaining: number; lockedUntil?: string }> {
  const windowMs = windowMinutes * 60 * 1000;
  const now = new Date();

  // 1. Get current limit record
  const { data: limit, error } = await supabaseAdmin
    .from('rate_limits')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error("Rate limit check query error:", error);
    return { allowed: true, remaining: maxAttempts }; // Fail open for resilience, log error
  }

  if (!limit) {
    // No previous record, insert first one
    const { error: insertError } = await supabaseAdmin
      .from('rate_limits')
      .insert([{ key, attempts: 1, last_attempt_at: now.toISOString() }]);
    
    if (insertError) console.error("Rate limit insert error:", insertError);
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // 2. Check if currently locked out
  if (limit.locked_until) {
    const lockedUntilDate = new Date(limit.locked_until);
    if (lockedUntilDate > now) {
      return { 
        allowed: false, 
        remaining: 0, 
        lockedUntil: lockedUntilDate.toISOString() 
      };
    } else {
      // Lock expired, reset rate limit
      await supabaseAdmin
        .from('rate_limits')
        .update({ 
          attempts: 1, 
          last_attempt_at: now.toISOString(),
          locked_until: null 
        })
        .eq('key', key);
      
      return { allowed: true, remaining: maxAttempts - 1 };
    }
  }

  // 3. Check window expiry
  const lastAttemptDate = new Date(limit.last_attempt_at);
  if (now.getTime() - lastAttemptDate.getTime() > windowMs) {
    // Window expired, reset counter
    await supabaseAdmin
      .from('rate_limits')
      .update({ 
        attempts: 1, 
        last_attempt_at: now.toISOString() 
      })
      .eq('key', key);

    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // 4. Increment attempts within window
  const newAttempts = limit.attempts + 1;
  const updates: any = { 
    attempts: newAttempts, 
    last_attempt_at: now.toISOString() 
  };

  let allowed = true;
  let lockedUntil: string | undefined;

  if (newAttempts >= maxAttempts) {
    allowed = false;
    const lockTime = new Date(now.getTime() + windowMs);
    updates.locked_until = lockTime.toISOString();
    lockedUntil = updates.locked_until;
  }

  await supabaseAdmin
    .from('rate_limits')
    .update(updates)
    .eq('key', key);

  return { 
    allowed, 
    remaining: Math.max(0, maxAttempts - newAttempts),
    lockedUntil 
  };
}

export async function resetRateLimit(supabaseAdmin: any, key: string): Promise<void> {
  await supabaseAdmin
    .from('rate_limits')
    .delete()
    .eq('key', key);
}

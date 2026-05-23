-- =====================================================
-- LOYALTY & CRM DATABASE HELPER FUNCTIONS
-- =====================================================

-- 1. Get customers having their birthday today (with their restaurant and loyalty settings)
CREATE OR REPLACE FUNCTION get_todays_birthdays(target_date DATE)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  email TEXT,
  name TEXT,
  birthday DATE,
  restaurant_name TEXT,
  birthday_reward_description TEXT,
  birthday_reward_type TEXT,
  birthday_reward_value TEXT,
  resend_api_key TEXT,
  sender_email TEXT,
  sender_name TEXT,
  birthday_week_valid BOOLEAN
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.restaurant_id,
    c.email,
    c.name,
    c.birthday,
    r.name AS restaurant_name,
    s.birthday_reward_description,
    s.birthday_reward_type,
    s.birthday_reward_value,
    s.resend_api_key,
    s.sender_email,
    s.sender_name,
    s.birthday_week_valid
  FROM loyalty_customers c
  JOIN restaurants r ON c.restaurant_id = r.id
  JOIN loyalty_settings s ON c.restaurant_id = s.restaurant_id
  WHERE 
    s.birthday_reward_enabled = TRUE
    AND c.opted_in_email = TRUE
    AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM target_date)
    AND EXTRACT(DAY FROM c.birthday) = EXTRACT(DAY FROM target_date);
END;
$$ LANGUAGE plpgsql;

-- 2. Get target customers for a campaign based on its segment
CREATE OR REPLACE FUNCTION get_campaign_customers(campaign_id UUID)
RETURNS TABLE (
  customer_id UUID,
  email TEXT,
  name TEXT
) SECURITY DEFINER AS $$
DECLARE
  v_restaurant_id UUID;
  v_target_segment TEXT;
BEGIN
  SELECT restaurant_id, target_segment INTO v_restaurant_id, v_target_segment
  FROM loyalty_campaigns WHERE id = campaign_id;

  RETURN QUERY
  SELECT 
    c.id AS customer_id,
    c.email,
    c.name
  FROM loyalty_customers c
  WHERE 
    c.restaurant_id = v_restaurant_id
    AND c.opted_in_email = TRUE
    AND (
      v_target_segment = 'all'
      OR (v_target_segment = 'bronze' AND c.tier = 'bronze')
      OR (v_target_segment = 'silver' AND c.tier = 'silver')
      OR (v_target_segment = 'gold' AND c.tier = 'gold')
      OR (v_target_segment = 'platinum' AND c.tier = 'platinum')
      OR (v_target_segment = 'vip' AND c.is_vip = TRUE)
      OR (v_target_segment = 'inactive' AND c.last_activity_at < NOW() - INTERVAL '30 days')
      OR (v_target_segment = 'birthday_month' AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM CURRENT_DATE))
    );
END;
$$ LANGUAGE plpgsql;

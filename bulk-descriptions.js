// bulk-descriptions.js — Saves AI-generated descriptions for all Phoenix Cafe dishes
const SUPABASE_URL = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIxMzM3MiwiZXhwIjoyMDkxNzg5MzcyfQ.LUjdZ99kuIZUq5Rf9fRD2uas9d3V5DXvGBixRzBuBqk';

const HEADERS = {
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation'
};

const DISHES = [
  {
    id:          '3548b99d-79a5-4e26-8729-81f96cdd444d',
    category:    'Beverages',
    description: 'Rich, creamy & perfectly aromatic — a barista-crafted blend of bold Espresso and velvety Steamed Milk, crowned with a cloud of silky Milk Foam and a dusting of Cocoa Powder. A warming sip of pure Italian indulgence. Approx. 80 kcal · Ingredients: Espresso, Steamed Milk, Milk Foam, Cocoa Powder'
  },
  {
    id:          '566e85df-4601-4ee6-8a41-40e2aaf74ff4',
    category:    'Beverages',
    description: 'Light, soothing & gently fragrant — brewed fresh from premium Assam Tea Leaves, perfectly balanced with warm Milk and a hint of sweetness. The ultimate comfort drink for any time of day. Approx. 30 kcal · Ingredients: Assam Tea Leaves, Fresh Milk, Sugar, Hot Water'
  },
  {
    id:          'cd977344-b56d-40aa-aa94-c81ffc29a139',
    category:    'Beverages',
    description: 'Chilled, bold & irresistibly refreshing — rich Brewed Coffee blended smooth with creamy Milk and a scoop of Ice Cream, drizzled with Sugar Syrup over crushed Ice. Your perfect cool-down in a glass. Approx. 210 kcal · Ingredients: Brewed Coffee, Full Cream Milk, Ice Cream, Sugar Syrup, Ice'
  },
  {
    id:          '76337954-3de6-45cc-ba5d-1b032f0f3f1f',
    category:    'Desserts',
    description: 'Light, fluffy & beautifully frosted — baked fresh daily from fine Flour, Eggs, Butter and a whisper of Vanilla, crowned with a generous swirl of Butter-cream Frosting. A perfect little bite of happiness. Approx. 280 kcal · Ingredients: Flour, Butter, Eggs, Sugar, Vanilla, Butter-cream Frosting'
  },
  {
    id:          '96f81406-3755-4350-91ad-175cf5624297',
    category:    'Snacks',
    description: 'Crispy outside, gooey inside & packed with flavour — fresh Tomato, Onion, Bell Peppers and melted Cheese layered between golden-pressed Sourdough Bread. A snack that satisfies every single time. Approx. 350 kcal · Ingredients: Sourdough Bread, Cheese, Tomato, Onion, Bell Peppers, Butter'
  },
  {
    id:          'f4bfa8fb-994b-4e0e-a831-eaae0e145664',
    category:    'Mains',
    description: 'The ultimate crowd-pleaser — golden crispy Fried Chicken with a perfect seasoned crunch, paired with salted French Fries and an ice-cold Coke. Everything you love in one unbeatable combo. Approx. 850 kcal · Ingredients: Fried Chicken, French Fries, Coca-Cola, Seasoning Blend'
  },
  {
    id:          'f669be46-2da0-43c0-bcf4-c0a559225b58',
    category:    'Breakfast',
    description: 'A wholesome morning favourite — farm-fresh Egg Toast on golden-toasted Whole Wheat Bread with creamy Butter, served alongside a steaming cup of freshly brewed Tea. The perfect fuel for a great day. Approx. 310 kcal · Ingredients: Farm Eggs, Whole Wheat Bread, Butter, Brewed Tea, Milk, Sugar'
  },
  {
    id:          '7377343d-4758-43fc-bc0a-e9df17a61f99',
    category:    'Desserts',
    description: 'Buttery, flaky & elegantly sweet — our freshly baked Pastries feature golden Puff Pastry layered with silky Cream and seasonal Fruit, finished with a dusting of Icing Sugar. A bakery-style treat that melts in your mouth. Approx. 320 kcal · Ingredients: Puff Pastry, Cream, Fresh Fruit, Icing Sugar, Butter'
  }
];

async function update(dish) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/menu_items?id=eq.${dish.id}`,
    {
      method:  'PATCH',
      headers: HEADERS,
      body:    JSON.stringify({ category: dish.category, description: dish.description })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return res.json().catch(() => ({}));
}

(async () => {
  console.log('\n🤖 Saving AI descriptions to Phoenix Cafe...\n');
  let ok = 0, fail = 0;
  for (const dish of DISHES) {
    process.stdout.write(`  Updating: ${dish.id.slice(0,8)}... `);
    try {
      await update(dish);
      console.log('✓');
      ok++;
    } catch (e) {
      console.log(`✕ ${e.message}`);
      fail++;
    }
  }
  console.log(`\n✅ Done: ${ok} saved, ${fail} failed\n`);
})();

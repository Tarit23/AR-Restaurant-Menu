/* ═══════════════════════════════════════════════════════════════
   AI DISH DESCRIPTION ENGINE  ·  js/ai-description.js
   Smart client-side generator — no API key needed.
   Falls back to Gemini API if window.GEMINI_KEY is set.
═══════════════════════════════════════════════════════════════ */

/* ── Comprehensive food knowledge database ── */
const FOOD_DB = {
  /* ─── Beverages ─── */
  cappuccino:    { taste:'rich, creamy & aromatic', ingr:'Espresso, Steamed Milk, Milk Foam, Cocoa Powder', cal:80,  type:'beverage' },
  coffee:        { taste:'bold, smooth & energising', ingr:'Arabica Coffee Beans, Filtered Water, optional Milk', cal:5, type:'beverage' },
  'cold coffee': { taste:'chilled, sweet & refreshing', ingr:'Brewed Coffee, Milk, Ice Cream, Sugar Syrup', cal:210, type:'beverage' },
  tea:           { taste:'light, soothing & fragrant', ingr:'Premium Tea Leaves, Hot Water, Milk, Sugar', cal:30,  type:'beverage' },
  lassi:         { taste:'cool, tangy & creamy', ingr:'Fresh Yogurt, Water, Sugar/Salt, Cardamom, Rose Water', cal:180, type:'beverage' },
  juice:         { taste:'fresh, vibrant & naturally sweet', ingr:'Fresh Fruits, Filtered Water, No Added Preservatives', cal:120, type:'beverage' },
  milkshake:     { taste:'creamy, indulgent & thick', ingr:'Full-fat Milk, Ice Cream, Fresh Fruit, Sugar', cal:350, type:'beverage' },
  smoothie:      { taste:'fruity, nutritious & velvety', ingr:'Mixed Fruits, Yogurt, Honey, Chia Seeds', cal:180, type:'beverage' },
  chai:          { taste:'spiced, warming & aromatic', ingr:'Assam Tea, Ginger, Cardamom, Cinnamon, Milk, Sugar', cal:90, type:'beverage' },
  /* ─── Breakfast ─── */
  'egg toast':   { taste:'savoury, buttery & wholesome', ingr:'Whole Wheat Bread, Farm Eggs, Butter, Salt, Pepper', cal:280, type:'breakfast' },
  'french toast':{ taste:'golden, custardy & lightly sweet', ingr:'Brioche Bread, Eggs, Milk, Vanilla, Cinnamon, Maple Syrup', cal:320, type:'breakfast' },
  waffle:        { taste:'crispy outside, fluffy inside & indulgent', ingr:'All-purpose Flour, Eggs, Butter, Milk, Baking Powder, Vanilla', cal:350, type:'breakfast' },
  pancake:       { taste:'soft, pillowy & buttery', ingr:'Flour, Eggs, Buttermilk, Butter, Maple Syrup, Fresh Berries', cal:300, type:'breakfast' },
  omelette:      { taste:'fluffy, savoury & protein-packed', ingr:'Farm Eggs, Cheddar Cheese, Bell Peppers, Onion, Fresh Herbs', cal:250, type:'breakfast' },
  idli:          { taste:'soft, spongy & light on the stomach', ingr:'Fermented Rice, Urad Dal, Salt, served with Coconut Chutney & Sambar', cal:150, type:'breakfast' },
  dosa:          { taste:'crispy, tangy & golden', ingr:'Rice Batter, Urad Dal, Oil, Served with Sambar & Chutneys', cal:200, type:'breakfast' },
  upma:          { taste:'savoury, nutty & hearty', ingr:'Semolina, Mustard Seeds, Curry Leaves, Onion, Green Chilli, Vegetables', cal:230, type:'breakfast' },
  poha:          { taste:'light, lemony & gently spiced', ingr:'Flattened Rice, Mustard Seeds, Turmeric, Onion, Green Peas, Lemon', cal:180, type:'breakfast' },
  paratha:       { taste:'flaky, buttery & satisfyingly hearty', ingr:'Whole Wheat Flour, Ghee, Stuffed with Aloo/Paneer/Mix Veg, served with Yogurt', cal:290, type:'breakfast' },
  /* ─── Snacks ─── */
  sandwich:      { taste:'fresh, hearty & perfectly balanced', ingr:'Multigrain Bread, Grilled Vegetables, Cheese, Lettuce, Tomato, Mayo', cal:320, type:'snack' },
  'grilled sandwich':{ taste:'crispy, gooey & comforting', ingr:'Sourdough Bread, Cheese, Tomato, Onion, Bell Peppers, Butter', cal:350, type:'snack' },
  samosa:        { taste:'crispy, spiced & addictive', ingr:'Wheat Pastry Shell, Spiced Potato, Peas, Cumin, Coriander, served with Mint Chutney', cal:260, type:'snack' },
  pakora:        { taste:'golden, crispy & perfectly spiced', ingr:'Chickpea Batter, Onion/Spinach/Paneer, Cumin, Chilli, Coriander', cal:220, type:'snack' },
  chips:         { taste:'crunchy, salty & irresistibly moreish', ingr:'Potatoes, Sunflower Oil, Sea Salt, Natural Seasonings', cal:180, type:'snack' },
  nachos:        { taste:'crispy, cheesy & flavour-packed', ingr:'Corn Tortillas, Cheddar Cheese, Jalapeños, Sour Cream, Salsa, Guacamole', cal:420, type:'snack' },
  'spring roll': { taste:'crispy outside, juicy filling & light', ingr:'Rice Wrappers, Mixed Vegetables, Noodles, Soy Sauce, Sesame Oil', cal:200, type:'snack' },
  'french fries':{ taste:'golden, crispy & perfectly salted', ingr:'Premium Potatoes, Sunflower Oil, Sea Salt, Seasoning Blend', cal:310, type:'snack' },
  /* ─── Mains ─── */
  biryani:       { taste:'aromatic, spiced & deeply satisfying', ingr:'Basmati Rice, Chicken/Mutton/Veg, Whole Spices, Saffron, Caramelised Onion, Mint, Yogurt', cal:550, type:'main' },
  'butter chicken':{ taste:'creamy, mildly spiced & absolutely divine', ingr:'Tandoor Chicken, Tomato Gravy, Cream, Cashew, Garam Masala, Fenugreek Leaves', cal:490, type:'main' },
  'paneer tikka':{ taste:'smoky, spiced & charred to perfection', ingr:'Fresh Paneer, Yogurt Marinade, Bell Peppers, Onion, Spices, Mint Chutney', cal:350, type:'main' },
  'dal makhani': { taste:'rich, creamy & slow-cooked to perfection', ingr:'Black Lentils, Kidney Beans, Tomato, Cream, Butter, Aromatic Spices', cal:320, type:'main' },
  burger:        { taste:'juicy, indulgent & satisfyingly meaty', ingr:'Beef/Chicken Patty, Brioche Bun, Lettuce, Tomato, Cheese, Signature Sauce', cal:520, type:'main' },
  pizza:         { taste:'crispy crust, gooey cheese & bursting with flavour', ingr:'Handmade Dough, Tomato Base, Mozzarella, Fresh Toppings, Olive Oil', cal:600, type:'main' },
  pasta:         { taste:'al dente, saucy & comfortingly Italian', ingr:'Durum Wheat Pasta, Tomato/Cream Sauce, Fresh Herbs, Parmesan, Olive Oil', cal:480, type:'main' },
  'fried rice':  { taste:'smoky, savoury & wok-tossed to perfection', ingr:'Jasmine Rice, Eggs, Spring Onion, Soy Sauce, Sesame Oil, Mixed Vegetables', cal:400, type:'main' },
  ramen:         { taste:'umami-rich, warming & deeply nourishing', ingr:'Ramen Noodles, Tonkotsu/Miso Broth, Chashu Pork, Nori, Soft-boiled Egg, Bamboo Shoots', cal:520, type:'main' },
  noodles:       { taste:'slurpy, savoury & wok-kissed with flavour', ingr:'Wheat Noodles, Mixed Vegetables, Soy Sauce, Oyster Sauce, Sesame, Spring Onion', cal:380, type:'main' },
  curry:         { taste:'warmly spiced, aromatic & deeply comforting', ingr:'Choice Protein/Veg, Onion-Tomato Gravy, Whole Spices, Cream, Fresh Coriander', cal:420, type:'main' },
  steak:         { taste:'succulent, char-grilled & meltingly tender', ingr:'Premium Beef, Sea Salt, Black Pepper, Herb Butter, Garlic, Rosemary', cal:600, type:'main' },
  /* ─── Desserts ─── */
  cake:          { taste:'moist, fluffy & beautifully sweet', ingr:'All-purpose Flour, Eggs, Butter, Sugar, Vanilla Extract, Fresh Cream Frosting', cal:380, type:'dessert' },
  'ice cream':   { taste:'cold, creamy & blissfully indulgent', ingr:'Full-fat Cream, Milk, Sugar, Natural Flavours, Egg Yolks', cal:270, type:'dessert' },
  brownie:       { taste:'fudgy, intensely chocolatey & decadent', ingr:'Dark Chocolate, Butter, Eggs, Sugar, Cocoa Powder, Vanilla', cal:350, type:'dessert' },
  cheesecake:    { taste:'creamy, tangy & irresistibly smooth', ingr:'Cream Cheese, Graham Cracker Crust, Sugar, Eggs, Vanilla, Fruit Topping', cal:420, type:'dessert' },
  cupcake:       { taste:'light, fluffy & beautifully frosted', ingr:'Flour, Butter, Eggs, Sugar, Vanilla, Butter-cream Frosting', cal:280, type:'dessert' },
  'gulab jamun': { taste:'melt-in-mouth, fragrant & syrup-soaked', ingr:'Khoya, Maida, Rose Syrup, Cardamom, Saffron, Pistachios', cal:310, type:'dessert' },
  kheer:         { taste:'creamy, fragrant & delicately sweet', ingr:'Full-fat Milk, Basmati Rice, Sugar, Cardamom, Saffron, Almonds, Rose Water', cal:230, type:'dessert' },
  pastry:        { taste:'buttery, flaky & elegantly sweet', ingr:'Puff Pastry, Cream, Fresh Fruits, Chocolate, Icing Sugar', cal:320, type:'dessert' },
  'halwa':       { taste:'rich, ghee-laden & warmly aromatic', ingr:'Semolina/Gajar, Ghee, Sugar, Milk, Cardamom, Cashews, Raisins', cal:380, type:'dessert' },
  waffles:       { taste:'golden, crispy-edged & perfectly sweet', ingr:'Belgian Batter, Butter, Eggs, Maple Syrup, Fresh Cream, Berries', cal:440, type:'dessert' },
  /* ─── Generic combos ─── */
  combo:         { taste:'perfectly paired & great value', ingr:'Chef\'s Selection of Main + Side + Beverage, perfectly portioned', cal:650, type:'combo' },
};

/* ─── Generic templates by category ─── */
const CAT_TEMPLATES = {
  beverage:  ['Expertly crafted to quench and delight', 'A refreshing sip of pure indulgence', 'Perfectly balanced flavours in every cup'],
  breakfast: ['The perfect way to start your day', 'A morning classic done right', 'Fuel your morning with this nourishing favourite'],
  snack:     ['Snack-time perfection in every bite', 'Crispy, flavourful and utterly satisfying', 'Your favourite anytime snack, elevated'],
  main:      ['A showstopping main course', 'Bold flavours, generous portions', 'The star of the table, every time'],
  dessert:   ['The perfect sweet finale', 'Pure dessert happiness in every bite', 'Treat yourself — you deserve this'],
  combo:     ['Everything you need in one great deal', 'A full meal, perfectly curated'],
  default:   ['A house favourite, made with care', 'Crafted fresh using the finest ingredients', 'A must-try from our chef\'s kitchen'],
};

const NUTRITION_NOTES = {
  beverage: 'Low calorie · Hydrating',
  breakfast:'High Protein · Good Carbs · Energising',
  snack:    'Satisfying snack · Moderate carbs',
  main:     'Balanced meal · Good Protein',
  dessert:  'Treat yourself · High Energy',
  combo:    'Complete Meal · Balanced Macros',
  default:  'Made with quality ingredients',
};

/**
 * generateLocalDescription(name, category, price)
 * Returns a 2-3 sentence AI-style dish description.
 */
export function generateLocalDescription(name, category, price) {
  const nameLower = name.toLowerCase();
  
  // Find best matching food entry
  let found = null;
  let matchKey = '';
  for (const key of Object.keys(FOOD_DB)) {
    if (nameLower.includes(key)) {
      if (!found || key.length > matchKey.length) {
        found = FOOD_DB[key];
        matchKey = key;
      }
    }
  }

  // Detect type from category if no name match
  const catLower = (category || '').toLowerCase();
  let type = found?.type || 'default';
  if (!found) {
    if (catLower.includes('beverage') || catLower.includes('drink') || catLower.includes('juice')) type = 'beverage';
    else if (catLower.includes('breakfast') || catLower.includes('brunch')) type = 'breakfast';
    else if (catLower.includes('snack') || catLower.includes('starter') || catLower.includes('appetizer')) type = 'snack';
    else if (catLower.includes('dessert') || catLower.includes('sweet')) type = 'dessert';
    else if (catLower.includes('main') || catLower.includes('mains')) type = 'main';
    else if (catLower.includes('combo')) type = 'combo';
  }

  const templates = CAT_TEMPLATES[type] || CAT_TEMPLATES.default;
  const tagline   = templates[Math.floor(Math.random() * templates.length)];
  const nutrition = NUTRITION_NOTES[type] || NUTRITION_NOTES.default;

  // Price tier label
  const priceLabel = price < 100 ? 'Budget-friendly' : price < 300 ? 'Great value' : price < 600 ? 'Mid-range' : 'Premium';

  if (found) {
    return `${tagline}. Bursting with ${found.taste} flavours, this dish features ${found.ingr}. ` +
           `Approx. ${found.cal} kcal · ${nutrition} · ${priceLabel} at ₹${price}.`;
  }

  // Generic fallback built from name
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1);
  return `${tagline}. Our ${capitalName} is prepared fresh daily using premium ingredients, ` +
         `crafted to deliver bold, satisfying flavours in every bite. ` +
         `${nutrition} · ${priceLabel} at ₹${price}.`;
}

/**
 * generateAIDescription(name, category, price, apiKey)
 * Tries Gemini API first; falls back to local generator.
 */
export async function generateAIDescription(name, category, price, apiKey) {
  if (apiKey) {
    try {
      const prompt = `Write a mouth-watering, eye-catching dish description for a restaurant menu for: "${name}" (Category: ${category || 'General'}, Price: ₹${price}). 
Keep it to 2-3 sentences (max 250 characters). Include: 1) a taste/flavour description, 2) 3-4 key ingredients, 3) estimated calories. 
Format: [Taste description]. [Key ingredients]. [Approx X kcal · brief nutrition note].
Make it exciting, appetizing and helpful. No hashtags, no quotes.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 120, temperature: 0.8 }
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text && text.length > 20) return text;
      }
    } catch (e) {
      console.warn('Gemini API failed, using local generator:', e.message);
    }
  }
  return generateLocalDescription(name, category, price);
}

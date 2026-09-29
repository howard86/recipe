import "dotenv/config";

import { parseIngredient } from "@workspace-template/data/recipe/ingredient";
import {
  RecipeInputSchema,
  type TagInput,
} from "@workspace-template/data/recipe/schema";
import { prisma } from "./client";
import { createRecipe } from "./recipes";

const DEFAULT_USERS = [
  {
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN" as const,
  },
];

const KITCHEN = {
  email: "kitchen@example.com",
  handle: "kitchen",
  name: "Recipe Box Kitchen",
};

interface SeedRecipe {
  cookMinutes?: number;
  description: string;
  ingredients: (string | { section: string })[];
  prepMinutes?: number;
  servings: number;
  steps: (string | { section: string })[];
  tags: TagInput[];
  title: string;
}

const RECIPES: SeedRecipe[] = [
  {
    cookMinutes: 15,
    description:
      "Buttery, garlicky noodles that come together while the water boils.",
    ingredients: [
      "8 oz spaghetti",
      "4 tbsp butter",
      "6 cloves garlic, minced",
      "2 tbsp soy sauce",
      "1 tbsp oyster sauce",
      "1/4 cup grated parmesan",
      "2 scallions, sliced",
    ],
    prepMinutes: 5,
    servings: 2,
    steps: [
      "Cook the spaghetti in salted water until just tender. Reserve 1/2 cup of the cooking water, then drain.",
      "Melt the butter over medium-low heat and cook the garlic until fragrant and golden, about 2 minutes.",
      "Stir in the soy and oyster sauces, add the noodles and a splash of pasta water, and toss until glossy.",
      "Finish with parmesan and scallions.",
    ],
    tags: [
      { kind: "CUISINE", name: "Asian" },
      { kind: "COURSE", name: "Main" },
      { kind: "DIET", name: "Vegetarian" },
      { kind: "GENERAL", name: "Weeknight" },
    ],
    title: "Garlic Butter Noodles",
  },
  {
    cookMinutes: 60,
    description:
      "A weekend lasagna with a slow meat sauce and a creamy ricotta layer.",
    ingredients: [
      { section: "Meat sauce" },
      "1 tbsp olive oil",
      "1 lb ground beef",
      "1 onion, diced",
      "3 cloves garlic, minced",
      "28 oz crushed tomatoes",
      "1 tsp dried oregano",
      { section: "Assembly" },
      "12 lasagna noodles",
      "15 oz ricotta",
      "1 egg",
      "2 cups shredded mozzarella",
      "1/2 cup grated parmesan",
    ],
    prepMinutes: 30,
    servings: 8,
    steps: [
      { section: "Meat sauce" },
      "Brown the beef in olive oil, then add onion and garlic and cook until soft.",
      "Add tomatoes and oregano and simmer for 30 minutes.",
      { section: "Assembly" },
      "Heat the oven to 375°F (190°C). Mix ricotta with the egg.",
      "Layer sauce, noodles, ricotta and mozzarella three times, ending with sauce and parmesan.",
      "Cover with foil and bake 25 minutes, uncover and bake 15 more. Rest 10 minutes before slicing.",
    ],
    tags: [
      { kind: "CUISINE", name: "Italian" },
      { kind: "COURSE", name: "Main" },
      { kind: "GENERAL", name: "Make ahead" },
    ],
    title: "Classic Lasagna",
  },
  {
    cookMinutes: 20,
    description: "Crispy chickpeas and roasted vegetables on one pan.",
    ingredients: [
      "15 oz chickpeas, drained and dried",
      "1 sweet potato, cubed",
      "1 red onion, cut into wedges",
      "2 tbsp olive oil",
      "1 tsp smoked paprika",
      "1/2 tsp cumin",
      "Salt to taste",
      "1/2 cup Greek yogurt",
      "1 lemon",
    ],
    prepMinutes: 10,
    servings: 3,
    steps: [
      "Heat the oven to 425°F (220°C).",
      "Toss the chickpeas and vegetables with oil, spices and salt. Spread on a sheet pan.",
      "Roast 20 minutes, stirring once, until the chickpeas crackle.",
      "Serve with yogurt and a squeeze of lemon.",
    ],
    tags: [
      { kind: "CUISINE", name: "Mediterranean" },
      { kind: "COURSE", name: "Main" },
      { kind: "DIET", name: "Vegetarian" },
      { kind: "DIET", name: "Gluten free" },
    ],
    title: "Sheet Pan Chickpeas",
  },
  {
    cookMinutes: 10,
    description: "Fluffy weekend pancakes. Buttermilk makes them tender.",
    ingredients: [
      "1 1/2 cups flour",
      "2 tbsp sugar",
      "1 tsp baking powder",
      "1/2 tsp baking soda",
      "1/4 tsp salt",
      "1 1/4 cups buttermilk",
      "1 egg",
      "3 tbsp melted butter",
    ],
    prepMinutes: 10,
    servings: 4,
    steps: [
      "Whisk the dry ingredients. In another bowl whisk buttermilk, egg and butter.",
      "Stir wet into dry until just combined; lumps are fine.",
      "Cook 1/4 cup portions on a buttered griddle until bubbles form, flip, and cook 1 minute more.",
    ],
    tags: [
      { kind: "CUISINE", name: "American" },
      { kind: "COURSE", name: "Breakfast" },
      { kind: "DIET", name: "Vegetarian" },
    ],
    title: "Buttermilk Pancakes",
  },
  {
    description: "Bright, crunchy and ready in ten minutes.",
    ingredients: [
      "2 cucumbers, smashed and cut into chunks",
      "1 tsp salt",
      "2 cloves garlic, grated",
      "1 tbsp rice vinegar",
      "1 tbsp soy sauce",
      "1 tsp sesame oil",
      "1 tsp chili crisp",
    ],
    prepMinutes: 10,
    servings: 2,
    steps: [
      "Salt the cucumbers and let them sit for 5 minutes, then drain.",
      "Toss with the remaining ingredients and serve cold.",
    ],
    tags: [
      { kind: "CUISINE", name: "Chinese" },
      { kind: "COURSE", name: "Side" },
      { kind: "DIET", name: "Vegan" },
      { kind: "GENERAL", name: "Quick" },
    ],
    title: "Smashed Cucumber Salad",
  },
];

function toRecipeInput(recipe: SeedRecipe) {
  let section: string | null = null;
  const ingredients = recipe.ingredients.flatMap((line) => {
    if (typeof line !== "string") {
      ({ section } = line);
      return [];
    }
    const { confidence: _confidence, ...parsed } = parseIngredient(line);
    return [{ ...parsed, raw: line, section }];
  });
  section = null;
  const steps = recipe.steps.flatMap((step) => {
    if (typeof step !== "string") {
      ({ section } = step);
      return [];
    }
    return [{ section, text: step }];
  });
  return RecipeInputSchema.parse({
    cookMinutes: recipe.cookMinutes,
    description: recipe.description,
    ingredients,
    prepMinutes: recipe.prepMinutes,
    servings: recipe.servings,
    steps,
    tags: recipe.tags,
    title: recipe.title,
    visibility: "PUBLIC",
  });
}

async function seedKitchen() {
  const kitchen = await prisma.user.upsert({
    create: { email: KITCHEN.email, name: KITCHEN.name },
    update: { name: KITCHEN.name },
    where: { email: KITCHEN.email },
  });
  await prisma.profile.upsert({
    create: { handle: KITCHEN.handle, userId: kitchen.id },
    update: {},
    where: { userId: kitchen.id },
  });
  for (const recipe of RECIPES) {
    // biome-ignore lint/performance/noAwaitInLoops: Seed order must remain deterministic.
    const existing = await prisma.recipe.findFirst({
      where: { authorId: kitchen.id, title: recipe.title },
    });
    if (!existing) {
      await createRecipe(kitchen.id, toRecipeInput(recipe));
    }
  }
}

async function main() {
  for (const user of DEFAULT_USERS) {
    // biome-ignore lint/performance/noAwaitInLoops: Seed order must remain deterministic.
    await prisma.user.upsert({
      create: user,
      update: user,
      where: { email: user.email },
    });
  }
  await seedKitchen();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

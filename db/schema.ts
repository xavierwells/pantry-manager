import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const groceryLists = sqliteTable('grocery_lists', {
  userId: text('user_id').primaryKey(),
  itemsJson: text('items_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const recipeBooks = sqliteTable('recipe_books', {
  userId: text('user_id').primaryKey(),
  recipesJson: text('recipes_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

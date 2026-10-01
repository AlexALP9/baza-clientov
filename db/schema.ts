import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const clients=sqliteTable('clients',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),status:integer('status').notNull(),updatedAt:text('updated_at').notNull()},table=>[index('idx_clients_owner').on(table.owner)]);

import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: int('id').primaryKey({ autoIncrement: true }).default(1),
  title: text('title').notNull().default('')
});

// 相关配置信息表

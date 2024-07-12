// 这个一个相关状态和一些配置文件保存的的数据库功能程序
import path from 'path';
import fs from 'fs-extra';
import Database from 'better-sqlite3';

// 数据库保存的地址
const dbPath = path.join(__dirname, '../../db/database.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

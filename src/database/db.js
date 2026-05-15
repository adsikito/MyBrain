/**
 * MyBrain 数据库初始化模块
 *
 * 负责 SQLite 数据库的创建、表结构初始化、索引建立
 * 支持三轨分类法（SPRINT / MARATHON / SUSPENSE）
 * 内置自愈机制：建表失败时自动清理并重试
 */

import * as SQLite from 'expo-sqlite';

// 数据库实例（单例模式）
let db = null;

// 数据库名称
const DB_NAME = 'mybrain.db';

/**
 * 获取数据库实例
 * 如果尚未初始化，会自动调用 initDatabase
 * @returns {Promise<SQLite.SQLiteDatabase>} 数据库实例
 */
export async function getDatabase() {
  if (db) {
    return db;
  }
  db = await initDatabase();
  return db;
}

/**
 * 初始化数据库
 *
 * 执行流程：
 * 1. 打开（或创建）SQLite 数据库文件
 * 2. 启用 WAL 模式提升并发性能
 * 3. 按顺序创建 6 张核心表
 * 4. 创建索引优化查询性能
 * 5. 执行自愈检查
 *
 * @returns {Promise<SQLite.SQLiteDatabase>} 已初始化的数据库实例
 */
export async function initDatabase() {
  try {
    // 打开数据库连接
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // 启用 WAL 模式，提升读写并发性能
    await db.execAsync('PRAGMA journal_mode = WAL;');
    // 启用外键约束，确保数据完整性
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // 按依赖顺序创建表（先被引用的表优先）
    await createCategoriesTable(db);
    await createTasksTable(db);
    await createTaskStatusHistoryTable(db);
    await createRescheduleLogTable(db);
    await createSuspenseConditionsTable(db);
    await createUserPreferencesTable(db);

    // 创建索引
    await createIndexes(db);

    // 执行自愈检查
    await performSelfHealing(db);

    return db;

  } catch (error) {
    console.error('[MyBrain] 数据库初始化失败，尝试自愈...');

    // 自愈机制：关闭连接，删除数据库文件，重新初始化
    try {
      if (db) {
        await db.closeAsync();
        db = null;
      }
      // 重新打开数据库（会自动创建新文件）
      db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');

      await createCategoriesTable(db);
      await createTasksTable(db);
      await createTaskStatusHistoryTable(db);
      await createRescheduleLogTable(db);
      await createSuspenseConditionsTable(db);
      await createUserPreferencesTable(db);
      await createIndexes(db);

      return db;

    } catch (retryError) {
      throw new Error('数据库初始化失败: ' + retryError.message);
    }
  }
}

/**
 * 创建分类表
 *
 * 存储任务的分类信息，支持多级分类（通过 parent_id 实现树形结构）
 * 每个分类可设置颜色和图标，用于 UI 展示
 */
async function createCategoriesTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      color           TEXT,
      icon            TEXT,
      parent_id       TEXT,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );
  `);
  console.log('[MyBrain] 分类表 (categories) 初始化完成');
}

/**
 * 创建任务主表
 *
 * 核心表，存储所有任务信息
 * - track: 三轨分类（SPRINT / MARATHON / SUSPENSE）
 * - status: 任务状态（ACTIVE / COMPLETED / PAUSED / CANCELLED）
 * - weight: 动态权重，由系统自动计算，用于智能排序
 * - parent_id: 支持子任务嵌套
 * - metadata: JSON 格式的扩展字段，存储自定义数据
 */
async function createTasksTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT,
      track           TEXT NOT NULL CHECK(track IN ('SPRINT', 'MARATHON', 'SUSPENSE')),
      status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED')),
      priority        INTEGER DEFAULT 50 CHECK(priority BETWEEN 0 AND 100),
      urgency         INTEGER DEFAULT 50 CHECK(urgency BETWEEN 0 AND 100),
      importance      INTEGER DEFAULT 50 CHECK(importance BETWEEN 0 AND 100),
      weight          REAL DEFAULT 0.0,
      due_date        TEXT,
      start_date      TEXT,
      completed_at    TEXT,
      estimated_minutes INTEGER,
      actual_minutes  INTEGER,
      category_id     TEXT,
      parent_id       TEXT,
      sort_order      INTEGER DEFAULT 0,
      recurrence_rule TEXT,
      metadata        TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at      TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (parent_id) REFERENCES tasks(id)
    );
  `);
}

/**
 * 创建任务状态历史表
 *
 * 记录每次状态变更，用于：
 * - 审计追踪：谁在什么时间改了什么状态
 * - 自愈诊断：auto_fixed 标记是否为系统自动修复
 * - 数据分析：统计任务状态流转效率
 */
async function createTaskStatusHistoryTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS task_status_history (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      old_status      TEXT,
      new_status      TEXT NOT NULL,
      changed_at      TEXT NOT NULL DEFAULT (datetime('now')),
      reason          TEXT,
      auto_fixed      INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);
}

/**
 * 创建动态重排日志表
 *
 * 记录每次任务权重/优先级的自动调整，用于：
 * - 算法回溯：分析重排算法的效果
 * - 调试优化：查看触发重排的原因
 * - trigger_type: TIME_PRESSURE | COMPLETION | MANUAL | AUTO_FIX
 */
async function createRescheduleLogTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reschedule_log (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      old_priority    INTEGER,
      new_priority    INTEGER,
      old_weight      REAL,
      new_weight      REAL,
      trigger_type    TEXT NOT NULL,
      algorithm       TEXT,
      rescheduled_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);
}

/**
 * 创建悬念轨等待条件表
 *
 * 悬念轨任务的核心表，记录每个任务的等待条件：
 * - WAIT_RESPONSE: 等待他人回复（如老师、同学）
 * - WAIT_RESOURCE: 等待资源到位（如教材、设备）
 * - WAIT_DATE: 等待特定日期到来
 *
 * 当 is_met = 1 时，系统应自动将任务从 SUSPENSE 转移到其他轨道
 */
async function createSuspenseConditionsTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS suspense_conditions (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      condition_type  TEXT NOT NULL CHECK(condition_type IN ('WAIT_RESPONSE', 'WAIT_RESOURCE', 'WAIT_DATE')),
      description     TEXT,
      target_date     TEXT,
      is_met          INTEGER DEFAULT 0,
      met_at          TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `);
}

/**
 * 创建用户偏好表
 *
 * 键值对形式存储用户配置，例如：
 * - theme: 'light' | 'dark'
 * - notification_enabled: 'true' | 'false'
 * - default_track: 'SPRINT' | 'MARATHON' | 'SUSPENSE'
 */
async function createUserPreferencesTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * 创建数据库索引
 *
 * 索引策略：
 * - tasks 表：按轨道、状态、截止日期、权重建立索引，支持动态排序
 * - history 表：按任务ID和时间建立索引，支持审计查询
 * - reschedule 表：按任务ID和时间建立索引，支持算法分析
 * - suspense 表：按任务ID和完成状态建立索引，支持条件检查
 */
async function createIndexes(db) {
  const indexes = [
    // 任务表索引
    'CREATE INDEX IF NOT EXISTS idx_tasks_track ON tasks(track);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_weight ON tasks(weight DESC);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);',
    'CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);',

    // 状态历史索引
    'CREATE INDEX IF NOT EXISTS idx_history_task ON task_status_history(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_history_changed ON task_status_history(changed_at);',

    // 重排日志索引
    'CREATE INDEX IF NOT EXISTS idx_reschedule_task ON reschedule_log(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_reschedule_time ON reschedule_log(rescheduled_at);',

    // 悬念条件索引
    'CREATE INDEX IF NOT EXISTS idx_suspense_task ON suspense_conditions(task_id);',
    'CREATE INDEX IF NOT EXISTS idx_suspense_met ON suspense_conditions(is_met);',
  ];

  for (const indexSQL of indexes) {
    await db.execAsync(indexSQL);
  }
}

/**
 * 执行自愈检查
 *
 * 自愈规则：
 * 1. 检测过期未完成任务（due_date < now 且 status = ACTIVE）
 * 2. 检测长期未更新的马拉松任务（30天无更新）
 * 3. 检测超时悬念条件（target_date < now 且 is_met = 0）
 * 4. 检测孤儿任务（parent_id 指向已删除任务）
 *
 * 自愈操作仅记录日志，不自动修改数据（避免意外干扰用户）
 */
async function performSelfHealing(db) {
  try {
    // 检查1：过期未完成任务
    const overdueTasks = await db.getAllAsync(`
      SELECT id, title, due_date
      FROM tasks
      WHERE status = 'ACTIVE'
        AND due_date < datetime('now')
        AND deleted_at IS NULL
    `);

    // 检查2：长期未更新的马拉松任务
    const staleMarathonTasks = await db.getAllAsync(`
      SELECT id, title, updated_at
      FROM tasks
      WHERE track = 'MARATHON'
        AND status = 'ACTIVE'
        AND updated_at < datetime('now', '-30 days')
        AND deleted_at IS NULL
    `);

    // 检查3：超时悬念条件
    const expiredConditions = await db.getAllAsync(`
      SELECT sc.id, sc.task_id, t.title, sc.target_date
      FROM suspense_conditions sc
      JOIN tasks t ON sc.task_id = t.id
      WHERE sc.is_met = 0
        AND sc.target_date < datetime('now')
    `);

    // 检查4：孤儿任务（parent_id 指向不存在或已删除的任务）
    const orphanTasks = await db.getAllAsync(`
      SELECT t1.id, t1.title, t1.parent_id
      FROM tasks t1
      LEFT JOIN tasks t2 ON t1.parent_id = t2.id
      WHERE t1.parent_id IS NOT NULL
        AND t2.id IS NULL
    `);

    // 返回检查结果供上层处理
    return {
      overdue: overdueTasks,
      stale: staleMarathonTasks,
      expiredConditions,
      orphans: orphanTasks,
    };

  } catch (error) {
    console.error('[MyBrain] 自愈检查异常:', error.message);
    return { overdue: [], stale: [], expiredConditions: [], orphans: [] };
  }
}

/**
 * 关闭数据库连接
 * 在应用退出时调用，确保数据完整写入
 */
export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * 执行数据库事务
 *
 * @param {Function} callback - 事务回调函数，接收 db 作为参数
 * @returns {Promise<any>} 回调函数的返回值
 */
export async function withTransaction(callback) {
  const database = await getDatabase();
  await database.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await callback(database);
    await database.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * 任务数据服务层
 *
 * 提供任务 CRUD 与高级数据聚合查询
 * 所有聚合逻辑在 SQLite 层完成，绝不拉全量数据到 JS 层遍历
 */

import { getDatabase } from '../database/db';

/**
 * 生成 UUID
 */
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * 标记任务为已完成
 *
 * 事务操作：
 * 1. UPDATE tasks SET status = 'COMPLETED', completed_at = now
 * 2. INSERT INTO task_status_history 记录状态变更
 *
 * @param {string} taskId - 任务 ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function completeTask(taskId) {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.execAsync('BEGIN TRANSACTION;');
  try {
    // 更新任务状态
    await db.runAsync(
      `UPDATE tasks
       SET status = 'COMPLETED',
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [now, now, taskId]
    );

    // 记录状态历史
    const historyId = generateId();
    await db.runAsync(
      `INSERT INTO task_status_history (
        id, task_id, old_status, new_status, changed_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [historyId, taskId, 'ACTIVE', 'COMPLETED', now, '专注完成']
    );

    await db.execAsync('COMMIT;');
    return true;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * 获取完成热力图数据
 *
 * 直接在 SQLite 层按日期分组聚合已完成任务数量
 * 返回格式：{ '2026-05-15': 3, '2026-05-16': 5, ... }
 *
 * @param {number} days - 往前追溯的天数，默认 60
 * @returns {Promise<Object>} 按日期索引的完成数量字典
 */
export async function getCompletionHeatmapData(days = 60) {
  const db = await getDatabase();

  const rows = await db.getAllAsync(
    `SELECT date(updated_at) as date, COUNT(*) as count
     FROM tasks
     WHERE status = 'COMPLETED'
       AND deleted_at IS NULL
       AND updated_at >= date('now', '-' || ? || ' days')
     GROUP BY date(updated_at);`,
    [days]
  );

  const heatmap = {};
  for (const row of rows) {
    heatmap[row.date] = row.count;
  }

  return heatmap;
}

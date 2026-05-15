/**
 * 自愈引擎 (Healing Engine)
 *
 * 核心职责：
 * 1. 扫描超时的 SPRINT 任务
 * 2. 检测计划偏移
 * 3. 提供 AI 重排建议
 * 4. 自动修复异常状态
 */

import { getDatabase } from '../database/db';
import { callAI } from '../services/aiService';

/**
 * 生成 UUID
 */
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * 检查并修复超时任务
 *
 * 扫描逻辑：
 * 1. 查找所有 SPRINT 轨道的 ACTIVE 任务
 * 2. 筛选出 due_date 已过期的任务
 * 3. 返回偏移报告
 *
 * @returns {Promise<Object>} 偏移报告
 */
export async function checkOverdueTasks() {
  const db = await getDatabase();

  // 查询超时的 SPRINT 任务
  const overdueTasks = await db.getAllAsync(`
    SELECT id, title, description, due_date, urgency, importance
    FROM tasks
    WHERE track = 'SPRINT'
      AND status = 'ACTIVE'
      AND due_date IS NOT NULL
      AND due_date < datetime('now')
      AND deleted_at IS NULL
    ORDER BY due_date ASC
  `);

  // 查询即将到期的任务（24小时内）
  const upcomingTasks = await db.getAllAsync(`
    SELECT id, title, description, due_date, urgency, importance
    FROM tasks
    WHERE track = 'SPRINT'
      AND status = 'ACTIVE'
      AND due_date IS NOT NULL
      AND due_date BETWEEN datetime('now') AND datetime('now', '+1 day')
      AND deleted_at IS NULL
    ORDER BY due_date ASC
  `);

  return {
    overdue: overdueTasks,
    upcoming: upcomingTasks,
    hasDrift: overdueTasks.length > 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 执行自愈重排
 *
 * 流程：
 * 1. 收集所有待处理任务
 * 2. 调用 AI 进行智能重排
 * 3. 更新数据库
 * 4. 记录重排日志
 *
 * @param {Array} overdueTasks - 超时任务列表
 * @returns {Promise<Object>} 重排结果
 */
export async function performHealing(overdueTasks) {
  if (!overdueTasks || overdueTasks.length === 0) {
    return { success: true, message: '无需重排', rescheduled: 0 };
  }

  const db = await getDatabase();
  const now = new Date().toISOString();

  try {
    // 构建重排提示词
    const taskList = overdueTasks.map((t, i) =>
      `${i + 1}. ${t.title}（截止: ${t.due_date}，紧急度: ${t.urgency}，重要度: ${t.importance}）`
    ).join('\n');

    const prompt = `以下是已过期的 SPRINT 任务，请帮我重新规划：

${taskList}

当前时间：${now}

请给出重新安排建议，包括：
1. 哪些任务可以延期到什么时间
2. 哪些任务应该提升优先级
3. 哪些任务可能需要取消或转为 MARATHON

要求：
- 保持务实，不要过于乐观
- 考虑任务的实际重要性
- 给出具体的新截止日期`;

    // 调用 AI 获取重排建议
    const aiResponse = await callAI(prompt, { temperature: 0.4 });

    // 应用重排建议
    let rescheduledCount = 0;

    for (const task of aiResponse.tasks) {
      // 查找原任务
      const original = overdueTasks.find(t => t.title === task.title);
      if (!original) continue;

      // 更新任务
      await db.runAsync(
        `UPDATE tasks SET
          urgency = ?,
          importance = ?,
          due_date = ?,
          track = ?,
          weight = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          task.urgency || original.urgency,
          task.importance || original.importance,
          task.due_date || original.due_date,
          task.track || 'SPRINT',
          (task.urgency || 50) * 0.4 + (task.importance || 50) * 0.3,
          now,
          original.id,
        ]
      );

      // 记录重排日志
      await db.runAsync(
        `INSERT INTO reschedule_log (
          id, task_id, old_priority, new_priority,
          old_weight, new_weight, trigger_type, algorithm, rescheduled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          original.id,
          original.urgency,
          task.urgency || original.urgency,
          original.urgency * 0.4 + original.importance * 0.3,
          (task.urgency || 50) * 0.4 + (task.importance || 50) * 0.3,
          'AUTO_FIX',
          'AI_HEALER',
          now,
        ]
      );

      rescheduledCount++;
    }

    return {
      success: true,
      message: `已重排 ${rescheduledCount} 个任务`,
      rescheduled: rescheduledCount,
      aiSuggestion: aiResponse,
    };

  } catch (error) {
    return {
      success: false,
      message: '重排失败: ' + error.message,
      rescheduled: 0,
    };
  }
}

/**
 * 执行完整自愈流程
 *
 * 这是主入口函数，供 UI 层调用
 * 返回偏移检测结果，供 UI 决定是否弹出确认对话框
 *
 * @returns {Promise<Object>} 检测结果
 */
export async function checkAndHeal() {
  try {
    // 检测偏移
    const driftReport = await checkOverdueTasks();

    return driftReport;

  } catch (error) {
    return {
      overdue: [],
      upcoming: [],
      hasDrift: false,
      error: error.message,
    };
  }
}

/**
 * 自动修复悬念头任务
 *
 * 检查 suspense_conditions 中已满足条件的任务
 * 自动将其转移到 SPRINT 或 MARATHON
 *
 * @returns {Promise<number>} 修复的任务数量
 */
export async function healSuspenseTasks() {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // 查找条件已满足的悬念任务
  const metConditions = await db.getAllAsync(`
    SELECT sc.id as condition_id, sc.task_id, sc.condition_type,
           t.title, t.urgency, t.importance
    FROM suspense_conditions sc
    JOIN tasks t ON sc.task_id = t.id
    WHERE sc.is_met = 0
      AND sc.target_date IS NOT NULL
      AND sc.target_date < datetime('now')
      AND t.status = 'ACTIVE'
  `);

  let healedCount = 0;

  for (const condition of metConditions) {
    // 根据条件类型决定转移轨道
    const newTrack = condition.condition_type === 'WAIT_DATE' ? 'SPRINT' : 'MARATHON';

    // 更新任务轨道
    await db.runAsync(
      `UPDATE tasks SET track = ?, updated_at = ? WHERE id = ?`,
      [newTrack, now, condition.task_id]
    );

    // 标记条件为已满足
    await db.runAsync(
      `UPDATE suspense_conditions SET is_met = 1, met_at = ? WHERE id = ?`,
      [now, condition.condition_id]
    );

    // 记录状态历史
    await db.runAsync(
      `INSERT INTO task_status_history (id, task_id, old_status, new_status, changed_at, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), condition.task_id, 'ACTIVE', 'ACTIVE', now, `悬念条件满足，转为 ${newTrack}`]
    );

    healedCount++;
  }

  return healedCount;
}

/**
 * 定期自愈任务
 *
 * 建议在应用启动时和定期间隔调用
 *
 * @param {Function} onDriftDetected - 检测到偏移时的回调
 * @returns {Promise<void>}
 */
export async function runPeriodicHealing(onDriftDetected) {
  // 修复悬念任务
  await healSuspenseTasks();

  // 检查 SPRINT 任务偏移
  const report = await checkAndHeal();

  if (report.hasDrift && onDriftDetected) {
    onDriftDetected(report);
  }
}

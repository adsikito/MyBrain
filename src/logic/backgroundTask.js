/**
 * 后台任务管理模块
 *
 * 负责：
 * 1. 注册后台任务
 * 2. 配置任务触发条件
 * 3. 处理任务执行逻辑
 * 4. 适配 vivo 后台限制
 *
 * 技术说明：
 * - 使用 expo-task-manager 管理后台任务
 * - 使用 expo-background-fetch 定时触发
 * - 任务间隔 15-30 分钟（系统限制）
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { checkAndHeal, healSuspenseTasks } from './healer';
import { checkBackgroundRestriction } from './permissionManager';

// ============================================================
// 常量定义
// ============================================================

/**
 * 后台任务名称
 * 必须是全局唯一的标识符
 */
export const BACKGROUND_HEAL_TASK = 'mybrain-background-heal';

/**
 * 通知渠道配置（vivo 专用）
 *
 * vivo 原子通知要求：
 * 1. channelId 必须是稳定的标识符
 * 2. importance 必须设置为 MAX 才能突破通知折叠
 * 3. 需要适配 vivo 的通知图标要求
 */
const VIVO_NOTIFICATION_CHANNEL = {
  id: 'mybrain-healing',
  name: 'MyBrain 自愈通知',
  description: '任务自愈和计划重排提醒',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FF6B6B',
  sound: 'default',
  bypassDnd: false,
  showBadge: true,
};

/**
 * 通知配置
 *
 * 适配 vivo 的关键设置：
 * - priority: 'max' 确保通知不被折叠
 * - channelId 使用专门的 vivo 渠道
 * - color 设置品牌色（vivo 原子通知会显示）
 */
const NOTIFICATION_CONFIG = {
  // Android 通知配置
  android: {
    channelId: VIVO_NOTIFICATION_CHANNEL.id,
    importance: Notifications.AndroidImportance.MAX,
    priority: 'max',
    vibrate: [0, 250, 250, 250],
    color: '#FF6B6B',  // 品牌色，vivo 原子通知会显示
    icon: 'notification',  // 需要在 android/app/src/main/res 下配置
    sticky: false,
    autoCancel: true,
  },
  // iOS 通知配置
  ios: {
    sound: 'default',
    badge: true,
  },
};

// ============================================================
// 通知初始化
// ============================================================

/**
 * 初始化通知系统
 *
 * 配置说明：
 * 1. 设置通知处理器
 * 2. 创建 vivo 专用通知渠道
 * 3. 配置通知展示样式
 *
 * vivo 适配要点：
 * - 必须在应用启动时就创建通知渠道
 * - 渠道一旦创建，修改需要用户手动操作
 * - importance 设置为 MAX 才能突破原子通知的折叠
 */
export async function initializeNotifications() {
  try {
    // 设置通知处理器
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });

    // 创建 Android 通知渠道（vivo 专用）
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        VIVO_NOTIFICATION_CHANNEL.id,
        {
          ...VIVO_NOTIFICATION_CHANNEL,
          // vivo 原子通知适配
          // 确保通知图标符合 vivo 规范
          // 建议使用纯色图标，避免复杂图形
        }
      );
    }

    // 请求通知权限
    const { status } = await Notifications.requestPermissionsAsync();

    return status === 'granted';
  } catch (error) {
    console.error('[后台任务] 通知初始化失败:', error.message);
    return false;
  }
}

/**
 * 发送本地通知
 *
 * @param {Object} options - 通知选项
 * @param {string} options.title - 通知标题
 * @param {string} options.body - 通知内容
 * @param {Object} options.data - 附加数据
 */
export async function sendLocalNotification({ title, body, data = {} }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        ...NOTIFICATION_CONFIG,
        // vivo 原子通知适配
        // color 字段会在 vivo 系统上显示为通知图标的背景色
        color: '#FF6B6B',
      },
      trigger: null, // 立即发送
    });
  } catch (error) {
    console.error('[后台任务] 发送通知失败:', error.message);
  }
}

// ============================================================
// 后台任务定义
// ============================================================

/**
 * 定义后台任务
 *
 * 重要提示：
 * - TaskManager.defineTask 必须在模块顶层调用
 * - 不能在函数内部调用，否则会注册失败
 * - 任务执行时应用可能被挂起，需要处理好状态
 */
TaskManager.defineTask(BACKGROUND_HEAL_TASK, async () => {
  try {
    // 检查后台受限状态
    const bgRestriction = checkBackgroundRestriction();
    if (bgRestriction.isRestricted) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 执行悬念任务自愈
    await healSuspenseTasks();

    // 检查 SPRINT 任务偏移
    const driftReport = await checkAndHeal();

    if (driftReport.hasDrift) {
      // 发送通知提醒用户
      await sendLocalNotification({
        title: '检测到计划偏移',
        body: `有 ${driftReport.overdue.length} 个冲刺任务已过期，点击查看详情`,
        data: {
          type: 'drift_detected',
          taskCount: driftReport.overdue.length,
        },
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;

  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ============================================================
// 后台任务注册
// ============================================================

/**
 * 注册后台任务
 *
 * 注册策略：
 * - 最小间隔 15 分钟（Android 系统限制）
 * - 设置为 15-30 分钟的随机间隔
 * - 在 vivo 设备上可能被系统延迟
 *
 * @returns {Promise<boolean>} 注册是否成功
 */
export async function registerBackgroundTask() {
  try {
    // 检查是否已注册
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEAL_TASK);
    if (isRegistered) {
      return true;
    }

    // 注册后台任务
    await BackgroundFetch.registerTaskAsync(BACKGROUND_HEAL_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 注销后台任务
 *
 * @returns {Promise<boolean>} 注销是否成功
 */
export async function unregisterBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEAL_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_HEAL_TASK);
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取后台任务状态
 *
 * @returns {Promise<Object>} 任务状态
 */
export async function getBackgroundTaskStatus() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEAL_TASK);
    const status = await BackgroundFetch.getStatusAsync();

    return {
      isRegistered,
      status,
      statusText: getStatusText(status),
    };
  } catch (error) {
    return {
      isRegistered: false,
      status: null,
      statusText: '未知',
      error: error.message,
    };
  }
}

/**
 * 状态码转文字
 */
function getStatusText(status) {
  switch (status) {
    case BackgroundFetch.BackgroundFetchStatus.Available:
      return '可用';
    case BackgroundFetch.BackgroundFetchStatus.Denied:
      return '已拒绝';
    case BackgroundFetch.BackgroundFetchStatus.Restricted:
      return '受限';
    default:
      return '未知';
  }
}

// ============================================================
// 生产环境建议
// ============================================================

/**
 * 生产环境稳定运行建议
 *
 * 1. 使用 EAS Build 构建生产版本
 *    - Expo Go 不支持后台任务
 *    - 需要原生构建才能完整测试
 *
 * 2. vivo 设备特殊处理
 *    - 引导用户开启自启动权限
 *    - 引导用户关闭电池优化
 *    - 使用高优先级通知渠道
 *
 * 3. 通知图标适配
 *    - 准备符合 vivo 规范的通知图标
 *    - 图标尺寸：24x24dp
 *    - 颜色：纯白色，透明背景
 *    - 避免复杂图形，使用简洁线条
 *
 * 4. 测试建议
 *    - 使用 `adb shell am broadcast` 模拟后台任务
 *    - 检查 `adb logcat` 查看任务执行日志
 *    - 在真机上测试后台运行状态
 *
 * 5. 监控建议
 *    - 记录任务执行频率
 *    - 监控任务失败率
 *    - 收集用户反馈
 */

/**
 * 导出配置供外部使用
 */
export const BackgroundTaskConfig = {
  TASK_NAME: BACKGROUND_HEAL_TASK,
  NOTIFICATION_CHANNEL: VIVO_NOTIFICATION_CHANNEL,
  NOTIFICATION_CONFIG,
};

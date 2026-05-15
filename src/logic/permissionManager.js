/**
 * 权限管理模块
 *
 * 负责：
 * 1. 检查通知权限状态
 * 2. 检测 vivo 后台受限状态
 * 3. 提供权限申请接口
 * 4. 生成权限状态报告
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';

// ============================================================
// 常量定义
// ============================================================

/**
 * vivo 设备标识
 * 用于检测当前设备是否为 vivo 系列
 */
const VIVO_BRANDS = ['vivo', 'bbk', 'iqoo'];

/**
 * 权限状态枚举
 */
export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
  RESTRICTED: 'restricted',  // 后台受限（vivo 特有）
};

// ============================================================
// 设备检测
// ============================================================

/**
 * 检测是否为 vivo 设备
 *
 * @returns {boolean} 是否为 vivo 系列设备
 */
export function isVivoDevice() {
  const brand = (Device.brand || '').toLowerCase();
  return VIVO_BRANDS.some(v => brand.includes(v));
}

/**
 * 检测是否为 Android 设备
 *
 * @returns {boolean} 是否为 Android
 */
export function isAndroid() {
  return Platform.OS === 'android';
}

/**
 * 获取设备信息摘要
 *
 * @returns {Object} 设备信息
 */
export function getDeviceInfo() {
  return {
    brand: Device.brand || '未知',
    modelName: Device.modelName || '未知',
    osName: Device.osName || '未知',
    osVersion: Device.osVersion || '未知',
    isVivo: isVivoDevice(),
    isAndroid: isAndroid(),
  };
}

// ============================================================
// 通知权限
// ============================================================

/**
 * 检查通知权限状态
 *
 * @returns {Promise<Object>} 权限状态对象
 */
export async function checkNotificationPermission() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    return {
      status: existingStatus,
      isGranted: existingStatus === 'granted',
      canAskAgain: existingStatus !== 'denied',
    };
  } catch (error) {
    console.error('[权限管理] 检查通知权限失败:', error.message);
    return {
      status: PermissionStatus.UNDETERMINED,
      isGranted: false,
      canAskAgain: true,
      error: error.message,
    };
  }
}

/**
 * 请求通知权限
 *
 * @returns {Promise<Object>} 请求结果
 */
export async function requestNotificationPermission() {
  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return {
      status,
      isGranted: status === 'granted',
    };
  } catch (error) {
    console.error('[权限管理] 请求通知权限失败:', error.message);
    return {
      status: PermissionStatus.DENIED,
      isGranted: false,
      error: error.message,
    };
  }
}

// ============================================================
// 后台权限检测（vivo 特有）
// ============================================================

/**
 * 检测后台受限状态
 *
 * vivo 特有逻辑：
 * 1. 检查是否为 vivo 设备
 * 2. 检查应用是否被系统限制后台运行
 * 3. 返回需要开启的权限列表
 *
 * 注意：此函数无法直接检测系统限制，只能通过设备信息推断
 * 实际状态需要用户手动确认
 *
 * @returns {Object} 后台权限状态
 */
export function checkBackgroundRestriction() {
  const deviceInfo = getDeviceInfo();

  // 非 vivo 设备通常没有严格的后台限制
  if (!deviceInfo.isVivo) {
    return {
      isRestricted: false,
      needsGuide: false,
      missingPermissions: [],
      deviceInfo,
    };
  }

  // vivo 设备需要检查的权限列表
  // 由于无法直接检测，我们假设这些权限可能需要手动开启
  const vivoPermissions = [
    {
      id: 'autostart',
      name: '自启动',
      description: '允许应用在后台自动启动',
      critical: true,
    },
    {
      id: 'background_high_power',
      name: '允许后台高耗电',
      description: '防止系统因省电而暂停应用',
      critical: true,
    },
    {
      id: 'lock_screen_display',
      name: '锁屏显示',
      description: '允许在锁屏状态下显示通知',
      critical: false,
    },
  ];

  return {
    isRestricted: true,  // vivo 设备默认视为可能受限
    needsGuide: true,
    missingPermissions: vivoPermissions,
    deviceInfo,
  };
}

/**
 * 打开应用设置页面
 *
 * 引导用户手动开启权限
 */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('[权限管理] 无法打开设置:', error.message);
    // 尝试打开系统设置
    try {
      await Linking.sendIntent('android.settings.APPLICATION_SETTINGS');
    } catch (e) {
      console.error('[权限管理] 无法打开系统设置:', e.message);
    }
  }
}

/**
 * 打开 vivo 电池优化设置
 *
 * 专门针对 vivo 的电池管理页面
 */
export async function openVivoBatterySettings() {
  try {
    // 尝试直接打开电池优化页面
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch (error) {
    console.error('[权限管理] 无法打开电池设置:', error.message);
    // 降级到应用设置
    await openAppSettings();
  }
}

// ============================================================
// 综合权限检查
// ============================================================

/**
 * 执行完整的权限检查
 *
 * @returns {Promise<Object>} 完整的权限报告
 */
export async function performFullPermissionCheck() {
  const deviceInfo = getDeviceInfo();
  const notificationPerm = await checkNotificationPermission();
  const backgroundRestriction = checkBackgroundRestriction();

  // 计算整体状态
  const allGranted = notificationPerm.isGranted && !backgroundRestriction.isRestricted;
  const hasCriticalIssue = !notificationPerm.isGranted || (deviceInfo.isVivo && backgroundRestriction.isRestricted);

  return {
    deviceInfo,
    notification: notificationPerm,
    background: backgroundRestriction,
    summary: {
      allGranted,
      hasCriticalIssue,
      needsAction: hasCriticalIssue,
      message: allGranted
        ? '所有权限已就绪'
        : hasCriticalIssue
          ? '部分权限需要手动开启'
          : '建议开启部分权限以获得最佳体验',
    },
  };
}

/**
 * 生成权限检查报告（用于 UI 展示）
 *
 * @returns {Promise<Array>} 权限项列表
 */
export async function generatePermissionReport() {
  const report = await performFullPermissionCheck();
  const items = [];

  // 通知权限项
  items.push({
    id: 'notification',
    name: '通知权限',
    description: '用于任务提醒和自愈通知',
    status: report.notification.isGranted ? 'granted' : 'denied',
    isCritical: true,
    action: report.notification.isGranted ? null : requestNotificationPermission,
  });

  // vivo 特有权限项
  if (report.deviceInfo.isVivo) {
    for (const perm of report.background.missingPermissions) {
      items.push({
        id: perm.id,
        name: perm.name,
        description: perm.description,
        status: 'unknown',  // 无法直接检测
        isCritical: perm.critical,
        action: openAppSettings,
      });
    }
  }

  return {
    items,
    summary: report.summary,
    deviceInfo: report.deviceInfo,
  };
}

/**
 * TaskDetailScreen - 任务详情 + 番茄钟专注模式
 *
 * 核心功能：
 * - 任务详情展示
 * - 全屏沉浸式倒计时专注模式
 * - 前台 JS 倒计时 + 原生通知兜底
 * - 专注结束震动反馈 + 完成确认
 *
 * 无网络依赖，纯本地调度
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  StatusBar,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { completeTask } from '../services/taskService';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../theme/theme';

// ============================================================
// 通知配置
// ============================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================================
// 工具函数
// ============================================================

/**
 * 将秒数格式化为 MM:SS
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// TaskDetailScreen 主组件
// ============================================================

/**
 * @param {Object} props
 * @param {Object} props.task - 任务对象
 * @param {Function} props.onBack - 返回上一页回调
 */
export default function TaskDetailScreen({ task, onBack }) {
  // 专注状态
  const [isFocusing, setIsFocusing] = useState(false);
  // 剩余秒数
  const [timeLeft, setTimeLeft] = useState(0);

  // interval 引用，用于 cleanup
  const intervalRef = useRef(null);
  // 通知 ID 引用，用于取消
  const notificationIdRef = useRef(null);
  // 组件挂载标记
  const isMountedRef = useRef(true);

  // ============================================================
  // 清理：组件卸载时取消定时器和通知
  // ============================================================

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      Notifications.cancelAllScheduledNotificationsAsync();
    };
  }, []);

  // ============================================================
  // 倒计时引擎
  // ============================================================

  useEffect(() => {
    if (!isFocusing) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 时间到，清除定时器
          clearInterval(intervalRef.current);
          intervalRef.current = null;

          // 触发结束流程（在下一个事件循环中，避免 setState 冲突）
          setTimeout(() => handleFocusComplete(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isFocusing]);

  // ============================================================
  // 开始专注
  // ============================================================

  const handleStartFocus = useCallback(async () => {
    const totalSeconds = (task.estimated_minutes || 25) * 60;

    // 初始化倒计时
    setTimeLeft(totalSeconds);
    setIsFocusing(true);

    // 调度原生通知兜底
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '时间到！',
          body: '你正在执行的任务预计时间已耗尽，请回 App 标记完成或复盘！',
          sound: true,
        },
        trigger: { seconds: totalSeconds },
      });
      notificationIdRef.current = id;
    } catch (error) {
      // 通知调度失败不影响计时功能
      console.warn('[TaskDetailScreen] 通知调度失败:', error.message);
    }
  }, [task]);

  // ============================================================
  // 放弃专注
  // ============================================================

  const handleAbandonFocus = useCallback(async () => {
    // 清除倒计时
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 取消所有待发通知
    await Notifications.cancelAllScheduledNotificationsAsync();
    notificationIdRef.current = null;

    // 恢复普通视图
    if (isMountedRef.current) {
      setIsFocusing(false);
      setTimeLeft(0);
    }
  }, []);

  // ============================================================
  // 专注结束
  // ============================================================

  const handleFocusComplete = useCallback(async () => {
    // 取消已调度的通知（避免重复触发）
    await Notifications.cancelAllScheduledNotificationsAsync();
    notificationIdRef.current = null;

    // 连续震动反馈
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert(
      '专注结束！',
      '任务完成了吗？',
      [
        {
          text: '还需要点时间',
          style: 'cancel',
          onPress: () => {
            if (isMountedRef.current) {
              setIsFocusing(false);
              setTimeLeft(0);
            }
          },
        },
        {
          text: '标记为已完成',
          style: 'default',
          onPress: async () => {
            try {
              await completeTask(task.id);
            } catch (error) {
              console.error('[TaskDetailScreen] 完成任务失败:', error.message);
            }
            if (isMountedRef.current) {
              setIsFocusing(false);
              setTimeLeft(0);
            }
            onBack?.();
          },
        },
      ]
    );
  }, [task, onBack]);

  // ============================================================
  // 渲染：专注模式（全屏沉浸式）
  // ============================================================

  if (isFocusing) {
    // 根据剩余时间计算进度比例，用于颜色渐变
    const totalTime = (task.estimated_minutes || 25) * 60;
    const progress = timeLeft / totalTime;

    return (
      <SafeAreaView style={styles.focusContainer}>
        <StatusBar barStyle="light-content" />

        {/* 任务标题 */}
        <Text style={styles.focusTaskTitle} numberOfLines={2}>
          {task.title}
        </Text>

        {/* 核心倒计时 */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>
            {formatTime(timeLeft)}
          </Text>
          <Text style={styles.timerLabel}>
            {timeLeft > 0 ? '专注中...' : '时间到！'}
          </Text>
        </View>

        {/* 进度指示条 */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>

        {/* 放弃按钮 */}
        <TouchableOpacity
          style={styles.abandonButton}
          onPress={handleAbandonFocus}
          activeOpacity={0.7}
        >
          <Text style={styles.abandonButtonText}>放弃专注</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ============================================================
  // 渲染：普通详情模式
  // ============================================================

  const canFocus = task.estimated_minutes > 0 && task.status !== 'COMPLETED';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 返回按钮 */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.6}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      {/* 任务详情 */}
      <View style={styles.detailCard}>
        {/* 轨道标签 */}
        <View style={styles.trackRow}>
          <View style={[
            styles.trackBadge,
            { backgroundColor: Colors.track[task.track?.toLowerCase()] || Colors.accent },
          ]}>
            <Text style={styles.trackText}>{task.track}</Text>
          </View>
          <Text style={styles.statusText}>{task.status}</Text>
        </View>

        {/* 标题 */}
        <Text style={styles.taskTitle}>{task.title}</Text>

        {/* 描述 */}
        {task.description ? (
          <Text style={styles.taskDescription}>{task.description}</Text>
        ) : null}

        {/* 元信息 */}
        <View style={styles.metaContainer}>
          {task.estimated_minutes ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>预计耗时</Text>
              <Text style={styles.metaValue}>{task.estimated_minutes} 分钟</Text>
            </View>
          ) : null}
          {task.due_date ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>截止日期</Text>
              <Text style={styles.metaValue}>{task.due_date}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>紧急度</Text>
            <Text style={styles.metaValue}>{task.urgency || 50}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>重要度</Text>
            <Text style={styles.metaValue}>{task.importance || 50}</Text>
          </View>
        </View>
      </View>

      {/* 专注按钮 */}
      {canFocus && (
        <TouchableOpacity
          style={styles.focusButton}
          onPress={handleStartFocus}
          activeOpacity={0.7}
        >
          <Text style={styles.focusButtonText}>🚀 开始专注</Text>
        </TouchableOpacity>
      )}

      {/* 已完成提示 */}
      {task.status === 'COMPLETED' && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>✓ 此任务已完成</Text>
        </View>
      )}

      {/* 无预计时间提示 */}
      {!task.estimated_minutes && task.status !== 'COMPLETED' && (
        <Text style={styles.noEstimateHint}>
          未设置预计耗时，无法启动专注模式
        </Text>
      )}
    </SafeAreaView>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  // ============================================================
  // 普通详情模式
  // ============================================================
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  backButtonText: {
    ...Typography.body,
    color: Colors.accent,
  },
  detailCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.subtle,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  trackBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  trackText: {
    ...Typography.micro,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  statusText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  taskTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  taskDescription: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  metaItem: {
    width: '50%',
    marginBottom: Spacing.md,
  },
  metaLabel: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  metaValue: {
    ...Typography.body,
    color: Colors.text.primary,
    fontSize: 15,
  },

  // 专注按钮
  focusButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xxl,
    ...Shadows.light,
  },
  focusButtonText: {
    ...Typography.subtitle,
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 18,
  },

  // 已完成横幅
  completedBanner: {
    backgroundColor: Colors.success + '15',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  completedText: {
    ...Typography.body,
    color: Colors.success,
    fontWeight: '500',
  },

  // 无预计时间提示
  noEstimateHint: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },

  // ============================================================
  // 专注模式（全屏沉浸式）
  // ============================================================
  focusContainer: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  focusTaskTitle: {
    ...Typography.body,
    color: '#FFFFFF80',
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    fontSize: 14,
  },

  // 倒计时
  timerContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  timerText: {
    fontSize: 80,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    ...Typography.caption,
    color: '#FFFFFF60',
    marginTop: Spacing.md,
  },

  // 进度条
  progressTrack: {
    width: '80%',
    height: 3,
    backgroundColor: '#FFFFFF15',
    borderRadius: 2,
    marginBottom: Spacing.xxxl,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },

  // 放弃按钮
  abandonButton: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    ...Shadows.light,
  },
  abandonButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

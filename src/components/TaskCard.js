/**
 * TaskCard 组件
 *
 * Things 3 风格的任务卡片：
 * - 无边框设计，仅 0.5px 底部分割线
 * - 极淡阴影，悬浮感
 * - 原生 Pressable 反馈
 * - 点击时轻微缩放反馈
 * - 根据 track 字段显示三轨图标
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Zap,
  Route,
  HelpCircle,
  Check,
} from 'lucide-react-native';
import { Colors, Typography, Spacing, Borders } from '../theme/theme';

/**
 * 三轨图标映射
 *
 * 冲刺轨 (SPRINT) - Zap 闪电图标，象征紧迫
 * 马拉松轨 (MARATHON) - Route 路线图标，象征长途
 * 悬念轨 (SUSPENSE) - HelpCircle 问号图标，象征未知
 */
const TRACK_ICONS = {
  SPRINT: Zap,
  MARATHON: Route,
  SUSPENSE: HelpCircle,
};

/**
 * 三轨颜色映射
 */
const TRACK_COLORS = {
  SPRINT: Colors.track.sprint,
  MARATHON: Colors.track.marathon,
  SUSPENSE: Colors.track.suspense,
};

/**
 * 状态图标映射
 */
const STATUS_ICONS = {
  COMPLETED: Check,
};

/**
 * TaskCard 组件
 *
 * @param {Object} props
 * @param {Object} props.task - 任务数据对象
 * @param {string} props.task.id - 任务ID
 * @param {string} props.task.title - 任务标题
 * @param {string} props.task.description - 任务描述（可选）
 * @param {string} props.task.track - 三轨分类：SPRINT | MARATHON | SUSPENSE
 * @param {string} props.task.status - 任务状态：ACTIVE | COMPLETED | PAUSED | CANCELLED
 * @param {Function} props.onPress - 点击回调
 * @param {Function} props.onLongPress - 长按回调（可选）
 */
export default function TaskCard({ task, onPress, onLongPress }) {
  const { id, title, description, track, status } = task;

  // 获取轨道图标和颜色
  const TrackIcon = TRACK_ICONS[track] || Zap;
  const trackColor = TRACK_COLORS[track] || Colors.text.secondary;
  const isCompleted = status === 'COMPLETED';

  /**
   * 处理点击事件
   * 使用 useCallback 避免不必要的重渲染
   */
  const handlePress = useCallback(() => {
    onPress?.(task);
  }, [task, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(task);
  }, [task, onLongPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* 轨道图标 */}
      <View style={styles.iconContainer}>
        <TrackIcon
          size={20}
          color={isCompleted ? Colors.text.tertiary : trackColor}
          strokeWidth={1.5}
          opacity={isCompleted ? 0.4 : 1}
        />
      </View>

      {/* 任务内容 */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            isCompleted && styles.titleCompleted,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {description ? (
          <Text
            style={[
              styles.description,
              isCompleted && styles.descriptionCompleted,
            ]}
            numberOfLines={1}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* 完成状态指示器 */}
      {isCompleted && (
        <View style={styles.checkContainer}>
          <Check size={16} color={Colors.text.tertiary} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    ...Borders.hairline,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    ...Typography.body,
    color: Colors.text.primary,
  },
  titleCompleted: {
    color: Colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  description: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  descriptionCompleted: {
    color: Colors.text.tertiary,
  },
  checkContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * TaskCard 组件
 *
 * Things 3 风格的任务卡片：
 * - 无边框设计，仅 0.5px 底部分割线
 * - 极淡阴影，悬浮感
 * - moti 驱动的非线性动画
 * - 点击时轻微缩放反馈
 * - 根据 track 字段显示三轨图标
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import {
  Zap,
  Route,
  HelpCircle,
  Check,
} from 'lucide-react-native';
import { Colors, Typography, Spacing, Shadows, Animation, Borders } from '../theme/theme';

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
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        duration: Animation.duration.normal,
      }}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
        ]}
      >
        {({ pressed }) => (
          <MotiView
            style={styles.card}
            animate={{
              scale: pressed ? 0.98 : 1,
              opacity: pressed ? 0.9 : 1,
            }}
            transition={{
              type: 'spring',
              ...Animation.spring.subtle,
            }}
          >
            {/* 轨道图标 */}
            <View style={styles.iconContainer}>
              <MotiView
                animate={{
                  scale: isCompleted ? 0.9 : 1,
                  opacity: isCompleted ? 0.4 : 1,
                }}
                transition={{
                  type: 'spring',
                  ...Animation.spring.default,
                }}
              >
                <TrackIcon
                  size={20}
                  color={isCompleted ? Colors.text.tertiary : trackColor}
                  strokeWidth={1.5}
                />
              </MotiView>
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
              <MotiView
                from={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  ...Animation.spring.subtle,
                }}
                style={styles.checkContainer}
              >
                <Check size={16} color={Colors.text.tertiary} strokeWidth={2} />
              </MotiView>
            )}
          </MotiView>
        )}
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  pressed: {
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    ...Borders.hairline,
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

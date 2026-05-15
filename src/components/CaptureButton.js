/**
 * CaptureButton 组件
 *
 * 灵感捕捉入口 - Things 3 风格的悬浮按钮
 * - 内敛设计，不抢夺视觉焦点
 * - 圆角胶囊形状
 * - moti 驱动的微交互
 * - 点击时有轻微弹性反馈
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Sparkles } from 'lucide-react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation } from '../theme/theme';

/**
 * CaptureButton 组件
 *
 * @param {Object} props
 * @param {Function} props.onPress - 点击回调
 * @param {string} props.label - 按钮文字（默认"捕捉灵感"）
 */
export default function CaptureButton({ onPress, label = '捕捉灵感' }) {
  /**
   * 处理点击事件
   */
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'timing',
        duration: Animation.duration.slow,
        delay: 300,  // 延迟出现，让主内容先加载
      }}
      style={styles.container}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        {({ pressed }) => (
          <MotiView
            style={styles.content}
            animate={{
              scale: pressed ? 0.96 : 1,
            }}
            transition={{
              type: 'spring',
              ...Animation.spring.subtle,
            }}
          >
            <Sparkles
              size={16}
              color={Colors.text.secondary}
              strokeWidth={1.5}
              style={styles.icon}
            />
            <Text style={styles.label}>{label}</Text>
          </MotiView>
        )}
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Spacing.xxxl + 20,  // 距离底部足够空间，避开安全区域
    alignSelf: 'center',
    zIndex: 10,
  },
  button: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.divider,
    ...Shadows.subtle,
  },
  buttonPressed: {
    borderColor: Colors.text.tertiary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
});

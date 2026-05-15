/**
 * CaptureButton 组件
 *
 * 灵感捕捉入口 - Things 3 风格的悬浮按钮
 * - 内敛设计，不抢夺视觉焦点
 * - 圆角胶囊形状
 * - 原生 Pressable 微交互
 * - 点击时有轻微弹性反馈
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';

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
    <View style={styles.container}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        {({ pressed }) => (
          <View style={[
            styles.content,
            pressed && styles.contentPressed,
          ]}>
            <Sparkles
              size={16}
              color={Colors.text.secondary}
              strokeWidth={1.5}
              style={styles.icon}
            />
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
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
  contentPressed: {
    transform: [{ scale: 0.96 }],
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

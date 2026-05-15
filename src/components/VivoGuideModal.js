/**
 * VivoGuideModal 组件
 *
 * vivo 系统权限引导弹窗：
 * - Things 3 极简风格
 * - 温和的文案，不恐吓用户
 * - 清晰的步骤清单
 * - 一键跳转设置页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { MotiView } from 'moti';
import {
  X,
  Bell,
  Battery,
  Shield,
  Smartphone,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import {
  generatePermissionReport,
  openAppSettings,
  openVivoBatterySettings,
} from '../logic/permissionManager';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Animation,
} from '../theme/theme';

/**
 * 权限图标映射
 */
const PERMISSION_ICONS = {
  notification: Bell,
  autostart: Shield,
  background_high_power: Battery,
  lock_screen_display: Smartphone,
};

/**
 * VivoGuideModal 组件
 *
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示弹窗
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onComplete - 用户完成引导回调（可选）
 */
export default function VivoGuideModal({ visible, onClose, onComplete }) {
  // 权限报告
  const [report, setReport] = useState(null);
  // 加载状态
  const [loading, setLoading] = useState(true);

  /**
   * 加载权限报告
   */
  useEffect(() => {
    if (visible) {
      loadReport();
    }
  }, [visible]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const result = await generatePermissionReport();
      setReport(result);
    } catch (error) {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理权限项点击
   */
  const handleItemPress = useCallback(async (item) => {
    if (item.action) {
      try {
        await item.action();
      } catch (error) {
        // 静默处理
      }
    }
  }, []);

  /**
   * 渲染单个权限项
   */
  const renderPermissionItem = (item, index) => {
    const Icon = PERMISSION_ICONS[item.id] || Circle;
    const isGranted = item.status === 'granted';
    const isUnknown = item.status === 'unknown';

    return (
      <MotiView
        key={item.id}
        from={{ opacity: 0, translateX: -10 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{
          type: 'timing',
          duration: Animation.duration.normal,
          delay: index * 80,
        }}
      >
        <Pressable
          onPress={() => handleItemPress(item)}
          style={({ pressed }) => [
            styles.permissionItem,
            pressed && styles.permissionItemPressed,
          ]}
        >
          {/* 图标区域 */}
          <View style={[
            styles.iconContainer,
            isGranted && styles.iconContainerGranted,
          ]}>
            <Icon
              size={20}
              color={isGranted ? Colors.success : Colors.text.secondary}
              strokeWidth={1.5}
            />
          </View>

          {/* 文字区域 */}
          <View style={styles.permissionContent}>
            <Text style={[
              styles.permissionName,
              isGranted && styles.permissionNameGranted,
            ]}>
              {item.name}
            </Text>
            <Text style={styles.permissionDesc}>
              {item.description}
            </Text>
          </View>

          {/* 状态指示器 */}
          <View style={styles.statusContainer}>
            {isGranted ? (
              <CheckCircle2 size={20} color={Colors.success} />
            ) : isUnknown ? (
              <Text style={styles.unknownText}>请手动开启</Text>
            ) : (
              <ChevronRight size={20} color={Colors.text.tertiary} />
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  /**
   * 渲染内容
   */
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>正在检查权限...</Text>
        </View>
      );
    }

    if (!report) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>无法获取权限信息</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 提示文案 */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: Animation.duration.normal }}
          style={styles.hintContainer}
        >
          <Text style={styles.hintText}>
            为了确保任务提醒和后台自愈功能正常工作，建议开启以下权限。
          </Text>
          <Text style={styles.hintSubtext}>
            这些设置不会影响您的日常使用，只是让 MyBrain 能更稳定地为您服务。
          </Text>
        </MotiView>

        {/* 权限列表 */}
        <View style={styles.permissionList}>
          {report.items.map((item, index) => renderPermissionItem(item, index))}
        </View>

        {/* 底部说明 */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: Animation.duration.normal,
            delay: report.items.length * 80 + 200,
          }}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            您可以随时在系统设置中修改这些权限。
          </Text>
        </MotiView>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.overlayPress} onPress={onClose}>
          <MotiView
            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{
              type: 'spring',
              ...Animation.spring.default,
            }}
            style={styles.modal}
          >
            {/* 头部 */}
            <View style={styles.header}>
              <Text style={styles.title}>权限设置</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>

            {/* 内容 */}
            {renderContent()}

            {/* 底部按钮 */}
            {!loading && report && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'timing',
                  duration: Animation.duration.normal,
                  delay: 500,
                }}
                style={styles.buttonContainer}
              >
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.doneButton,
                    pressed && styles.doneButtonPressed,
                  ]}
                >
                  <Text style={styles.doneButtonText}>
                    {report.summary.allGranted ? '完成' : '我知道了'}
                  </Text>
                </Pressable>
              </MotiView>
            )}
          </MotiView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayPress: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  scrollContent: {
    flex: 1,
  },
  hintContainer: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
  },
  hintText: {
    ...Typography.body,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  hintSubtext: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  permissionList: {
    marginBottom: Spacing.lg,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  permissionItemPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconContainerGranted: {
    backgroundColor: '#E8F5E9',
  },
  permissionContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  permissionName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  permissionNameGranted: {
    color: Colors.success,
  },
  permissionDesc: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  unknownText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  footer: {
    paddingVertical: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  errorContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.danger,
  },
  buttonContainer: {
    marginTop: Spacing.md,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.md,
  },
  doneButtonPressed: {
    opacity: 0.9,
  },
  doneButtonText: {
    ...Typography.body,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
});

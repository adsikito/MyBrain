/**
 * 全局异常兜底组件
 *
 * 使用 React Class Component 实现：
 * - getDerivedStateFromError: 捕获渲染阶段错误，更新 state
 * - componentDidCatch: 记录错误详情（日志/上报）
 *
 * UI: "脑回路断开" 提示页 + 重新连接按钮
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Colors, Typography, Spacing } from '../theme/theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    // 更新 state，下次渲染时显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 错误日志上报（可接入 Sentry / 自建日志服务）
    console.error('[MyBrain ErrorBoundary] 捕获到未处理异常:', error);
    console.error('[MyBrain ErrorBoundary] 组件堆栈:', errorInfo.componentStack);
  }

  handleReset = () => {
    // 重置状态，尝试恢复
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            {/* 警示图标 */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>⚠</Text>
            </View>

            {/* 标题 */}
            <Text style={styles.title}>脑回路断开</Text>

            {/* 描述 */}
            <Text style={styles.description}>
              应用遇到了意外错误，部分功能暂时不可用。
            </Text>

            {/* 错误详情（开发模式可展开） */}
            {__DEV__ && this.state.error && (
              <Text style={styles.errorDetail}>
                {this.state.error.toString()}
              </Text>
            )}

            {/* 重新连接按钮 */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>重新连接</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.danger + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    ...Typography.title,
    color: Colors.danger,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  errorDetail: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.lg,
  },
  buttonText: {
    ...Typography.subtitle,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
});

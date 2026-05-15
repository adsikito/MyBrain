/**
 * CaptureModal 组件
 *
 * 灵感捕捉弹窗：
 * - Things 3 风格的简洁设计
 * - 支持多行文本输入
 * - AI 思考中的加载动效
 * - 自动解析并写入数据库
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Sparkles, Send } from 'lucide-react-native';
import { callAI } from '../services/aiService';
import { getDatabase } from '../database/db';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../theme/theme';

/**
 * 生成 UUID
 * 简化版，生产环境建议使用 expo-crypto
 */
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * CaptureModal 组件
 *
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示弹窗
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onSuccess - 任务创建成功回调
 */
export default function CaptureModal({ visible, onClose, onSuccess }) {
  // 输入文本
  const [input, setInput] = useState('');
  // 处理状态：idle | thinking | success | error
  const [status, setStatus] = useState('idle');
  // 错误信息
  const [errorMsg, setErrorMsg] = useState('');
  // 输入框引用
  const inputRef = useRef(null);

  /**
   * 处理输入框聚焦
   */
  const handleModalShow = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  /**
   * 重置状态
   */
  const resetState = useCallback(() => {
    setInput('');
    setStatus('idle');
    setErrorMsg('');
  }, []);

  /**
   * 关闭弹窗
   */
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  /**
   * 将 AI 解析结果写入数据库
   *
   * @param {Object} parsedData - AI 返回的任务数据
   * @returns {Promise<number>} 成功写入的任务数量
   */
  const saveToDatabase = useCallback(async (parsedData) => {
    const db = await getDatabase();
    let savedCount = 0;

    for (const task of parsedData.tasks) {
      const taskId = generateId();
      const now = new Date().toISOString();

      // 计算动态权重
      const weight = (task.urgency || 50) * 0.4 + (task.importance || 50) * 0.3;

      // 插入任务主表
      await db.runAsync(
        `INSERT INTO tasks (
          id, title, description, track, status,
          priority, urgency, importance, weight,
          due_date, estimated_minutes, recurrence_rule,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          task.title,
          task.description || null,
          task.track,
          'ACTIVE',
          50, // priority
          task.urgency || 50,
          task.importance || 50,
          weight,
          task.due_date || null,
          task.estimated_minutes || null,
          task.recurrence_rule || null,
          now,
          now,
        ]
      );

      // 如果是 SUSPENSE 轨道，创建等待条件
      if (task.track === 'SUSPENSE' && task.suspense_condition) {
        const conditionId = generateId();
        await db.runAsync(
          `INSERT INTO suspense_conditions (
            id, task_id, condition_type, description, target_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            conditionId,
            taskId,
            task.suspense_condition.condition_type,
            task.suspense_condition.description || null,
            task.suspense_condition.target_date || null,
            now,
          ]
        );
      }

      // 记录状态历史
      const historyId = generateId();
      await db.runAsync(
        `INSERT INTO task_status_history (
          id, task_id, old_status, new_status, changed_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [historyId, taskId, null, 'ACTIVE', now, 'AI 自动创建']
      );

      savedCount++;
    }

    return savedCount;
  }, []);

  /**
   * 提交输入并调用 AI
   */
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) {
      Alert.alert('提示', '请输入你的灵感或任务');
      return;
    }

    setStatus('thinking');
    setErrorMsg('');

    try {
      // 调用 AI 解析
      const parsed = await callAI(input.trim());

      // 写入数据库
      const savedCount = await saveToDatabase(parsed);

      setStatus('success');

      // 短暂显示成功状态后关闭
      setTimeout(() => {
        onSuccess?.(savedCount);
        handleClose();
      }, 800);

    } catch (error) {
      setStatus('error');
      setErrorMsg(error.message || 'AI 解析失败，请重试');
    }
  }, [input, saveToDatabase, onSuccess, handleClose]);

  /**
   * 渲染思考中的动画
   */
  const renderThinking = () => (
    <View style={styles.thinkingContainer}>
      <ActivityIndicator size="small" color={Colors.text.secondary} />
      <Text style={styles.thinkingText}>
        AI 正在思考...
      </Text>
    </View>
  );

  /**
   * 渲染成功状态
   */
  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <Sparkles size={24} color={Colors.success} />
      <Text style={styles.successText}>任务已创建</Text>
    </View>
  );

  /**
   * 渲染错误状态
   */
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{errorMsg}</Text>
      <Pressable onPress={() => setStatus('idle')} style={styles.retryButton}>
        <Text style={styles.retryText}>重试</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      onShow={handleModalShow}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPress} onPress={handleClose}>
          <View style={styles.modal}>
            {/* 头部 */}
            <View style={styles.header}>
              <Text style={styles.title}>捕捉灵感</Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <X size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>

            {/* 输入区域 */}
            {status === 'idle' || status === 'error' ? (
              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="描述你的任务或灵感..."
                  placeholderTextColor={Colors.text.tertiary}
                  value={input}
                  onChangeText={setInput}
                  multiline={true}
                  maxLength={500}
                  textAlignVertical="top"
                />
                {status === 'error' && renderError()}
              </View>
            ) : null}

            {/* 思考状态 */}
            {status === 'thinking' && renderThinking()}

            {/* 成功状态 */}
            {status === 'success' && renderSuccess()}

            {/* 提交按钮 */}
            {status === 'idle' || status === 'error' ? (
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.submitButtonPressed,
                  !input.trim() && styles.submitButtonDisabled,
                ]}
                disabled={!input.trim() || status === 'thinking'}
              >
                <Send size={18} color={input.trim() ? Colors.text.inverse : Colors.text.tertiary} />
                <Text style={[
                  styles.submitText,
                  !input.trim() && styles.submitTextDisabled,
                ]}>
                  发送给 AI
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </KeyboardAvoidingView>
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
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    ...Typography.body,
    color: Colors.text.primary,
    minHeight: 100,
    maxHeight: 200,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  thinkingText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  successText: {
    ...Typography.body,
    color: Colors.success,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-end',
  },
  retryText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.md,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  submitText: {
    ...Typography.body,
    color: Colors.text.inverse,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  submitTextDisabled: {
    color: Colors.text.tertiary,
  },
});

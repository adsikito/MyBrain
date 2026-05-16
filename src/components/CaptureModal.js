/**
 * CaptureModal 组件
 *
 * 双轨灵感捕捉弹窗：
 * - "✨ 捕捉灵感" → 调用 AI 解析（原逻辑）
 * - "🛑 记录分心念头" → 毫秒级本地直存，零 AI 调用
 *
 * Things 3 风格极简设计
 * 严禁引入 react-native-reanimated
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
import * as Haptics from 'expo-haptics';
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

// ============================================================
// 模式常量
// ============================================================

const MODE_INSPIRATION = 'inspiration';
const MODE_DISTRACTION = 'distraction';

// ============================================================
// 工具函数
// ============================================================

function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

// ============================================================
// SegmentedControl - 模式切换器
// ============================================================

function SegmentedControl({ mode, onModeChange }) {
  return (
    <View style={styles.segmentContainer}>
      <Pressable
        style={[
          styles.segmentItem,
          mode === MODE_INSPIRATION && styles.segmentItemActive,
        ]}
        onPress={() => onModeChange(MODE_INSPIRATION)}
      >
        <Text style={[
          styles.segmentText,
          mode === MODE_INSPIRATION && styles.segmentTextActive,
        ]}>
          ✨ 捕捉灵感
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.segmentItem,
          mode === MODE_DISTRACTION && styles.segmentItemActiveDistraction,
        ]}
        onPress={() => onModeChange(MODE_DISTRACTION)}
      >
        <Text style={[
          styles.segmentText,
          mode === MODE_DISTRACTION && styles.segmentTextActiveDistraction,
        ]}>
          🛑 记录分心念头
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// CaptureModal 主组件
// ============================================================

/**
 * @param {Object} props
 * @param {boolean} props.visible - 是否显示弹窗
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onSuccess - 任务创建成功回调
 */
export default function CaptureModal({ visible, onClose, onSuccess }) {
  // 当前模式：灵感 or 分心
  const [mode, setMode] = useState(MODE_INSPIRATION);
  // 输入文本
  const [input, setInput] = useState('');
  // 处理状态：idle | thinking | success | error
  const [status, setStatus] = useState('idle');
  // 错误信息
  const [errorMsg, setErrorMsg] = useState('');
  // 输入框引用
  const inputRef = useRef(null);

  /**
   * 输入框聚焦
   */
  const handleModalShow = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  /**
   * 重置所有状态
   */
  const resetState = useCallback(() => {
    setInput('');
    setStatus('idle');
    setErrorMsg('');
    setMode(MODE_INSPIRATION);
  }, []);

  /**
   * 关闭弹窗
   */
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // ============================================================
  // 灵感模式：AI 解析 + 写入数据库（原逻辑）
  // ============================================================

  const saveToDatabase = useCallback(async (parsedData) => {
    const db = await getDatabase();
    let savedCount = 0;

    for (const task of parsedData.tasks) {
      const taskId = generateId();
      const now = new Date().toISOString();
      const weight = (task.urgency || 50) * 0.4 + (task.importance || 50) * 0.3;

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
          50,
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
   * 灵感模式提交：调用 AI
   */
  const handleInspirationSubmit = useCallback(async () => {
    if (!input.trim()) {
      Alert.alert('提示', '请输入你的灵感或任务');
      return;
    }

    setStatus('thinking');
    setErrorMsg('');

    try {
      const parsed = await callAI(input.trim());
      const savedCount = await saveToDatabase(parsed);

      setStatus('success');

      setTimeout(() => {
        onSuccess?.(savedCount);
        handleClose();
      }, 800);

    } catch (error) {
      setStatus('error');
      setErrorMsg(error.message || 'AI 解析失败，请重试');
    }
  }, [input, saveToDatabase, onSuccess, handleClose]);

  // ============================================================
  // 分心模式：极速本地直存，绝对禁止调用 AI
  // ============================================================

  const handleDistractionSubmit = useCallback(async () => {
    if (!input.trim()) {
      Alert.alert('提示', '请输入你想记录的分心念头');
      return;
    }

    try {
      const db = await getDatabase();
      const taskId = generateId();
      const now = new Date().toISOString();

      // 硬编码属性：打入冷宫的灰色任务
      await db.runAsync(
        `INSERT INTO tasks (
          id, title, description, track, status,
          priority, urgency, importance, weight,
          due_date, estimated_minutes, recurrence_rule,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          input.trim(),
          null,           // description
          'MARATHON',     // track
          'ACTIVE',       // status
          50,             // priority
          0,              // urgency
          0,              // importance
          0.0,            // weight (最低权重，沉底)
          null,           // due_date
          null,           // estimated_minutes
          null,           // recurrence_rule
          JSON.stringify({ color_code: 'GRAY', source: 'distraction' }), // metadata
          now,
          now,
        ]
      );

      // 记录状态历史
      const historyId = generateId();
      await db.runAsync(
        `INSERT INTO task_status_history (
          id, task_id, old_status, new_status, changed_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [historyId, taskId, null, 'ACTIVE', now, '分心念头记录']
      );

      // 警告震动
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // 弹出冷宫提示
      Alert.alert(
        '已打入冷宫 (灰色)',
        '请立刻滚回去执行当前聚焦的任务！',
        [{
          text: '遵命',
          style: 'default',
          onPress: () => {
            onSuccess?.(1);
            handleClose();
          },
        }]
      );

    } catch (error) {
      Alert.alert('保存失败', error.message || '请重试');
    }
  }, [input, onSuccess, handleClose]);

  // ============================================================
  // 统一提交入口
  // ============================================================

  const handleSubmit = useCallback(() => {
    if (mode === MODE_INSPIRATION) {
      handleInspirationSubmit();
    } else {
      handleDistractionSubmit();
    }
  }, [mode, handleInspirationSubmit, handleDistractionSubmit]);

  // ============================================================
  // 渲染函数
  // ============================================================

  const renderThinking = () => (
    <View style={styles.thinkingContainer}>
      <ActivityIndicator size="small" color={Colors.text.secondary} />
      <Text style={styles.thinkingText}>AI 正在思考...</Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <Sparkles size={24} color={Colors.success} />
      <Text style={styles.successText}>任务已创建</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{errorMsg}</Text>
      <Pressable onPress={() => setStatus('idle')} style={styles.retryButton}>
        <Text style={styles.retryText}>重试</Text>
      </Pressable>
    </View>
  );

  // ============================================================
  // 主渲染
  // ============================================================

  const isDistractionMode = mode === MODE_DISTRACTION;

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
              <Text style={styles.title}>
                {isDistractionMode ? '记录分心念头' : '捕捉灵感'}
              </Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <X size={20} color={Colors.text.secondary} />
              </Pressable>
            </View>

            {/* 模式切换器 */}
            <SegmentedControl mode={mode} onModeChange={setMode} />

            {/* 输入区域 */}
            {status === 'idle' || status === 'error' ? (
              <View style={styles.inputContainer}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    isDistractionMode && styles.inputDistraction,
                  ]}
                  placeholder={
                    isDistractionMode
                      ? '是什么在分散你的注意力？'
                      : '描述你的任务或灵感...'
                  }
                  placeholderTextColor={Colors.text.tertiary}
                  value={input}
                  onChangeText={setInput}
                  multiline={true}
                  maxLength={500}
                  textAlignVertical="top"
                />
                {status === 'error' && renderError()}

                {/* 分心模式提示 */}
                {isDistractionMode && (
                  <Text style={styles.distractionHint}>
                    记录后立即归档，不浪费 AI 算力
                  </Text>
                )}
              </View>
            ) : null}

            {/* 思考状态（仅灵感模式） */}
            {status === 'thinking' && renderThinking()}

            {/* 成功状态 */}
            {status === 'success' && renderSuccess()}

            {/* 提交按钮 */}
            {status === 'idle' || status === 'error' ? (
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  isDistractionMode && styles.submitButtonDistraction,
                  pressed && styles.submitButtonPressed,
                  !input.trim() && styles.submitButtonDisabled,
                ]}
                disabled={!input.trim() || status === 'thinking'}
              >
                <Send
                  size={18}
                  color={
                    input.trim()
                      ? (isDistractionMode ? '#FFFFFF' : Colors.text.inverse)
                      : Colors.text.tertiary
                  }
                />
                <Text style={[
                  styles.submitText,
                  isDistractionMode && styles.submitTextDistraction,
                  !input.trim() && styles.submitTextDisabled,
                ]}>
                  {isDistractionMode ? '打入冷宫' : '发送给 AI'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  // 遮罩层
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

  // 弹窗主体
  modal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.light,
  },

  // 头部
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

  // ============================================================
  // SegmentedControl 样式
  // ============================================================
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm + 2,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: Colors.background,
    ...Shadows.subtle,
  },
  segmentItemActiveDistraction: {
    backgroundColor: Colors.danger,
    ...Shadows.subtle,
  },
  segmentText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  segmentTextActiveDistraction: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ============================================================
  // 输入区域
  // ============================================================
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
  inputDistraction: {
    borderColor: Colors.danger + '40',
    backgroundColor: '#FFF8F8',
  },
  distractionHint: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },

  // ============================================================
  // 状态展示
  // ============================================================
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

  // ============================================================
  // 提交按钮
  // ============================================================
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.md,
  },
  submitButtonDistraction: {
    backgroundColor: Colors.danger,
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
  submitTextDistraction: {
    color: '#FFFFFF',
  },
  submitTextDisabled: {
    color: Colors.text.tertiary,
  },
});

/**
 * PlannerScreen - 计划页
 *
 * 三轨任务规划界面：
 * - 支持自然语言输入
 * - AI 自动解析为结构化任务
 * - 离线保护：无网络时阻止请求，保护用户输入
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import { callAI } from '../services/aiService';
import { getDatabase } from '../database/db';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../theme/theme';

/**
 * 生成 UUID
 */
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export default function PlannerScreen() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | thinking | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedTasks, setParsedTasks] = useState([]);
  const inputRef = useRef(null);

  /**
   * 将解析结果写入数据库
   */
  const saveToDatabase = useCallback(async (parsedData) => {
    const db = await getDatabase();
    let savedCount = 0;

    await db.execAsync('BEGIN TRANSACTION;');
    try {
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

      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }

    return savedCount;
  }, []);

  /**
   * 处理计划提交
   *
   * 核心流程：
   * 1. 网络检查（离线拦截）
   * 2. 调用 AI 解析
   * 3. 写入数据库
   *
   * 【关键约束】离线拦截时绝不清空 input
   */
  const handlePlan = useCallback(async () => {
    // 输入校验
    if (!input.trim()) {
      Alert.alert('提示', '请输入你的计划内容');
      return;
    }

    // ========== 离线拦截（最优先） ==========
    try {
      const networkState = await Network.getNetworkStateAsync();

      // 无网络 或 网络不可达
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        // 触发错误震动
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // 弹出提示
        Alert.alert(
          '大脑处于离线状态',
          '请检查网络连接后重试。\n你的输入内容已安全保留。',
          [{ text: '好的', style: 'default' }]
        );

        // 【强制约束】绝对不清空 input，用户输入完好无损
        return;
      }
    } catch (networkError) {
      // 网络检查本身失败，视为离线
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        '大脑处于离线状态',
        '无法检测网络状态，请检查网络连接。\n你的输入内容已安全保留。',
        [{ text: '好的', style: 'default' }]
      );

      // 同样不清空 input
      return;
    }

    // ========== 网络正常，开始 AI 请求 ==========
    setStatus('thinking');
    setErrorMsg('');

    try {
      const parsed = await callAI(input.trim());
      const savedCount = await saveToDatabase(parsed);

      setParsedTasks(parsed.tasks);
      setStatus('success');

      // 成功震动反馈
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 成功后清空输入
      setInput('');

      Alert.alert(
        '计划已创建',
        `成功创建 ${savedCount} 个任务`,
        [{ text: '太棒了', style: 'default' }]
      );

      // 重置状态
      setTimeout(() => {
        setStatus('idle');
        setParsedTasks([]);
      }, 2000);

    } catch (error) {
      setStatus('error');
      setErrorMsg(error.message || 'AI 解析失败，请重试');
    }
  }, [input, saveToDatabase]);

  /**
   * 渲染任务预览
   */
  const renderTaskPreview = () => {
    if (parsedTasks.length === 0) return null;

    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>已创建的任务</Text>
        {parsedTasks.map((task, index) => (
          <View key={index} style={styles.previewItem}>
            <View style={[
              styles.trackBadge,
              { backgroundColor: Colors.track[task.track.toLowerCase()] || Colors.accent }
            ]}>
              <Text style={styles.trackText}>{task.track}</Text>
            </View>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>计划</Text>
            <Text style={styles.subtitle}>
              用自然语言描述你的计划，AI 会自动分类到三轨系统
            </Text>
          </View>

          {/* 输入区域 */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="例如：明天要交高数作业，每天背50个单词，等快递到了通知我..."
              placeholderTextColor={Colors.text.tertiary}
              value={input}
              onChangeText={setInput}
              multiline={true}
              maxLength={1000}
              textAlignVertical="top"
              editable={status !== 'thinking'}
            />

            {/* 字数统计 */}
            <Text style={styles.charCount}>
              {input.length}/1000
            </Text>
          </View>

          {/* 错误提示 */}
          {status === 'error' && errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity
                onPress={() => setStatus('idle')}
                style={styles.retryLink}
              >
                <Text style={styles.retryText}>重试</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 任务预览 */}
          {renderTaskPreview()}

          {/* 提交按钮 */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!input.trim() || status === 'thinking') && styles.submitButtonDisabled,
            ]}
            onPress={handlePlan}
            disabled={!input.trim() || status === 'thinking'}
            activeOpacity={0.7}
          >
            {status === 'thinking' ? (
              <ActivityIndicator size="small" color={Colors.text.inverse} />
            ) : (
              <Text style={[
                styles.submitText,
                (!input.trim() || status === 'thinking') && styles.submitTextDisabled,
              ]}>
                开始规划
              </Text>
            )}
          </TouchableOpacity>

          {/* 提示信息 */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>三轨分类说明</Text>
            <View style={styles.tipItem}>
              <View style={[styles.tipDot, { backgroundColor: Colors.track.sprint }]} />
              <Text style={styles.tipText}>
                <Text style={styles.tipLabel}>冲刺轨 </Text>
                有明确截止日期的短期任务
              </Text>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipDot, { backgroundColor: Colors.track.marathon }]} />
              <Text style={styles.tipText}>
                <Text style={styles.tipLabel}>马拉松轨 </Text>
                长期持续的习惯和目标
              </Text>
            </View>
            <View style={styles.tipItem}>
              <View style={[styles.tipDot, { backgroundColor: Colors.track.suspense }]} />
              <Text style={styles.tipText}>
                <Text style={styles.tipLabel}>悬念轨 </Text>
                等待外部条件的任务
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    ...Typography.body,
    color: Colors.text.primary,
    minHeight: 120,
    maxHeight: 200,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: Colors.divider,
    lineHeight: 24,
  },
  charCount: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  errorContainer: {
    padding: Spacing.md,
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  retryLink: {
    alignSelf: 'flex-end',
  },
  retryText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '500',
  },
  previewContainer: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
  },
  previewTitle: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  trackBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  trackText: {
    ...Typography.micro,
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 10,
  },
  taskTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    fontSize: 14,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xxl,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  submitText: {
    ...Typography.body,
    color: Colors.text.inverse,
    fontWeight: '500',
  },
  submitTextDisabled: {
    color: Colors.text.tertiary,
  },
  tipsContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
  },
  tipsTitle: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  tipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  tipLabel: {
    fontWeight: '600',
    color: Colors.text.primary,
  },
});

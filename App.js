/**
 * MyBrain 应用入口
 *
 * Things 3 风格的极简主框架：
 * - 沉浸式状态栏
 * - SafeAreaView 安全区域适配
 * - 优雅的日期标题
 * - 三轨任务列表
 * - 灵感捕捉悬浮按钮
 * - AI 集成与自愈引擎
 * - vivo 后台任务适配
 */

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { MotiView } from 'moti';
import { initDatabase, getDatabase } from './src/database/db';
import TaskCard from './src/components/TaskCard';
import CaptureButton from './src/components/CaptureButton';
import CaptureModal from './src/components/CaptureModal';
import VivoGuideModal from './src/components/VivoGuideModal';
import { checkAndHeal, performHealing } from './src/logic/healer';
import {
  initializeNotifications,
  registerBackgroundTask,
} from './src/logic/backgroundTask';
import {
  isVivoDevice,
  performFullPermissionCheck,
} from './src/logic/permissionManager';
import {
  Colors,
  Typography,
  Spacing,
  Animation,
} from './src/theme/theme';

/**
 * 获取当前日期的中文格式
 */
function getFormattedDate() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[now.getDay()];
  return `${month}月${day}日 ${weekDay}`;
}

/**
 * 获取问候语
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '早上好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  return '晚上好';
}

export default function App() {
  // 数据库初始化状态
  const [dbReady, setDbReady] = useState(false);
  // 错误信息
  const [error, setError] = useState(null);
  // 任务列表
  const [tasks, setTasks] = useState([]);
  // 灵感弹窗可见性
  const [captureModalVisible, setCaptureModalVisible] = useState(false);
  // vivo 引导弹窗可见性
  const [vivoGuideVisible, setVivoGuideVisible] = useState(false);

  /**
   * 从数据库加载任务
   */
  const loadTasks = useCallback(async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(`
        SELECT id, title, description, track, status, due_date
        FROM tasks
        WHERE deleted_at IS NULL AND status != 'CANCELLED'
        ORDER BY
          CASE track
            WHEN 'SPRINT' THEN 1
            WHEN 'SUSPENSE' THEN 2
            WHEN 'MARATHON' THEN 3
          END,
          weight DESC,
          created_at DESC
      `);
      setTasks(result);
    } catch (err) {
      // 静默处理
    }
  }, []);

  /**
   * 初始化后台任务和通知系统
   */
  const initializeBackground = useCallback(async () => {
    try {
      // 初始化通知系统
      await initializeNotifications();

      // 注册后台任务
      await registerBackgroundTask();

      // 检查权限状态
      const permReport = await performFullPermissionCheck();

      // 如果是 vivo 设备且存在权限问题，显示引导弹窗
      if (permReport.deviceInfo.isVivo && permReport.summary.hasCriticalIssue) {
        setTimeout(() => {
          setVivoGuideVisible(true);
        }, 1500);
      }
    } catch (err) {
      // 后台任务失败不应影响主功能
    }
  }, []);

  /**
   * 应用启动时初始化
   */
  useEffect(() => {
    async function bootstrap() {
      try {
        await initDatabase();
        setDbReady(true);

        // 加载任务
        await loadTasks();

        // 初始化后台任务
        await initializeBackground();

        // 执行自愈检查
        const driftReport = await checkAndHeal();
        if (driftReport.hasDrift) {
          showDriftAlert(driftReport);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    bootstrap();
  }, [loadTasks, initializeBackground]);

  /**
   * 显示计划偏移对话框
   */
  const showDriftAlert = useCallback((driftReport) => {
    const count = driftReport.overdue.length;
    const titles = driftReport.overdue.slice(0, 3).map(t => t.title).join('、');
    const suffix = count > 3 ? '...' : '';

    Alert.alert(
      '检测到计划偏移',
      `有 ${count} 个冲刺任务已过期：${titles}${suffix}\n\n是否由 AI 自动重排剩余任务？`,
      [
        {
          text: '忽略',
          style: 'cancel',
        },
        {
          text: '自动重排',
          onPress: async () => {
            try {
              const result = await performHealing(driftReport.overdue);
              if (result.success) {
                Alert.alert('重排完成', result.message);
                await loadTasks();
              } else {
                Alert.alert('重排失败', result.message);
              }
            } catch (err) {
              Alert.alert('错误', '重排过程发生异常');
            }
          },
        },
      ]
    );
  }, [loadTasks]);

  /**
   * 处理任务卡片点击
   */
  const handleTaskPress = useCallback((task) => {
    Alert.alert(
      task.title,
      `轨道: ${task.track}\n状态: ${task.status}`,
      [{ text: '确定' }]
    );
  }, []);

  /**
   * 打开灵感捕捉弹窗
   */
  const handleCapture = useCallback(() => {
    setCaptureModalVisible(true);
  }, []);

  /**
   * 关闭灵感捕捉弹窗
   */
  const handleCloseCapture = useCallback(() => {
    setCaptureModalVisible(false);
  }, []);

  /**
   * 关闭 vivo 引导弹窗
   */
  const handleCloseVivoGuide = useCallback(() => {
    setVivoGuideVisible(false);
  }, []);

  /**
   * 任务创建成功回调
   */
  const handleCaptureSuccess = useCallback(async (count) => {
    await loadTasks();
  }, [loadTasks]);

  /**
   * 渲染单个任务卡片
   */
  const renderTaskCard = useCallback(({ item, index }) => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        duration: Animation.duration.normal,
        delay: index * 50,
      }}
    >
      <TaskCard
        task={item}
        onPress={handleTaskPress}
      />
    </MotiView>
  ), [handleTaskPress]);

  /**
   * 提取 key
   */
  const keyExtractor = useCallback((item) => item.id, []);

  // 数据库初始化中
  if (!dbReady && !error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centerContent}>
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              type: 'timing',
              duration: Animation.duration.slow,
            }}
          >
            <Text style={styles.loadingText}>正在准备...</Text>
          </MotiView>
        </View>
      </SafeAreaView>
    );
  }

  // 初始化失败
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>初始化失败</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 主界面
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* 头部区域 - 日期标题 */}
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{
          type: 'timing',
          duration: Animation.duration.normal,
        }}
        style={styles.header}
      >
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
        <Text style={styles.greetingText}>{getGreeting()}</Text>
      </MotiView>

      {/* 任务列表 */}
      <FlatList
        data={tasks}
        renderItem={renderTaskCard}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无任务</Text>
            <Text style={styles.emptyHint}>点击下方按钮捕捉灵感</Text>
          </View>
        }
      />

      {/* 灵感捕捉按钮 */}
      <CaptureButton onPress={handleCapture} />

      {/* 灵感捕捉弹窗 */}
      <CaptureModal
        visible={captureModalVisible}
        onClose={handleCloseCapture}
        onSuccess={handleCaptureSuccess}
      />

      {/* vivo 权限引导弹窗 */}
      <VivoGuideModal
        visible={vivoGuideVisible}
        onClose={handleCloseVivoGuide}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  dateText: {
    ...Typography.largeTitle,
    color: Colors.text.primary,
  },
  greetingText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  errorText: {
    ...Typography.title,
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  errorDetail: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
});

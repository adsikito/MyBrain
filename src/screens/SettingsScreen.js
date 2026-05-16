/**
 * SettingsScreen - 设置页
 *
 * 数据复盘入口：
 * - 顶部展示心流热力图
 * - 进入页面时自动刷新数据
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCompletionHeatmapData } from '../services/taskService';
import Heatmap from '../components/Heatmap';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';

export default function SettingsScreen() {
  const [heatmapData, setHeatmapData] = useState({});

  /**
   * 每次页面获得焦点时刷新热力图数据
   */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchData() {
        try {
          const data = await getCompletionHeatmapData(60);
          if (!cancelled) {
            setHeatmapData(data);
          }
        } catch (error) {
          console.error('[SettingsScreen] 热力图数据加载失败:', error.message);
        }
      }

      fetchData();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 心流热力图卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>近期心流</Text>
          <Text style={styles.cardSubtitle}>
            过去 60 天的任务完成记录
          </Text>

          <View style={styles.heatmapWrapper}>
            <Heatmap data={heatmapData} />
          </View>
        </View>

        {/* 预留其他设置项 */}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            更多设置即将开放...
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },

  // 热力图卡片
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 0.5,
    borderColor: Colors.divider,
    ...Shadows.subtle,
  },
  cardTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
  },
  heatmapWrapper: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },

  // 占位区域
  placeholder: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  placeholderText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
});

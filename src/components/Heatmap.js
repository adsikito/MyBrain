/**
 * Heatmap - 心流热力图
 *
 * GitHub 贡献图风格的纯 SVG 手绘组件
 * - 7 行（周日→周六）× N 列（周）
 * - 绿色系渐变：无数据 → 极浅灰，有数据 → 浅绿到深绿
 * - 极致留白，呼吸感排版
 *
 * 严禁引入第三方图表库，仅使用 react-native-svg
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Rect, G } from 'react-native-svg';
import { Colors, Typography, Spacing } from '../theme/theme';

// ============================================================
// 视觉常量
// ============================================================

const CELL_SIZE = 13;       // 方块边长
const CELL_GAP = 3;         // 方块间距
const CELL_RADIUS = 2;      // 方块圆角
const DAYS_IN_WEEK = 7;     // 一周 7 天
const TOTAL_DAYS = 60;      // 往前追溯 60 天

// GitHub 风格绿色系
const COLOR_EMPTY = '#EBEDF0';       // 无数据
const COLOR_LEVEL1 = '#9BE9A8';      // 1-2 个
const COLOR_LEVEL2 = '#40C463';      // 3-5 个
const COLOR_LEVEL3 = '#30A14E';      // 6-9 个
const COLOR_LEVEL4 = '#216E39';      // 10+ 个

// 星期标签（左侧）
const DAY_LABELS = ['', '一', '', '三', '', '五', ''];

// 月份标签
const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 Date 对象格式化为 'YYYY-MM-DD'
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 根据完成数量返回对应颜色
 */
function getColor(count) {
  if (count === 0) return COLOR_EMPTY;
  if (count <= 2) return COLOR_LEVEL1;
  if (count <= 5) return COLOR_LEVEL2;
  if (count <= 9) return COLOR_LEVEL3;
  return COLOR_LEVEL4;
}

/**
 * 生成过去 60 天的日期网格
 *
 * 返回结构：{ grid, monthLabels, totalWeeks }
 * - grid: 二维数组 [dayOfWeek][weekIndex] = { date, count }
 * - monthLabels: 每列对应的月份标签
 */
function buildGrid(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 60 天前的日期
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - TOTAL_DAYS + 1);

  // 回退到该周的周日（grid 起始点）
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // 计算总列数
  const diffDays = Math.ceil((today - gridStart) / (1000 * 60 * 60 * 24)) + 1;
  const totalWeeks = Math.ceil(diffDays / DAYS_IN_WEEK);

  // 初始化 7 × N 网格
  const grid = Array.from({ length: DAYS_IN_WEEK }, () =>
    Array.from({ length: totalWeeks }, () => null)
  );

  // 月份标签（每周第一列属于哪个月）
  const monthLabelArr = new Array(totalWeeks).fill(null);

  // 填充网格
  const cursor = new Date(gridStart);
  for (let week = 0; week < totalWeeks; week++) {
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      const dateStr = formatDate(cursor);

      // 只渲染 startDate 之后且 today 之前（含）的日期
      if (cursor >= startDate && cursor <= today) {
        grid[day][week] = {
          date: dateStr,
          count: data[dateStr] || 0,
        };
      }

      // 每周第一天记录月份
      if (day === 0) {
        monthLabelArr[week] = cursor.getMonth();
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // 压缩月份标签：只在月份变化处显示
  const monthLabels = [];
  let lastMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const m = monthLabelArr[w];
    if (m !== lastMonth) {
      monthLabels.push({ week: w, label: MONTH_LABELS[m] });
      lastMonth = m;
    }
  }

  return { grid, monthLabels, totalWeeks };
}

// ============================================================
// 月份标签组件
// ============================================================

function MonthLabels({ monthLabels, labelAreaHeight }) {
  return (
    <G>
      {monthLabels.map((item, i) => (
        <Text
          key={i}
          x={item.week * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2}
          y={labelAreaHeight - 4}
          fontSize={10}
          fill={Colors.text.tertiary}
          textAnchor="middle"
        >
          {item.label}
        </Text>
      ))}
    </G>
  );
}

// ============================================================
// 星期标签组件
// ============================================================

function DayLabels({ labelWidth }) {
  return (
    <G>
      {DAY_LABELS.map((label, i) => (
        label ? (
          <Text
            key={i}
            x={labelWidth - 6}
            y={i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
            fontSize={10}
            fill={Colors.text.tertiary}
            textAnchor="end"
          >
            {label}
          </Text>
        ) : null
      ))}
    </G>
  );
}

// ============================================================
// 热力图网格
// ============================================================

function HeatmapGrid({ grid, offsetX, offsetY }) {
  return (
    <G>
      {grid.map((row, dayOfWeek) =>
        row.map((cell, week) => {
          if (!cell) return null;
          return (
            <Rect
              key={`${dayOfWeek}-${week}`}
              x={offsetX + week * (CELL_SIZE + CELL_GAP)}
              y={offsetY + dayOfWeek * (CELL_SIZE + CELL_GAP)}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              fill={getColor(cell.count)}
            />
          );
        })
      )}
    </G>
  );
}

// ============================================================
// Heatmap 主组件
// ============================================================

/**
 * @param {Object} props
 * @param {Object} props.data - 热力图数据 { '2026-05-15': 3, ... }
 */
function Heatmap({ data = {} }) {
  const { grid, monthLabels, totalWeeks } = useMemo(
    () => buildGrid(data),
    [data]
  );

  // 布局尺寸
  const labelWidth = 24;                    // 左侧星期标签宽度
  const labelAreaHeight = 18;               // 顶部月份标签高度
  const gridWidth = totalWeeks * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const gridHeight = DAYS_IN_WEEK * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const svgWidth = labelWidth + gridWidth;
  const svgHeight = labelAreaHeight + gridHeight;

  // 统计
  const totalCompleted = useMemo(() => {
    return Object.values(data).reduce((sum, c) => sum + c, 0);
  }, [data]);

  return (
    <View style={styles.container}>
      {/* SVG 热力图 */}
      <Svg width={svgWidth} height={svgHeight}>
        {/* 月份标签 */}
        <MonthLabels
          monthLabels={monthLabels}
          labelAreaHeight={labelAreaHeight}
        />

        {/* 星期标签 */}
        <DayLabels labelWidth={labelWidth} />

        {/* 热力图网格 */}
        <HeatmapGrid
          grid={grid}
          offsetX={labelWidth}
          offsetY={labelAreaHeight}
        />
      </Svg>

      {/* 图例 + 统计 */}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>
          近 60 天完成 {totalCompleted} 个任务
        </Text>
        <View style={styles.legendColors}>
          <Text style={styles.legendLabel}>少</Text>
          {[COLOR_EMPTY, COLOR_LEVEL1, COLOR_LEVEL2, COLOR_LEVEL3, COLOR_LEVEL4].map(
            (color, i) => (
              <View
                key={i}
                style={[styles.legendCell, { backgroundColor: color }]}
              />
            )
          )}
          <Text style={styles.legendLabel}>多</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  legendText: {
    ...Typography.micro,
    color: Colors.text.tertiary,
  },
  legendColors: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendLabel: {
    fontSize: 9,
    color: Colors.text.tertiary,
    marginHorizontal: 3,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginHorizontal: 1.5,
  },
});

// React.memo 防止多余渲染
export default React.memo(Heatmap);

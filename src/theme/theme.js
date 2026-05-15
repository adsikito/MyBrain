/**
 * MyBrain Design Tokens
 *
 * 严格对标 Things 3 设计语言：
 * - 纯白背景，呼吸感留白
 * - 0.5px 极细线条
 * - 克制的色彩运用
 * - 非线性动画曲线
 */

// ============================================================
// 色彩系统
// ============================================================

export const Colors = {
  // 主背景 - 纯白，Things 3 标志性的干净感
  background: '#FFFFFF',

  // 卡片背景 - 微妙的暖白，与主背景形成层次
  cardBackground: '#FAFAFA',

  // 文字色彩
  text: {
    primary: '#333333',     // 主标题色 - 沉稳不刺眼
    secondary: '#888888',   // 副标题色 - 低调存在
    tertiary: '#BBBBBB',    // 辅助文字 - 几乎隐没
    inverse: '#FFFFFF',     // 反色文字
  },

  // 分割线 - 极浅灰，0.5px 时几乎透明
  divider: '#F0F0F0',

  // 三轨分类色 - 克制但可辨识
  track: {
    sprint: '#FF6B6B',    // 冲刺轨 - 温暖的紧迫感
    marathon: '#4ECDC4',  // 马拉松轨 - 平静的持续感
    suspense: '#FFD93D',  // 悬念轨 - 等待的微光
  },

  // 状态色
  status: {
    active: '#333333',
    completed: '#BBBBBB',
    paused: '#888888',
    cancelled: '#FF6B6B',
  },

  // 交互色
  accent: '#007AFF',      // iOS 蓝，熟悉的安全感
  danger: '#FF3B30',      // 危险操作
  success: '#34C759',     // 成功状态
};

// ============================================================
// 字体系统
// ============================================================

export const Typography = {
  // 大标题 - 日期显示用
  largeTitle: {
    fontSize: 34,
    fontWeight: '200',     // 极细字重，Things 3 标志性风格
    letterSpacing: 0.37,
    color: Colors.text.primary,
  },

  // 标题
  title: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.35,
    color: Colors.text.primary,
  },

  // 副标题
  subtitle: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
    color: Colors.text.primary,
  },

  // 正文
  body: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.41,
    color: Colors.text.primary,
  },

  // 辅助文字
  caption: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.08,
    color: Colors.text.secondary,
  },

  // 极小标注
  micro: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.07,
    color: Colors.text.tertiary,
  },
};

// ============================================================
// 间距系统
// ============================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ============================================================
// 圆角系统
// ============================================================

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,   // 胶囊形状
};

// ============================================================
// 阴影系统 - Things 3 风格的极淡投影
// ============================================================

export const Shadows = {
  // 无阴影 - 默认状态
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // 极淡阴影 - 悬浮状态
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  // 轻阴影 - 按下状态
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
};

// ============================================================
// 动画曲线 - Things 3 非线性动画
// ============================================================

export const Animation = {
  // Things 3 标志性的柔和曲线
  easing: {
    // 主动画曲线 - 柔和减速
    default: [0.25, 0.1, 0.25, 1],
    // 进入动画 - 轻微弹性
    enter: [0.28, 0.84, 0.42, 1],
    // 退出动画 - 快速离开
    exit: [0.55, 0.085, 0.68, 0.53],
  },

  // 时长配置
  duration: {
    fast: 150,       // 微交互
    normal: 250,     // 标准过渡
    slow: 400,       // 大型动画
  },

  // 弹簧配置（用于 moti）
  spring: {
    // 轻微弹性 - 点击反馈
    subtle: {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    },
    // 标准弹性 - 状态变更
    default: {
      damping: 20,
      stiffness: 200,
      mass: 1,
    },
  },
};

// ============================================================
// 线条系统
// ============================================================

export const Borders = {
  // Things 3 标志性的 0.5px 线条
  hairline: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },

  // 标准 1px 线条
  thin: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
};

// ============================================================
// 导出完整主题对象
// ============================================================

const Theme = {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Animation,
  Borders,
};

export default Theme;

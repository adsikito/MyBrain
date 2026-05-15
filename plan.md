# MyBrain 开发计划

## 项目里程碑

### 阶段一：基础架构 ✅
- [x] SQLite 数据库设计与初始化
- [x] 核心数据模型实现
- [ ] 基础 CRUD 操作

### 阶段二：三轨引擎
- [ ] 任务分类引擎
- [ ] 动态重排算法
- [ ] 自动纠错自愈系统

### 阶段三：交互界面
- [ ] Things 3 风格 UI 组件库
- [ ] 主界面与任务列表
- [ ] 非线性动画系统

### 阶段四：平台适配
- [ ] vivo 后台常驻优化
- [ ] 通知系统集成
- [ ] 电池管理适配

---

## SQLite 数据库架构设计

### 设计原则
1. **本地优先**：所有数据存储在设备本地
2. **三轨分离**：通过轨道类型字段区分任务类别
3. **动态重排支持**：优先级、权重、时间戳字段支持实时排序
4. **自愈能力**：状态机设计支持异常检测与自动修复

### 核心表结构

#### 1. 任务主表 (tasks)

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    track           TEXT NOT NULL CHECK(track IN ('SPRINT', 'MARATHON', 'SUSPENSE')),
    status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED')),
    priority        INTEGER DEFAULT 50 CHECK(priority BETWEEN 0 AND 100),
    urgency         INTEGER DEFAULT 50 CHECK(urgency BETWEEN 0 AND 100),
    importance      INTEGER DEFAULT 50 CHECK(importance BETWEEN 0 AND 100),
    weight          REAL DEFAULT 0.0,
    due_date        TEXT,
    start_date      TEXT,
    completed_at    TEXT,
    estimated_minutes INTEGER,
    actual_minutes  INTEGER,
    category_id     TEXT,
    parent_id       TEXT,
    sort_order      INTEGER DEFAULT 0,
    recurrence_rule TEXT,
    metadata        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (parent_id) REFERENCES tasks(id)
);
```

#### 2. 分类表 (categories)

```sql
CREATE TABLE IF NOT EXISTS categories (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    color           TEXT,
    icon            TEXT,
    parent_id       TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

#### 3. 任务状态历史表 (task_status_history)

```sql
CREATE TABLE IF NOT EXISTS task_status_history (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    changed_at      TEXT NOT NULL DEFAULT (datetime('now')),
    reason          TEXT,
    auto_fixed      INTEGER DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### 4. 动态重排日志表 (reschedule_log)

```sql
CREATE TABLE IF NOT EXISTS reschedule_log (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    old_priority    INTEGER,
    new_priority    INTEGER,
    old_weight      REAL,
    new_weight      REAL,
    trigger_type    TEXT NOT NULL,
    algorithm       TEXT,
    rescheduled_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### 5. 悬念轨等待条件表 (suspense_conditions)

```sql
CREATE TABLE IF NOT EXISTS suspense_conditions (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    condition_type  TEXT NOT NULL CHECK(condition_type IN ('WAIT_RESPONSE', 'WAIT_RESOURCE', 'WAIT_DATE')),
    description     TEXT,
    target_date     TEXT,
    is_met          INTEGER DEFAULT 0,
    met_at          TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### 6. 用户偏好表 (user_preferences)

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 索引设计

```sql
CREATE INDEX IF NOT EXISTS idx_tasks_track ON tasks(track);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_weight ON tasks(weight DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_history_changed ON task_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_reschedule_task ON reschedule_log(task_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_time ON reschedule_log(rescheduled_at);
CREATE INDEX IF NOT EXISTS idx_suspense_task ON suspense_conditions(task_id);
CREATE INDEX IF NOT EXISTS idx_suspense_met ON suspense_conditions(is_met);
```

---

## 三轨分类算法

### 轨道判定规则

```
输入: 任务属性 (due_date, recurrence, external_dependency)
输出: track 类型

规则1: IF due_date 存在 AND due_date - now() < 7天 → SPRINT
规则2: IF recurrence 存在 OR (due_date 不存在 AND 无外部依赖) → MARATHON
规则3: IF external_dependency 存在 AND 未满足 → SUSPENSE
```

### 动态权重计算

```
weight = (urgency * 0.4) + (importance * 0.3) + (time_pressure * 0.3)

time_pressure = 
  IF track = SPRINT: 100 * (1 - remaining_hours / total_hours)
  IF track = MARATHON: 基于连续完成天数的衰减函数
  IF track = SUSPENSE: 0 (等待中不参与排序)
```

### 自动纠错规则

1. **过期任务检测**：`due_date < now() AND status = 'ACTIVE'` → 自动标记为需要重排
2. **长期未更新**：`updated_at < now() - 30天 AND track = 'MARATHON'` → 提醒确认
3. **悬念超时**：`target_date < now() AND is_met = 0` → 提醒跟进或取消
4. **孤儿任务**：`parent_id 指向已删除任务` → 自动提升为顶级任务

---

## 下一步行动

1. ✅ 确定技术栈（Expo + React Native）
2. ✅ 实现数据库初始化脚本
3. 开发核心 CRUD 服务层
4. 搭建基础 UI 框架

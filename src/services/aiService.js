/**
 * AI 服务层
 *
 * 封装与 LLM 的交互逻辑：
 * - 支持热切换模型（默认 GPT-4o）
 * - 内置三轨分类 System Prompt
 * - 强制纯 JSON 输出（无 Markdown 包裹）
 * - 请求重试与错误处理
 */

// ============================================================
// 配置区域 - API 密钥管理
// ============================================================

/**
 * AI 模型配置
 *
 * 使用 MiMo-v2.5-Pro 模型
 * API 地址：https://token-plan-cn.xiaomimimo.com/v1
 */
const MODEL_CONFIG = {
  // 当前使用的模型
  currentModel: 'mimo-v2.5-pro',

  // 可用模型列表
  models: {
    'mimo-v2.5-pro': {
      name: 'MiMo-v2.5-Pro',
      endpoint: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',
      maxTokens: 1000,
    },
  },
};

/**
 * API 密钥
 *
 * 通过 Expo 环境变量注入（EXPO_PUBLIC_ 前缀会自动暴露给客户端）
 * 使用方式：在项目根目录创建 .env 文件，写入：
 *   EXPO_PUBLIC_AI_API_KEY=你的密钥
 *
 * 切勿将真实密钥提交到 Git
 */
const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY || '';

// ============================================================
// System Prompt - 三轨分类核心指令
// ============================================================

/**
 * 三轨分类 System Prompt
 *
 * 关键约束：
 * 1. 强制要求 AI 只返回纯 JSON，不包含 Markdown 代码块
 * 2. 明确定义三轨分类规则
 * 3. 指定输出格式的每个字段
 */
const SYSTEM_PROMPT = `你是 MyBrain 智能任务管理系统的 AI 助手。你的职责是将用户的模糊输入转化为结构化的任务计划。

【三轨分类规则】
- SPRINT（冲刺轨）：有明确截止日期的短期高强度任务。特征：包含"明天"、"下周"、"截止"、"考试"、"作业"等时间压力词。
- MARATHON（马拉松轨）：长期持续、无硬性截止日期的任务。特征：包含"每天"、"坚持"、"练习"、"背诵"、"阅读"等持续性词汇。
- SUSPENSE（悬念轨）：等待外部条件才能执行的任务。特征：包含"等"、"回复"、"确认"、"反馈"、"到货"等等待性词汇。

【输出格式要求】
你必须严格按以下 JSON 格式返回，不要包含任何其他文字、解释或 Markdown 格式：

{
  "tasks": [
    {
      "title": "任务标题（简洁明了）",
      "description": "任务描述（可选）",
      "track": "SPRINT 或 MARATHON 或 SUSPENSE",
      "urgency": 50,
      "importance": 50,
      "estimated_minutes": 60,
      "due_date": "2024-05-20T18:00:00" 或 null,
      "recurrence_rule": "FREQ=DAILY" 或 null,
      "suspense_condition": {
        "condition_type": "WAIT_RESPONSE 或 WAIT_RESOURCE 或 WAIT_DATE",
        "description": "等待条件描述",
        "target_date": "2024-05-20T18:00:00" 或 null
      } 或 null
    }
  ]
}

【字段说明】
- title：任务标题，控制在20字以内
- description：任务描述，可选
- track：三轨分类，必填
- urgency：紧急度 0-100，默认50
- importance：重要度 0-100，默认50
- estimated_minutes：预估耗时（分钟）
- due_date：截止日期 ISO 8601 格式，无则为 null
- recurrence_rule：重复规则 iCal RRULE，无则为 null
- suspense_condition：仅 SUSPENSE 轨道需要，其他轨道为 null

【重要提醒】
1. 只返回纯 JSON，绝对不要用 \`\`\`json 或 \`\`\` 包裹
2. 不要添加任何解释文字
3. 确保 JSON 格式正确，可直接被解析
4. 如果用户输入模糊，基于常识合理推测`;

// ============================================================
// 核心函数
// ============================================================

/**
 * 解析 AI 返回的文本
 *
 * 防御性解析：
 * 1. 尝试直接 JSON.parse
 * 2. 如果失败，尝试提取 JSON 子串
 * 3. 移除可能的 Markdown 代码块包裹
 *
 * @param {string} text - AI 返回的原始文本
 * @returns {Object} 解析后的 JSON 对象
 * @throws {Error} 解析失败时抛出错误
 */
function parseAIResponse(text) {
  // 预处理：移除首尾空白
  let cleaned = text.trim();

  // 尝试移除 Markdown 代码块包裹（防御性处理）
  // 匹配 ```json ... ``` 或 ``` ... ```
  const markdownPattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(markdownPattern);
  if (match) {
    cleaned = match[1].trim();
  }

  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 尝试查找 JSON 对象的起止位置
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(jsonStr);
      } catch (e2) {
        throw new Error('AI 返回的 JSON 格式无效: ' + e2.message);
      }
    }

    throw new Error('无法从 AI 响应中提取 JSON: ' + text.substring(0, 100));
  }
}

/**
 * 调用 AI 服务
 *
 * @param {string} userInput - 用户输入的文本
 * @param {Object} options - 可选配置
 * @param {string} options.model - 指定模型（覆盖默认）
 * @param {number} options.temperature - 温度参数（0-1）
 * @returns {Promise<Object>} 解析后的任务数据
 */
export async function callAI(userInput, options = {}) {
  const {
    model = MODEL_CONFIG.currentModel,
    temperature = 0.3,  // 低温度，确保输出稳定
  } = options;

  // 获取模型配置
  const modelConfig = MODEL_CONFIG.models[model];
  if (!modelConfig) {
    throw new Error(`不支持的模型: ${model}`);
  }

  // 构建请求体
  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userInput },
    ],
    temperature: temperature,
    max_tokens: modelConfig.maxTokens,
    response_format: { type: 'json_object' },  // 强制 JSON 输出（GPT-4o 支持）
  };

  // 超时熔断：30 秒 AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    // 清除超时定时器
    clearTimeout(timeoutId);

    // 检查 HTTP 状态
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // 提取 AI 回复
    const aiMessage = data.choices?.[0]?.message?.content;
    if (!aiMessage) {
      throw new Error('AI 返回内容为空');
    }

    // 解析 JSON
    const parsed = parseAIResponse(aiMessage);

    // 验证结构
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('AI 返回格式错误：缺少 tasks 数组');
    }

    return parsed;

  } catch (error) {
    // 清除超时定时器（防止内存泄漏）
    clearTimeout(timeoutId);

    // 超时熔断：捕获 AbortError，抛出明确提示
    if (error.name === 'AbortError') {
      throw new Error('AI 思考超时 (30秒)。可能是网络信号不稳定，请重试。');
    }

    console.error('[MyBrain AI] 请求失败:', error.message);
    throw error;
  }
}

/**
 * 快速任务解析
 *
 * 简化版接口，用于轻量级场景
 * 直接返回第一个任务，而非任务数组
 *
 * @param {string} userInput - 用户输入
 * @returns {Promise<Object>} 单个任务对象
 */
export async function quickParse(userInput) {
  const result = await callAI(userInput, { temperature: 0.2 });
  return result.tasks[0];
}

/**
 * 设置当前使用的模型
 *
 * @param {string} modelName - 模型名称
 */
export function setCurrentModel(modelName) {
  if (!MODEL_CONFIG.models[modelName]) {
    throw new Error(`不支持的模型: ${modelName}`);
  }
  MODEL_CONFIG.currentModel = modelName;
}

/**
 * 获取当前模型信息
 *
 * @returns {Object} 当前模型配置
 */
export function getCurrentModel() {
  return {
    id: MODEL_CONFIG.currentModel,
    ...MODEL_CONFIG.models[MODEL_CONFIG.currentModel],
  };
}

/**
 * 设置 API 密钥
 *
 * @param {string} apiKey - API 密钥
 */
export function setApiKey(apiKey) {
  // TODO: 实际应用中应存储到 expo-secure-store
}

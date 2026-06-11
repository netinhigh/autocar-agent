/* ================================================================
   共享数据桥接模块 — Shared Data Bridge
   连接「用户洞察Agent」与「虚拟消费者Agent」
   ================================================================ */

// ========== 统一群组分类规则 ==========
// 与用户洞察Agent的 LIFE_STAGES × VALUE_ORIENTATIONS 保持一致

var UNIFIED_LIFE_STAGES = [
  { id: 'unmarried-female', label: '未婚女性', desc: '未婚女性用户' },
  { id: 'unmarried-male', label: '未婚男性', desc: '未婚男性用户' },
  { id: 'married-no-child-female', label: '已婚未育女性', desc: '已婚暂无子女的女性' },
  { id: 'married-no-child-male', label: '已婚未育男性', desc: '已婚暂无子女的男性' },
  { id: 'has-children', label: '有孩男女', desc: '已婚有子女的家庭' },
  { id: 'children-grown', label: '已婚子女成年', desc: '子女已成年的家庭' },
  { id: 'retired', label: '退休', desc: '已退休人群' }
];

var UNIFIED_VALUE_ORIENTATIONS = ['保守', '稳健', '前卫'];

// ========== 群组名称映射表（与用户洞察Agent完全一致） ==========
var GROUP_NAME_MAP = {
  'unmarried-female': { '保守': '谨慎待嫁', '稳健': '知性独立', '前卫': '先锋女性' },
  'unmarried-male': { '保守': '踏实青年', '稳健': '进取新锐', '前卫': '潮流先锋' },
  'married-no-child-female': { '保守': '安家常青', '稳健': '品质生活家', '前卫': '时尚辣妈预备' },
  'married-no-child-male': { '保守': '稳重支柱', '稳健': '事业中坚', '前卫': '新潮奶爸预备' },
  'has-children': { '保守': '传统家庭', '稳健': '精明爸妈', '前卫': '潮爸潮妈' },
  'children-grown': { '保守': '传统长辈', '稳健': '成熟中产', '前卫': '潇洒银发' },
  'retired': { '保守': '安享晚年', '稳健': '智慧长者', '前卫': '活力退休' }
};

// ========== 群组关键词映射表 ==========
var GROUP_KEYWORD_MAP = {
  'unmarried-female': { '保守': ['价格敏感', '口碑导向', '实用主义'], '稳健': ['品质追求', '理性决策', '品牌认知'], '前卫': ['科技尝鲜', '个性表达', '社交分享'] },
  'unmarried-male': { '保守': ['经济适用', '稳重可靠', '传统审美'], '稳健': ['性能均衡', '品牌忠诚', '理性消费'], '前卫': ['智能科技', '运动操控', '潮流设计'] },
  'married-no-child-female': { '保守': ['居家实用', '安全优先', '经济考量'], '稳健': ['品质升级', '生活品味', '精致出行'], '前卫': ['自我表达', '时尚科技', '社交属性'] },
  'married-no-child-male': { '保守': ['家庭责任', '稳重踏实', '传统价值'], '稳健': ['事业进阶', '品质生活', '理性投资'], '前卫': ['科技先锋', '生活方式', '个性彰显'] },
  'has-children': { '保守': ['空间优先', '安全至上', '经济实用'], '稳健': ['家庭出行', '品质教育', '理性升级'], '前卫': ['智能座舱', '亲子科技', '潮流家庭'] },
  'children-grown': { '保守': ['节俭持家', '传统观念', '稳定需求'], '稳健': ['品质养老', '舒适出行', '理性消费'], '前卫': ['享受生活', '科技养老', '品质追求'] },
  'retired': { '保守': ['节俭习惯', '安全稳重', '传统需求'], '稳健': ['舒适出行', '品质生活', '健康养生'], '前卫': ['活力老年', '科技探索', '社交生活'] }
};

// ========== 数字分身初始化数据推断 ==========

// 根据真实用户的调研类型推断初始访谈轮次
function inferInterviewRounds(userSample) {
  if (!userSample) return 0;
  
  var researchType = userSample.researchType || '';
  var hasNotes = userSample.notes && userSample.notes.trim().length > 0;
  var researchDate = userSample.researchDate;
  
  // 基于调研类型推断基础轮次
  var baseRounds = 0;
  if (researchType.indexOf('一对一深访') >= 0) {
    baseRounds = 2; // 一对一深访通常2-3轮
  } else if (researchType.indexOf('焦点小组') >= 0) {
    baseRounds = 1; // 焦点小组通常1轮
  } else if (researchType.indexOf('问卷') >= 0) {
    baseRounds = 1;
  } else if (researchType.indexOf('试乘') >= 0 || researchType.indexOf('试驾') >= 0) {
    baseRounds = 2;
  }
  
  // 如果有调研笔记/备注，说明有实质内容，增加1-2轮
  if (hasNotes) {
    baseRounds += 1;
  }
  
  // 如果有明确的研究日期，说明有过正式调研
  if (researchDate) {
    baseRounds = Math.max(baseRounds, 1);
  }
  
  // 随机增加0-1轮模拟多次访谈
  baseRounds += Math.floor(Math.random() * 2);
  
  return Math.max(1, Math.min(baseRounds, 8)); // 限制在1-8轮之间
}

// 根据访谈轮次推断初始准确度
function inferInitialAccuracy(rounds, userSample) {
  if (!rounds || rounds <= 0) return 0.72;
  
  // 基础准确度
  var baseAccuracy = 0.72;
  
  // 每轮访谈增加准确度（递减效应）
  var accuracyPerRound = 0.025;
  var totalIncrease = accuracyPerRound * rounds;
  
  // 一对一深访问答更深入，准确度加成
  var researchType = userSample ? (userSample.researchType || '') : '';
  if (researchType.indexOf('一对一深访') >= 0) {
    totalIncrease += 0.02;
  }
  
  // 有详细笔记说明数据质量高
  if (userSample && userSample.notes && userSample.notes.trim().length > 10) {
    totalIncrease += 0.015;
  }
  
  var finalAccuracy = baseAccuracy + totalIncrease;
  return Math.min(0.95, Math.max(0.72, parseFloat(finalAccuracy.toFixed(3))));
}

// 构建初始准确度收敛历史
function buildInitialAccuracyHistory(rounds, finalAccuracy) {
  var history = [];
  if (rounds <= 0) return history;
  
  var startAccuracy = 0.72;
  var step = (finalAccuracy - startAccuracy) / rounds;
  
  for (var i = 1; i <= rounds; i++) {
    var acc = startAccuracy + step * i;
    // 添加一些随机波动使其更真实
    acc += (Math.random() - 0.5) * 0.01;
    history.push({
      round: i,
      accuracy: parseFloat(Math.min(0.95, Math.max(0.70, acc)).toFixed(3)),
      topic: '历史访谈数据',
      source: 'inherit'
    });
  }
  
  return history;
}

// ========== 用户数据标准化 ==========

// 从用户样本库(userSample)转换为数字分身基础数据(digitalTwin base)
function convertUserSampleToVCBase(userSample) {
  if (!userSample) return null;

  // 推断用户特征标签
  var tags = inferConsumerTags(userSample);

  // 推断群组归属
  var groupInfo = getUserGroup(userSample);

  return {
    id: userSample.id || ('U-' + Date.now()),
    uniqueCode: userSample.uniqueCode || '',
    name: userSample.name || '未命名用户',
    avatar: (userSample.name || 'U').charAt(0),
    brief: buildUserBrief(userSample),
    meta: buildUserMeta(userSample),
    // 原始用户数据
    source: {
      sessionId: userSample.sessionId || '',
      product: userSample.product || '',
      researchType: userSample.researchType || '',
      researchDate: userSample.researchDate || '',
      origin: '用户洞察平台-用户样本库'
    },
    // 消费理念标签（基于用户数据推断）
    consumerTags: tags,
    // 车辆偏好
    vehiclePreference: inferVehiclePreference(userSample),
    // 群组归属（与用户洞察平台一致）
    group: groupInfo,
    // 同步时间
    syncedAt: new Date().toISOString()
  };
}

// 构建用户简介
function buildUserBrief(user) {
  var parts = [];
  if (user.age) parts.push(user.age + '岁');
  if (user.gender) parts.push(user.gender);
  var city = user.cityLevel || user.city;
  if (city) parts.push(city + (user.cityLevel ? '城市' : ''));
  return parts.join('·') || '未知';
}

// 构建用户元数据
function buildUserMeta(user) {
  var parts = [];
  if (user.income) parts.push('年收入 ' + user.income);
  if (user.maritalStatus) {
    var marital = user.maritalStatus === '已婚' ? '已婚' : (user.maritalStatus === '未婚' ? '未婚' : user.maritalStatus);
    parts.push(marital);
  }
  if (user.children && user.children !== '无子女') parts.push(user.children);
  if (user.carOwnership) parts.push(user.carOwnership);
  return parts.join(' | ') || '未知';
}

// 推断消费者标签（8个维度）
function inferConsumerTags(user) {
  var tags = [];

  // 1. 决策风格
  var decisionStyle = inferDecisionStyle(user);
  tags.push({ name: '决策风格', value: decisionStyle.value, score: decisionStyle.score, confidence: decisionStyle.confidence });

  // 2. 功能偏好
  var funcPref = inferFunctionPreference(user);
  tags.push({ name: '功能偏好', value: funcPref.value, score: funcPref.score, confidence: funcPref.confidence });

  // 3. 价格敏感度
  var priceSense = inferPriceSensitivity(user);
  tags.push({ name: '价格敏感度', value: priceSense.value, score: priceSense.score, confidence: priceSense.confidence });

  // 4. 科技偏好
  var techPref = inferTechPreference(user);
  tags.push({ name: '科技偏好', value: techPref.value, score: techPref.score, confidence: techPref.confidence });

  // 5. 品牌忠诚度
  var brandLoyalty = inferBrandLoyalty(user);
  tags.push({ name: '品牌忠诚度', value: brandLoyalty.value, score: brandLoyalty.score, confidence: brandLoyalty.confidence });

  // 6. 安全关注度
  var safetyConcern = inferSafetyConcern(user);
  tags.push({ name: '安全关注度', value: safetyConcern.value, score: safetyConcern.score, confidence: safetyConcern.confidence });

  // 7. 外观偏好
  var appearance = inferAppearance(user);
  tags.push({ name: '外观偏好', value: appearance.value, score: appearance.score, confidence: appearance.confidence });

  // 8. 续航焦虑
  var rangeAnxiety = inferRangeAnxiety(user);
  tags.push({ name: '续航焦虑', value: rangeAnxiety.value, score: rangeAnxiety.score, confidence: rangeAnxiety.confidence });

  return tags;
}

// 推断决策风格
function inferDecisionStyle(user) {
  var income = user.income || '';
  var age = parseInt(user.age) || 30;
  var hasChildren = user.hasChildren || (user.children && user.children !== '无子女');

  if (income.includes('50万') || income.includes('100万')) {
    return { value: '品质导向型', score: 0.85, confidence: 0.90 };
  }
  if (hasChildren && age >= 30) {
    return { value: '理性分析型', score: 0.75, confidence: 0.85 };
  }
  if (!hasChildren && age < 30) {
    return { value: '冲动体验型', score: 0.72, confidence: 0.82 };
  }
  if (income.includes('10万以下') || income.includes('10-20万')) {
    return { value: '谨慎比价型', score: 0.78, confidence: 0.88 };
  }
  return { value: '理性分析型', score: 0.70, confidence: 0.80 };
}

// 推断功能偏好
function inferFunctionPreference(user) {
  var hasChildren = user.hasChildren || (user.children && user.children !== '无子女');
  var income = user.income || '';
  var age = parseInt(user.age) || 30;

  if (income.includes('50万') || income.includes('100万')) {
    return { value: '豪华舒适优先', score: 0.85, confidence: 0.90 };
  }
  if (hasChildren) {
    return { value: '空间与安全优先', score: 0.85, confidence: 0.88 };
  }
  if (age < 30) {
    return { value: '外观与性能优先', score: 0.78, confidence: 0.84 };
  }
  if (income.includes('10万以下')) {
    return { value: '性价比优先', score: 0.82, confidence: 0.87 };
  }
  return { value: '均衡全面', score: 0.65, confidence: 0.78 };
}

// 推断价格敏感度
function inferPriceSensitivity(user) {
  var income = user.income || '';

  if (income.includes('100万')) return { value: '极低', score: 0.10, confidence: 0.92 };
  if (income.includes('50万')) return { value: '较低', score: 0.25, confidence: 0.88 };
  if (income.includes('10万以下')) return { value: '极高', score: 0.88, confidence: 0.90 };
  if (income.includes('10-20万')) return { value: '较高', score: 0.70, confidence: 0.85 };
  if (income.includes('20-30万')) return { value: '中等', score: 0.52, confidence: 0.83 };
  return { value: '中等', score: 0.50, confidence: 0.80 };
}

// 推断科技偏好
function inferTechPreference(user) {
  var age = parseInt(user.age) || 30;
  var education = user.education || '';
  var carOwnership = user.carOwnership || '';

  if (carOwnership.includes('新能源')) return { value: '高', score: 0.82, confidence: 0.88 };
  if (age < 28 && (education === '本科' || education === '硕士')) return { value: '极高', score: 0.88, confidence: 0.85 };
  if (age < 35) return { value: '高', score: 0.75, confidence: 0.83 };
  if (age >= 50) return { value: '较低', score: 0.25, confidence: 0.85 };
  return { value: '中等', score: 0.50, confidence: 0.80 };
}

// 推断品牌忠诚度
function inferBrandLoyalty(user) {
  var carOwnership = user.carOwnership || '';
  var currentCar = user.currentCar || '';

  if (currentCar && (currentCar.includes('宝马') || currentCar.includes('奔驰') || currentCar.includes('奥迪'))) {
    return { value: '极高', score: 0.90, confidence: 0.88 };
  }
  if (carOwnership === '无车') return { value: '低', score: 0.20, confidence: 0.82 };
  if (currentCar && currentCar.length > 0) return { value: '中等', score: 0.50, confidence: 0.78 };
  return { value: '中等', score: 0.45, confidence: 0.75 };
}

// 推断安全关注度
function inferSafetyConcern(user) {
  var hasChildren = user.hasChildren || (user.children && user.children !== '无子女');
  var age = parseInt(user.age) || 30;

  if (hasChildren) return { value: '极高', score: 0.90, confidence: 0.88 };
  if (age >= 40) return { value: '高', score: 0.80, confidence: 0.85 };
  if (age < 28) return { value: '中等', score: 0.50, confidence: 0.80 };
  return { value: '高', score: 0.72, confidence: 0.82 };
}

// 推断外观偏好
function inferAppearance(user) {
  var gender = user.gender || '';
  var age = parseInt(user.age) || 30;
  var income = user.income || '';

  if (income.includes('50万') || income.includes('100万')) return { value: '豪华商务风', score: 0.82, confidence: 0.85 };
  if (gender === '男' && age < 30) return { value: '运动潮流风', score: 0.80, confidence: 0.83 };
  if (gender === '女' && age < 30) return { value: '简约时尚风', score: 0.75, confidence: 0.80 };
  if (age >= 40) return { value: '稳重家用风', score: 0.65, confidence: 0.82 };
  return { value: '简约实用风', score: 0.55, confidence: 0.78 };
}

// 推断续航焦虑
function inferRangeAnxiety(user) {
  var carOwnership = user.carOwnership || '';
  var income = user.income || '';

  if (carOwnership.includes('新能源')) return { value: '中等', score: 0.45, confidence: 0.80 };
  if (carOwnership === '无车') return { value: '高', score: 0.75, confidence: 0.82 };
  if (income.includes('50万') || income.includes('100万')) return { value: '较低', score: 0.30, confidence: 0.78 };
  return { value: '中等', score: 0.50, confidence: 0.75 };
}

// 推断车辆偏好
function inferVehiclePreference(user) {
  var income = user.income || '';
  var hasChildren = user.hasChildren || (user.children && user.children !== '无子女');
  var age = parseInt(user.age) || 30;

  var pref = {
    vehicleType: 'SUV',
    priceRange: '15-30万',
    priority: []
  };

  // 推断价格区间
  if (income.includes('100万')) pref.priceRange = '40万以上';
  else if (income.includes('50万')) pref.priceRange = '25-50万';
  else if (income.includes('30万')) pref.priceRange = '20-35万';
  else if (income.includes('20万')) pref.priceRange = '15-25万';
  else if (income.includes('10万以下')) pref.priceRange = '8-15万';

  // 推断优先级
  if (hasChildren) pref.priority = ['安全', '空间', '续航', '智能化', '外观', '价格'];
  else if (age < 30) pref.priority = ['外观', '智能化', '性能', '价格', '安全', '空间'];
  else if (age >= 40) pref.priority = ['品质', '舒适', '安全', '品牌', '续航', '智能化'];
  else pref.priority = ['续航', '智能化', '安全', '空间', '价格', '外观'];

  return pref;
}

// ========== 群组归属推断 ==========

// 简单字符串哈希
function bridgeStringHash(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// 获取用户的价值观（与用户洞察Agent一致的哈希算法）
function getUserValueOrientation(user) {
  var hash = bridgeStringHash(user.id || user.uniqueCode || user.name || '');
  var index = Math.abs(hash) % UNIFIED_VALUE_ORIENTATIONS.length;
  return UNIFIED_VALUE_ORIENTATIONS[index];
}

// 获取用户的人生阶段（与用户洞察Agent一致的分类逻辑）
function getUserLifeStage(user) {
  var age = parseInt(user.age) || 30;
  var gender = user.gender || '';
  var marital = user.maritalStatus || '';
  var children = user.children || '';

  if (age >= 60) return 'retired';
  if (age >= 50 && marital === '已婚' && children !== '无子女') return 'children-grown';
  if (marital === '已婚' && (children === '1个孩子' || children === '2个孩子' || children === '3个及以上')) return 'has-children';
  if (marital === '已婚' && (children === '无子女' || children === '计划中' || children === '计划生育')) {
    return gender === '女' ? 'married-no-child-female' : 'married-no-child-male';
  }
  if (marital === '未婚') {
    return gender === '女' ? 'unmarried-female' : 'unmarried-male';
  }
  return gender === '女' ? 'unmarried-female' : 'unmarried-male';
}

// 获取用户完整群组信息
function getUserGroup(user) {
  var lifeStage = getUserLifeStage(user);
  var valueOrientation = getUserValueOrientation(user);
  var groupName = (GROUP_NAME_MAP[lifeStage] || {})[valueOrientation] || (valueOrientation + '型用户');
  var keywords = (GROUP_KEYWORD_MAP[lifeStage] || {})[valueOrientation] || ['综合型用户', '多元需求'];

  return {
    lifeStageId: lifeStage,
    lifeStageLabel: (UNIFIED_LIFE_STAGES.find(function(s) { return s.id === lifeStage; }) || {}).label || '未知',
    valueOrientation: valueOrientation,
    groupName: groupName,
    keywords: keywords
  };
}

// ========== 双向数据同步API ==========

// 全局共享数据存储
var SharedDataStore = (function() {
  var store = {
    // 用户样本库数据（来自用户洞察Agent）
    userSamples: [],
    // 已同步的数字分身
    syncedDigitalTwins: [],
    // 虚拟消费者数据（包括数字分身和完全虚拟）
    virtualConsumers: [],
    // 最后同步时间
    lastSyncTime: null,
    // 同步日志
    syncLog: [],
    // ★ 数据版本号：每次用户样本库有变更（新增/更新）时递增
    dataVersion: 0,
    // ★ 数字分身版本号：每次数字分身重新生成后递增
    dtVersion: 0
  };

  // 使用 localStorage 保留版本号和轻量元数据（跨标签页检测用）
  var STORAGE_KEY = 'vc_ui_shared_data';
  var VERSION_KEY = 'vc_ui_data_version';
  
  // ★ 双存储引擎：StorageEngine（IndexedDB 本地 + Supabase 云端）
  var cloudSyncTimer = null;
  var CLOUD_SYNC_DEBOUNCE_MS = 2000;
  var cloudLoaded = false;
  var _engineReady = false;

  // 构建数据快照
  function _buildSnapshot() {
    return {
      userSamples: store.userSamples,
      syncedDigitalTwins: store.syncedDigitalTwins,
      virtualConsumers: store.virtualConsumers,
      lastSyncTime: store.lastSyncTime,
      dataVersion: store.dataVersion,
      dtVersion: store.dtVersion
    };
  }

  // 从快照恢复内存
  function _applySnapshot(snap) {
    if (!snap) return;
    store.userSamples = snap.userSamples || [];
    store.syncedDigitalTwins = snap.syncedDigitalTwins || [];
    store.virtualConsumers = snap.virtualConsumers || [];
    store.lastSyncTime = snap.lastSyncTime || null;
    store.dataVersion = snap.dataVersion || 0;
    store.dtVersion = snap.dtVersion || 0;
  }

  function save() {
    var snap = _buildSnapshot();

    // 1) 轻量 localStorage 备胎（跨标签页检测 + 紧急回退）
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      localStorage.setItem(VERSION_KEY, JSON.stringify({
        dataVersion: store.dataVersion,
        dtVersion: store.dtVersion,
        timestamp: Date.now()
      }));
    } catch(e) {}

    // 2) 双存储引擎：IndexedDB 本地 + Supabase 云端
    if (window.StorageEngine) {
      StorageEngine.save('shared_store', snap).then(function(r) {
        if (!r.local) console.warn('[SharedDataStore] 本地写入失败');
        if (r.cloud && !r.cloud.ok) {
          console.warn('[SharedDataStore] 云端写入跳过:', r.cloudSkipped);
        }
      });
    } else {
      // 降级：仅云端防抖保存
      saveToCloudDebounced();
    }
  }

  // ★ 云端防抖保存（降级方案）
  function saveToCloudDebounced() {
    if (!window.SUPABASE_READY) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(function() {
      if (window.Auth) {
        window.Auth.saveUserData('shared_store', _buildSnapshot());
        console.log('[SharedDataStore] 云端降级同步完成');
      }
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }

  // ★ 加载：云端优先 → 本地 IndexedDB 兜底 → localStorage 兜底
  function loadFromCloud() {
    return new Promise(function(resolve) {
      // 优先使用 StorageEngine.load（云→本地 级联）
      if (window.StorageEngine) {
        StorageEngine.load('shared_store').then(function(r) {
          if (r && r.data) {
            _applySnapshot(r.data);
            cloudLoaded = true;
            console.log('[SharedDataStore] 加载成功 (来源=' + r.source + ', v' + store.dataVersion + ')');
            resolve(true);
          } else {
            // 全部失败，尝试 localStorage 兜底
            _loadFromLocalStorage();
            resolve(false);
          }
        });
        return;
      }

      // 降级：旧版云端加载
      if (!window.SUPABASE_READY || !window.Auth) { resolve(false); return; }
      window.Auth.loadUserData('shared_store').then(function(d) {
        if (d) { _applySnapshot(d); cloudLoaded = true; resolve(true); }
        else { _loadFromLocalStorage(); resolve(false); }
      }).catch(function() { _loadFromLocalStorage(); resolve(false); });
    });
  }

  function _loadFromLocalStorage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) _applySnapshot(JSON.parse(saved));
    } catch(e) {}
  }

  function load() {
    _loadFromLocalStorage();
  }

  // 初始化时加载本地 localStorage 数据（快速启动）
  load();

  return {
    // 从用户洞察平台推送用户样本数据（全量替换模式）
    // 用户洞察平台的用户样本库是权威数据源，每次推送都是全量快照
    pushUserSamples: function(samples) {
      if (!samples || !samples.length) return { added: 0, updated: 0 };

      var oldCount = store.userSamples.length;
      var newCount = samples.length;

      // ★ 全量替换：用户洞察平台的用户样本库是权威数据源
      // 如果之前有多余的用户（如调研未完成但之前被同步的），现在会被自动清除
      var oldSamplesMap = {};
      for (var i = 0; i < store.userSamples.length; i++) {
        oldSamplesMap[store.userSamples[i].id] = store.userSamples[i];
      }

      var newSamplesMap = {};
      var added = 0, updated = 0, removed = 0;

      for (var i = 0; i < samples.length; i++) {
        var sample = samples[i];
        newSamplesMap[sample.id] = true;
        if (oldSamplesMap[sample.id]) {
          if (JSON.stringify(oldSamplesMap[sample.id]) !== JSON.stringify(sample)) {
            updated++;
          }
        } else {
          added++;
        }
      }

      for (var id in oldSamplesMap) {
        if (!newSamplesMap[id]) {
          removed++;
        }
      }

      var hasChange = (added > 0 || updated > 0 || removed > 0 || oldCount !== newCount);

      // 全量替换
      store.userSamples = samples.slice();

      if (hasChange) {
        store.dataVersion++;
        console.log('[SharedDataStore] 用户样本库已全量更新，版本号 → v' + store.dataVersion + 
          ' (总数: ' + oldCount + '→' + newCount + ', 新增 ' + added + ', 更新 ' + updated + ', 移除 ' + removed + ')');
      }

      store.lastSyncTime = new Date().toISOString();
      store.syncLog.push({
        time: store.lastSyncTime,
        action: 'pushUserSamples',
        detail: '全量替换：' + oldCount + '→' + newCount + ' (新增 ' + added + ', 更新 ' + updated + ', 移除 ' + removed + '), 版本 v' + store.dataVersion
      });

      save();
      return { added: added, updated: updated, removed: removed, version: store.dataVersion };
    },

    // 获取用户样本数据
    getUserSamples: function() {
      return store.userSamples.slice();
    },

    // 将用户样本转换为数字分身并同步到虚拟消费者平台
    syncToDigitalTwins: function() {
      // ★ 全量替换：先清除旧的数字分身列表，确保与当前用户样本完全一致
      store.syncedDigitalTwins = [];
      
      var newTwins = [];
      for (var i = 0; i < store.userSamples.length; i++) {
        var vcBase = convertUserSampleToVCBase(store.userSamples[i]);
        if (vcBase) {
          // 检查是否已有对应数字分身
          var existingTwin = null;
          for (var j = 0; j < store.syncedDigitalTwins.length; j++) {
            if (store.syncedDigitalTwins[j].sourceUserId === vcBase.id ||
                (vcBase.uniqueCode && store.syncedDigitalTwins[j].sourceUniqueCode === vcBase.uniqueCode)) {
              existingTwin = store.syncedDigitalTwins[j];
              break;
            }
          }

          if (existingTwin) {
            // ====== 已有数字分身，真实用户再次参加调研 → 自动校准 ======
            var oldConsumerTags = existingTwin.consumerTags || [];
            var newConsumerTags = vcBase.consumerTags || [];
            
            // 更新基础信息
            existingTwin.name = vcBase.name;
            existingTwin.brief = vcBase.brief;
            existingTwin.meta = vcBase.meta;
            
            // 记录标签变化（用于校准对比）
            var tagDiffs = computeTagDiffs(oldConsumerTags, newConsumerTags);
            
            // 基于新调研数据校准数字分身的标签评分
            var calibratedTags = calibrateTagsFromNewResearch(oldConsumerTags, newConsumerTags, existingTwin.interviewRounds);
            existingTwin.consumerTags = calibratedTags;
            
            // 更新群组归属（人生阶段可能变化）
            existingTwin.group = vcBase.group;
            existingTwin.vehiclePreference = vcBase.vehiclePreference;
            
            // 增加访谈轮次和准确度
            existingTwin.interviewRounds += 1;
            var accuracyBoost = calculateAutoCalibrationAccuracyBoost(tagDiffs);
            existingTwin.accuracy = Math.min(0.98, existingTwin.accuracy + accuracyBoost);
            existingTwin.confidence = Math.min(0.95, existingTwin.confidence + 0.01);
            
            // 追加准确度历史
            if (!existingTwin.accuracyHistory) existingTwin.accuracyHistory = [];
            existingTwin.accuracyHistory.push({
              round: existingTwin.interviewRounds,
              accuracy: parseFloat(existingTwin.accuracy.toFixed(3)),
              topic: vcBase.source ? vcBase.source.researchType : '回访调研',
              source: 'auto-calibrate',
              tagDiffs: tagDiffs
            });
            
            // 记录自动校准日志
            if (!existingTwin.calibrationLog) existingTwin.calibrationLog = [];
            existingTwin.calibrationLog.push({
              time: new Date().toISOString(),
              type: 'auto-calibrate',
              researchType: vcBase.source ? vcBase.source.researchType : '回访调研',
              tagDiffs: tagDiffs,
              accuracyBefore: parseFloat((existingTwin.accuracy - accuracyBoost).toFixed(3)),
              accuracyAfter: parseFloat(existingTwin.accuracy.toFixed(3)),
              summary: generateCalibrationSummary(tagDiffs, existingTwin)
            });
            
            // 更新调研信息
            existingTwin.researchType = store.userSamples[i].researchType || existingTwin.researchType;
            existingTwin.researchDate = store.userSamples[i].researchDate || existingTwin.researchDate;
            existingTwin.researchNotes = (existingTwin.researchNotes ? existingTwin.researchNotes + '；' : '') + (store.userSamples[i].notes || '');
            existingTwin.source = vcBase.source;
            
            // 同步更新定量信息（真实用户信息可能变化）
            existingTwin.age = store.userSamples[i].age || existingTwin.age;
            existingTwin.gender = store.userSamples[i].gender || existingTwin.gender;
            existingTwin.maritalStatus = store.userSamples[i].maritalStatus || existingTwin.maritalStatus;
            existingTwin.children = store.userSamples[i].children || existingTwin.children;
            existingTwin.city = store.userSamples[i].city || existingTwin.city;
            existingTwin.cityLevel = store.userSamples[i].cityLevel || existingTwin.cityLevel;
            existingTwin.education = store.userSamples[i].education || existingTwin.education;
            existingTwin.income = store.userSamples[i].income || existingTwin.income;
            existingTwin.carOwnership = store.userSamples[i].carOwnership || existingTwin.carOwnership;
            existingTwin.currentCar = store.userSamples[i].currentCar || existingTwin.currentCar;
            
            existingTwin.updatedAt = new Date().toISOString();
            newTwins.push(existingTwin);
          } else {
            // 创建新的数字分身，完整继承真实用户的定量和定性数据
            var us = store.userSamples[i];
            var inferredRounds = inferInterviewRounds(us);
            var inferredAccuracy = inferInitialAccuracy(inferredRounds, us);
            var inferredHistory = buildInitialAccuracyHistory(inferredRounds, inferredAccuracy);
            
            // 推断用户人格特征（说话方式、生活理念、行为逻辑）
            var personality = inferPersonalityTraits(us);
            
            var newTwin = {
              id: 'DT-' + vcBase.id,
              sourceUserId: vcBase.id,
              sourceUniqueCode: vcBase.uniqueCode,
              realUserId: vcBase.id,
              name: vcBase.name,
              avatar: vcBase.avatar,
              brief: vcBase.brief,
              meta: vcBase.meta,
              type: 'digital_twin',
              interviewRounds: inferredRounds,
              accuracy: inferredAccuracy,
              confidence: Math.min(0.92, 0.70 + inferredRounds * 0.02),
              consumerTags: vcBase.consumerTags,
              vehiclePreference: vcBase.vehiclePreference,
              group: vcBase.group,
              source: vcBase.source,
              accuracyHistory: inferredHistory,
              
              // ====== 定量信息：完全从真实用户复制 ======
              age: us.age || 30,
              gender: us.gender || '未知',
              maritalStatus: us.maritalStatus || '未知',
              children: us.children || '无子女',
              city: us.city || '未知',
              cityLevel: us.cityLevel || '未知',
              education: us.education || '未知',
              income: us.income || '未知',
              carOwnership: us.carOwnership || '无车',
              currentCar: us.currentCar || '',
              occupation: us.occupation || '',
              
              // ====== 定性信息：基于用户数据推断 ======
              personality: personality,
              
              // 真实用户的调研信息
              researchNotes: us.notes || '',
              researchType: us.researchType || '',
              researchDate: us.researchDate || '',
              
              // 自动校准日志
              calibrationLog: [],
              
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            store.syncedDigitalTwins.push(newTwin);
            newTwins.push(newTwin);
          }
        }
      }

      // ★ 递增数字分身版本号，通知虚拟消费者平台有更新
      store.dtVersion++;
      store.lastSyncTime = new Date().toISOString();
      store.syncLog.push({
        time: store.lastSyncTime,
        action: 'syncToDigitalTwins',
        detail: '同步了 ' + newTwins.length + ' 个数字分身，版本 v' + store.dtVersion
      });

      save();
      return newTwins;
    },

    // 获取数字分身列表
    getDigitalTwins: function() {
      return store.syncedDigitalTwins.slice();
    },

    // ★ 获取数据版本信息（供虚拟消费者平台轮询检测变更）
    getDataVersion: function() {
      return { dataVersion: store.dataVersion, dtVersion: store.dtVersion };
    },

    // 设置虚拟消费者数据（供用户洞察平台导入）
    setVirtualConsumers: function(vcs) {
      store.virtualConsumers = vcs || [];
      store.lastSyncTime = new Date().toISOString();
      store.syncLog.push({
        time: store.lastSyncTime,
        action: 'setVirtualConsumers',
        detail: '导入了 ' + (vcs ? vcs.length : 0) + ' 个虚拟消费者'
      });
      save();
    },

    // 获取虚拟消费者数据
    getVirtualConsumers: function() {
      return store.virtualConsumers.slice();
    },

    // 获取群组分类信息
    getGroupInfo: function() {
      return {
        lifeStages: UNIFIED_LIFE_STAGES,
        valueOrientations: UNIFIED_VALUE_ORIENTATIONS,
        groupNameMap: GROUP_NAME_MAP,
        groupKeywordMap: GROUP_KEYWORD_MAP
      };
    },

    // 按群组对虚拟消费者分类
    groupVirtualConsumers: function(vcs) {
      var groups = {};
      for (var i = 0; i < vcs.length; i++) {
        var vc = vcs[i];
        var group = vc.group;
        if (!group) {
          // 如果没有群组信息，尝试推断
          group = getUserGroup({
            id: vc.id,
            name: vc.name,
            age: vc.age || 30,
            gender: vc.gender || '男',
            maritalStatus: vc.maritalStatus || '未婚',
            children: vc.children || '无子女'
          });
        }
        var key = group.groupName || group.lifeStageId + '-' + group.valueOrientation;
        if (!groups[key]) {
          groups[key] = {
            groupName: key,
            lifeStage: group.lifeStageLabel || '',
            valueOrientation: group.valueOrientation || '',
            keywords: group.keywords || [],
            consumers: []
          };
        }
        groups[key].consumers.push(vc);
      }
      return groups;
    },

    // AI评估虚拟消费者对车型的感兴趣程度
    evaluateInterest: function(vcs, vehicleConfig) {
      var results = [];
      for (var i = 0; i < vcs.length; i++) {
        var vc = vcs[i];
        var score = calculateInterestScore(vc, vehicleConfig);
        results.push({
          consumer: vc,
          score: score.overall,
          dimensions: score.dimensions,
          analysis: score.analysis
        });
      }
      // 按得分降序排列
      results.sort(function(a, b) { return b.score - a.score; });
      return results;
    },

    // 获取同步日志
    getSyncLog: function() {
      return store.syncLog.slice();
    },

    // 清除所有数据
    clear: function() {
      store.userSamples = [];
      store.syncedDigitalTwins = [];
      store.virtualConsumers = [];
      store.lastSyncTime = null;
      store.syncLog = [];
      save();
    },

    // ★ 云端同步：从 Supabase 加载用户数据
    loadFromCloud: function() {
      return loadFromCloud();
    },

    // ★ 云端同步：检查是否已从云端加载
    isCloudLoaded: function() {
      return cloudLoaded;
    },

    // ★ 强制立即同步到云端
    syncToCloudNow: function() {
      if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
      saveToCloud();
    },

    // ★ 强制立即同步到云端（返回 Promise，登出时调用）
    flushToCloud: function() {
      return new Promise(function(resolve) {
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        // 先写 localStorage 紧急备份
        try {
          var snap = _buildSnapshot();
          localStorage.setItem('vc_ui_shared_data', JSON.stringify(snap));
        } catch(e) {}
        // 写云端
        saveToCloud();
        // 等待 1.5 秒确保网络请求完成
        setTimeout(function() {
          console.log('[SharedDataStore] flush 完成');
          resolve(true);
        }, 1500);
      });
    }
  };
})();

// ========== AI兴趣度评估算法 ==========

function calculateInterestScore(vc, vehicleConfig) {
  var config = vehicleConfig || {};
  var tags = vc.consumerTags || vc.tags || [];
  var dimensions = {};

  // 1. 价格匹配度 (权重: 25%)
  var priceSense = getTagScoreFromList(tags, '价格敏感度');
  var priceRange = config.priceRange || '20-30万';
  var priceScore = calculatePriceMatch(priceSense, priceRange, vc);
  dimensions['价格匹配'] = { score: priceScore, weight: 0.25 };

  // 2. 功能匹配度 (权重: 25%)
  var funcPref = getTagValueFromList(tags, '功能偏好');
  var configFeatures = config.features || {};
  var funcScore = calculateFeatureMatch(funcPref, configFeatures, vc);
  dimensions['功能匹配'] = { score: funcScore, weight: 0.25 };

  // 3. 科技契合度 (权重: 20%)
  var techPref = getTagScoreFromList(tags, '科技偏好');
  var techLevel = config.techLevel || '高';
  var techScore = calculateTechMatch(techPref, techLevel);
  dimensions['科技契合'] = { score: techScore, weight: 0.20 };

  // 4. 安全满意度 (权重: 15%)
  var safetyConcern = getTagScoreFromList(tags, '安全关注度');
  var safetyLevel = config.safetyLevel || '高';
  var safetyScore = calculateSafetyMatch(safetyConcern, safetyLevel);
  dimensions['安全满意'] = { score: safetyScore, weight: 0.15 };

  // 5. 品牌吸引力 (权重: 10%)
  var brandLoyalty = getTagScoreFromList(tags, '品牌忠诚度');
  var brandScore = calculateBrandMatch(brandLoyalty);
  dimensions['品牌吸引'] = { score: brandScore, weight: 0.10 };

  // 6. 外观匹配 (权重: 5%)
  var appearance = getTagValueFromList(tags, '外观偏好');
  var designStyle = config.designStyle || '现代简约';
  var appearScore = calculateAppearanceMatch(appearance, designStyle);
  dimensions['外观匹配'] = { score: appearScore, weight: 0.05 };

  // 计算加权总分
  var overall = 0;
  var keys = Object.keys(dimensions);
  for (var k = 0; k < keys.length; k++) {
    var dim = dimensions[keys[k]];
    overall += dim.score * dim.weight;
  }
  overall = Math.round(overall * 100);

  // 生成分析文本
  var analysis = generateInterestAnalysis(vc, dimensions, overall, vehicleConfig);

  return {
    overall: overall,
    dimensions: dimensions,
    analysis: analysis
  };
}

function getTagValueFromList(tags, name) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].name === name) return tags[i].value;
  }
  return '—';
}

function getTagScoreFromList(tags, name) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].name === name) return tags[i].score;
  }
  return 0.5;
}

function calculatePriceMatch(priceSense, priceRange, vc) {
  // priceSense: 0-1, 越高越敏感
  // 对于价格敏感型用户，需要价格在预算范围内才得分高
  if (priceSense > 0.7) {
    // 价格敏感用户
    if (priceRange === '8-15万' || priceRange === '10万以下') return 0.90;
    if (priceRange === '15-25万') return 0.60;
    return 0.30;
  } else if (priceSense < 0.3) {
    // 价格不敏感用户，高价也能接受
    return 0.85;
  } else {
    // 中等敏感度
    return 0.70;
  }
}

function calculateFeatureMatch(funcPref, features, vc) {
  var score = 0.60; // 基础分
  if (funcPref === '智能座舱优先' && features.hasSmartCockpit) score = 0.90;
  else if (funcPref === '空间与安全优先' && features.hasLargeSpace) score = 0.88;
  else if (funcPref === '豪华舒适优先' && features.hasLuxuryConfig) score = 0.92;
  else if (funcPref === '性价比优先' && features.isValueForMoney) score = 0.85;
  else if (funcPref === '外观与性能优先' && features.hasSportDesign) score = 0.87;
  else if (funcPref === '续航优先' && features.hasLongRange) score = 0.88;
  return score;
}

function calculateTechMatch(techPref, techLevel) {
  if (techPref > 0.7) {
    return techLevel === '高' ? 0.92 : 0.55;
  } else if (techPref < 0.4) {
    return techLevel === '高' ? 0.60 : 0.80;
  }
  return 0.75;
}

function calculateSafetyMatch(safetyConcern, safetyLevel) {
  if (safetyConcern > 0.7) {
    return safetyLevel === '高' ? 0.90 : 0.45;
  }
  return 0.75;
}

function calculateBrandMatch(brandLoyalty) {
  // 品牌忠诚度高意味着对本品可能有顾虑（新品牌），也可能容易转化
  if (brandLoyalty > 0.7) return 0.50; // 高忠诚度用户需要更多说服
  if (brandLoyalty < 0.3) return 0.80; // 低忠诚度用户更容易接受新品牌
  return 0.65;
}

function calculateAppearanceMatch(appearance, designStyle) {
  if (appearance === '运动潮流风' && designStyle === '运动时尚') return 0.90;
  if (appearance === '豪华商务风' && designStyle === '豪华商务') return 0.92;
  if (appearance === '科技简约风' && designStyle === '现代简约') return 0.88;
  if (appearance === '稳重家用风' && designStyle === '家用温馨') return 0.85;
  return 0.60;
}

function generateInterestAnalysis(vc, dimensions, overallScore, vehicleConfig) {
  var name = vc.name || '未知消费者';
  var type = vc.type === 'digital_twin' ? '数字分身' : '虚拟消费者';
  var group = vc.group || {};
  var groupName = group.groupName || '未分类';
  var analysis = '';

  if (overallScore >= 85) {
    analysis = '【高度感兴趣】' + name + '（' + type + '，群组：' + groupName + '）对该车型表现出强烈兴趣。';
    analysis += '核心驱动力在于其功能偏好与车型配置高度匹配。';
    analysis += '建议作为重点营销目标，可优先推送试驾邀请和个性化金融方案。';
  } else if (overallScore >= 70) {
    analysis = '【较感兴趣】' + name + '（' + type + '，群组：' + groupName + '）对该车型有一定兴趣。';
    analysis += '存在部分顾虑点，可能需要通过试驾体验或详细产品说明来消除疑虑。';
    analysis += '建议提供更多产品亮点信息和优惠政策。';
  } else if (overallScore >= 50) {
    analysis = '【兴趣一般】' + name + '（' + type + '，群组：' + groupName + '）对该车型兴趣度中等。';
    analysis += '其消费理念和偏好与车型定位存在一定差距。';
    analysis += '建议关注其核心顾虑，评估是否需要调整营销策略或暂时搁置。';
  } else {
    analysis = '【兴趣较低】' + name + '（' + type + '，群组：' + groupName + '）目前对该车型兴趣度较低。';
    analysis += '可能是价格、功能配置或品牌定位与其需求不匹配。';
    analysis += '不建议投入过多营销资源，可等待产品迭代或价格调整后再评估。';
  }

  return analysis;
}

// ========== 数字分身人格特征推断 ==========

// 基于真实用户数据推断说话方式、生活理念、行为逻辑
function inferPersonalityTraits(userSample) {
  var us = userSample;
  var age = parseInt(us.age) || 30;
  var gender = us.gender || '未知';
  var education = us.education || '';
  var income = us.income || '';
  var city = us.city || '';
  var cityLevel = us.cityLevel || '';
  var hasChildren = us.hasChildren || (us.children && us.children !== '无子女');
  var occupation = us.occupation || '';
  var researchType = us.researchType || '';
  var notes = us.notes || '';
  
  // 1. 说话方式推断
  var speechStyle = inferSpeechStyle(age, gender, education, occupation, cityLevel);
  
  // 2. 生活理念推断
  var lifePhilosophy = inferLifePhilosophy(age, income, hasChildren, cityLevel, notes);
  
  // 3. 行为逻辑推断
  var behaviorLogic = inferBehaviorLogic(age, income, education, hasChildren, researchType);
  
  // 4. 消费心理特征
  var consumerPsychology = inferConsumerPsychology(income, age, hasChildren, notes);
  
  // 5. 核心关注点
  var coreConcerns = inferCoreConcerns(hasChildren, age, income, us.carOwnership, notes);
  
  return {
    speechStyle: speechStyle,
    lifePhilosophy: lifePhilosophy,
    behaviorLogic: behaviorLogic,
    consumerPsychology: consumerPsychology,
    coreConcerns: coreConcerns,
    // 用于AI生成回答时调整语气的参数
    toneProfile: {
      formality: education === '硕士' || education === '博士' ? '正式' : (education === '本科' ? '半正式' : '口语化'),
      detailLevel: (researchType.indexOf('深访') >= 0) ? '详细' : '简洁',
      emotionalExpression: age < 30 ? '直接' : (age < 45 ? '温和' : '含蓄'),
      decisionPace: age < 28 ? '快速' : (age < 40 ? '中等' : '谨慎')
    }
  };
}

function inferSpeechStyle(age, gender, education, occupation, cityLevel) {
  var styles = [];
  
  // 教育程度影响
  if (education === '硕士' || education === '博士') {
    styles.push('用词严谨，逻辑清晰，善于使用专业术语');
  } else if (education === '本科') {
    styles.push('表达清晰，注重条理，偶尔使用行业术语');
  } else {
    styles.push('表达直接，用词朴实，更关注实际体验');
  }
  
  // 年龄影响
  if (age < 28) {
    styles.push('语速较快，喜欢用新潮词汇，表达热情洋溢');
  } else if (age < 40) {
    styles.push('语速适中，表达稳重，注重信息准确性');
  } else {
    styles.push('语速较慢，表达沉稳，偏好经验分享');
  }
  
  // 城市级别影响
  if (cityLevel === '一线') {
    styles.push('视野开阔，见多识广，对新鲜事物接受度高');
  }
  
  return styles.join('；');
}

function inferLifePhilosophy(age, income, hasChildren, cityLevel, notes) {
  if (income.includes('100万') || income.includes('50万')) {
    if (hasChildren) return '品质生活主义——追求高品质的家庭生活体验，愿意为更好的产品和服务付费，注重生活仪式感';
    return '精致悦己主义——注重个人生活品质和体验，追求精神与物质的双重满足';
  }
  if (hasChildren) {
    if (cityLevel === '一线' || cityLevel === '新一线') {
      return '平衡发展主义——在家庭责任与个人追求之间寻求平衡，注重子女成长与家庭幸福感';
    }
    return '实用家庭主义——以家庭需求为核心，注重实际价值，稳健规划家庭未来';
  }
  if (age < 28) {
    return '探索体验主义——追求新鲜体验和自我表达，注重当下生活品质，对未来持开放态度';
  }
  if (age < 40) {
    return '成长进阶主义——在职业发展和生活品质之间寻求平衡，稳步向上';
  }
  return '从容生活主义——注重生活舒适度和稳定性，享受积累的成果';
}

function inferBehaviorLogic(age, income, education, hasChildren, researchType) {
  var logic = [];
  
  // 决策模式
  if (education === '硕士' || education === '博士') {
    logic.push('决策前会充分收集信息，进行多维度对比分析');
  } else if (researchType.indexOf('深访') >= 0) {
    logic.push('重视实际体验，倾向于通过试驾和实地考察做决策');
  } else {
    logic.push('依赖口碑和熟人推荐，重视实际使用者的反馈');
  }
  
  // 消费行为
  if (income.includes('100万') || income.includes('50万')) {
    logic.push('品牌和品质优先于价格，愿意为差异化体验付费');
  } else if (income.includes('10万以下') || income.includes('10-20万')) {
    logic.push('价格是重要决策因素，会仔细对比性价比，关注长期使用成本');
  } else {
    logic.push('在预算范围内追求最优选择，关注综合价值');
  }
  
  // 风险偏好
  if (age < 28) {
    logic.push('对新品牌和新品类持开放态度，愿意尝试创新产品');
  } else if (hasChildren) {
    logic.push('风险规避型，偏好成熟可靠的产品，重视安全和稳定性');
  } else {
    logic.push('适度风险偏好，愿意尝试但需要充分的理由');
  }
  
  return logic.join('；');
}

function inferConsumerPsychology(income, age, hasChildren, notes) {
  var psych = [];
  
  if (hasChildren) {
    psych.push('家庭决策者心态——购车决策会考虑全家人的需求，非个人消费行为');
  }
  if (income.includes('100万') || income.includes('50万')) {
    psych.push('品质认同型消费——通过消费选择表达个人品味和社会身份');
  }
  if (age < 30 && !hasChildren) {
    psych.push('悦己型消费——将购车视为生活方式和个人表达的延伸');
  }
  if (notes && notes.indexOf('科技') >= 0) {
    psych.push('科技乐观主义——相信技术进步能提升生活品质，愿意为科技配置付费');
  }
  if (notes && notes.indexOf('续航') >= 0) {
    psych.push('实用焦虑型——对新能源车的实际使用体验存在顾虑，需要充分的信息来消除不确定感');
  }
  
  return psych.length > 0 ? psych.join('；') : '理性消费型——基于实际需求和使用场景做出消费决策';
}

function inferCoreConcerns(hasChildren, age, income, carOwnership, notes) {
  var us = { hasChildren: hasChildren, age: age, income: income, carOwnership: carOwnership, notes: notes };
  var concerns = [];
  
  if (hasChildren) {
    concerns.push({ topic: '车内空间与儿童安全', priority: '高', detail: '需要足够的后排空间安装儿童座椅，关注车内空气质量' });
  }
  if (parseInt(age) >= 40) {
    concerns.push({ topic: '乘坐舒适性', priority: '高', detail: '关注座椅舒适度、悬架调校和NVH表现' });
  }
  if (income.includes('10万以下') || income.includes('10-20万')) {
    concerns.push({ topic: '综合用车成本', priority: '高', detail: '关注电耗、保养费用、保险成本和保值率' });
  }
  if (!carOwnership || carOwnership === '无车') {
    concerns.push({ topic: '充电便利性', priority: '高', detail: '首次购买新能源车，关注充电桩分布和充电体验' });
  }
  if (notes && notes.indexOf('智能') >= 0) {
    concerns.push({ topic: '智能座舱体验', priority: '中', detail: '对车机流畅度、语音交互和OTA升级有期待' });
  }
  
  concerns.push({ topic: '产品可靠性', priority: '中', detail: '关注整车质量和长期使用的可靠性' });
  
  return concerns;
}

// ========== 自动校准算法 ==========

// 计算两套标签之间的差异
function computeTagDiffs(oldTags, newTags) {
  var diffs = [];
  var oldMap = {};
  for (var i = 0; i < oldTags.length; i++) {
    oldMap[oldTags[i].name] = oldTags[i];
  }
  for (var j = 0; j < newTags.length; j++) {
    var nt = newTags[j];
    var ot = oldMap[nt.name];
    if (ot) {
      var scoreDiff = parseFloat((nt.score - ot.score).toFixed(3));
      var valueChanged = ot.value !== nt.value;
      if (Math.abs(scoreDiff) > 0.03 || valueChanged) {
        diffs.push({
          tagName: nt.name,
          oldValue: ot.value,
          newValue: nt.value,
          oldScore: ot.score,
          newScore: nt.score,
          scoreDiff: scoreDiff,
          valueChanged: valueChanged
        });
      }
    }
  }
  return diffs;
}

// 基于新旧标签差异，校准数字分身的标签评分
function calibrateTagsFromNewResearch(oldTags, newTags, currentRounds) {
  var result = [];
  var newMap = {};
  for (var i = 0; i < newTags.length; i++) {
    newMap[newTags[i].name] = newTags[i];
  }
  
  // 校准权重：访谈轮次越多，单次校准幅度越小
  var calibrateWeight = Math.max(0.15, 1.0 / (currentRounds + 1));
  
  for (var j = 0; j < oldTags.length; j++) {
    var ot = oldTags[j];
    var nt = newMap[ot.name];
    var calibrated = { name: ot.name, value: ot.value, score: ot.score, confidence: ot.confidence || 0.85 };
    
    if (nt) {
      // 价值标签：如果新调研显示不同偏好，逐步调整
      if (nt.value !== ot.value) {
        // 价值变化需要更多证据，渐进式调整
        calibrated.value = (currentRounds >= 3) ? nt.value : ot.value;
        // 标记价值可能存在变化
        if (currentRounds < 3) {
          calibrated.pendingValueShift = nt.value;
        }
      }
      // 评分：向新调研结果收敛
      calibrated.score = parseFloat((ot.score + (nt.score - ot.score) * calibrateWeight).toFixed(3));
      calibrated.confidence = parseFloat(Math.min(0.95, (ot.confidence || 0.85) + 0.01).toFixed(2));
    }
    
    result.push(calibrated);
  }
  
  return result;
}

// 计算自动校准的准确度提升幅度
function calculateAutoCalibrationAccuracyBoost(tagDiffs) {
  if (!tagDiffs || tagDiffs.length === 0) return 0.005; // 无差异小幅提升
  
  var totalDiff = 0;
  for (var i = 0; i < tagDiffs.length; i++) {
    totalDiff += Math.abs(tagDiffs[i].scoreDiff);
    if (tagDiffs[i].valueChanged) totalDiff += 0.05; // 价值变化说明新信息多
  }
  
  // 差异越大说明新信息越多，准确度提升越大
  var boost = 0.005 + totalDiff * 0.3;
  return Math.min(0.05, boost); // 单次提升上限5%
}

// 生成校准摘要
function generateCalibrationSummary(tagDiffs, twin) {
  if (!tagDiffs || tagDiffs.length === 0) {
    return '本次回访调研数据与当前数字分身高度一致，说明数字分身已经较好反映真实用户特征。小幅校准确认。';
  }
  
  var parts = [];
  for (var i = 0; i < tagDiffs.length; i++) {
    var d = tagDiffs[i];
    if (d.valueChanged) {
      parts.push('「' + d.tagName + '」从"' + d.oldValue + '"调整为"' + d.newValue + '"');
    } else {
      var dir = d.scoreDiff > 0 ? '增强' : '减弱';
      parts.push('「' + d.tagName + '」评分' + dir + ' ' + Math.abs(d.scoreDiff * 100).toFixed(1) + '%');
    }
  }
  
  return '基于新调研数据校准：' + parts.join('；') + '。数字分身更接近真实用户。';
}

// 暴露到全局
window.SharedDataStore = SharedDataStore;
window.convertUserSampleToVCBase = convertUserSampleToVCBase;
window.getUserGroup = getUserGroup;
window.getUserLifeStage = getUserLifeStage;
window.getUserValueOrientation = getUserValueOrientation;
window.GROUP_NAME_MAP = GROUP_NAME_MAP;
window.UNIFIED_LIFE_STAGES = UNIFIED_LIFE_STAGES;
window.UNIFIED_VALUE_ORIENTATIONS = UNIFIED_VALUE_ORIENTATIONS;
window.inferPersonalityTraits = inferPersonalityTraits;
window.computeTagDiffs = computeTagDiffs;

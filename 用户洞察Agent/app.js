console.log('app.js 已加载');

// 全局错误捕获，用于定位问题
window.addEventListener('error', function(e) {
  console.error('全局错误:', e.message, '在', e.filename, '第', e.lineno, '行');
});

// 生成用户唯一识别码
function generateUniqueCode() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `USR-${dateStr}-${random}`;
}

// Toast 提示工具
function showToast(msg, type) {
  type = type || 'info';
  var existing = document.getElementById('globalToast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.id = 'globalToast';
  var bgColor = type === 'success' ? '#34d399' : type === 'error' ? '#fb4d6d' : type === 'warning' ? '#f59e0b' : '#3b82f6';
  toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:' + bgColor + ';color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;z-index:10000;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:fadeInDown 0.3s ease;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 2500);
}

const outlineDefaults = [
  "开场确认：家庭结构、当前车辆、日常出行半径、是否有固定车位。",
  "购车动机：为什么考虑纯电SUV，当前车辆有哪些无法满足的地方。",
  "核心需求：空间、续航、补能、智能座舱、智驾、安全、价格的优先级排序。",
  "真实场景：通勤、接送孩子、周末出游、长途返乡、冬季用车的具体经历。",
  "本品评价：对外观、空间、座舱交互、续航可信度、品牌服务的看法。",
  "竞品对比：为什么关注竞品B/C，哪些优势会影响最终选择。",
  "成交阻力：预算、金融方案、保值率、家人意见、售后与补能顾虑。",
  "收尾验证：一句话描述理想车型，确认最能打动用户的营销表达。"
];

const transcriptLines = [];


const questionState = [];


const personaData = [];


const competitorData = [];


const strategies = [];


const knowledgeItems = [];


// ★ 从云端/本地恢复数据（由 index.html 守卫在 app.js 加载前预加载）
//    守卫在 <head> 中异步加载，到此处（<body> 底部）通常已完成
//    如果尚未完成，app.js 启动后延迟加载
var _restored = window._restoredInsightData;

// ★★★ 先声明核心变量，再赋初值 —— 避免 TDZ 死区 ★★★
let userSamples, researchSessions;

// 初始赋值
userSamples = (_restored && _restored.userSamples) ? _restored.userSamples : [];
researchSessions = (_restored && _restored.researchSessions) ? _restored.researchSessions : [];
if (_restored) console.log('[数据恢复] userSamples: ' + userSamples.length + ' 条, researchSessions: ' + researchSessions.length + ' 场');

// 如果守卫尚未完成数据加载，延迟重试（最多等待 5 秒）
if (!_restored && window.SUPABASE_READY) {
  var _retryCount = 0;
  var _retryMax = 10;  // 10次 × 500ms = 5秒
  var _retryInterval = setInterval(function() {
    _retryCount++;
    if (window._restoredInsightData) {
      clearInterval(_retryInterval);
      var d = window._restoredInsightData;
      userSamples = (d.userSamples) ? d.userSamples : [];
      researchSessions = (d.researchSessions) ? d.researchSessions : [];
      console.log('[延迟恢复] userSamples: ' + userSamples.length + ' 条, researchSessions: ' + researchSessions.length + ' 场');
      // 恢复后刷新 UI
      if (typeof renderSessionFilters === 'function') renderSessionFilters();
      if (typeof renderSessions === 'function') renderSessions();
      if (typeof renderAudienceAvatars === 'function') renderAudienceAvatars();
    } else if (window._dataRestored || _retryCount >= _retryMax) {
      // 守卫已完成但无数据，或超时
      clearInterval(_retryInterval);
      if (!window._restoredInsightData) {
        console.log('[数据恢复] 未找到历史数据，使用空数据启动');
      }
    }
  }, 500);
}

// ★ 如果浏览器有 localStorage 备份但 _restored 为空（极端情况），主动从 localStorage 恢复
if (!_restored && !window.SUPABASE_READY) {
  try {
    var _lsBackup = localStorage.getItem('vc_insight_backup');
    if (_lsBackup) {
      var _parsed = JSON.parse(_lsBackup);
      userSamples = _parsed.userSamples || [];
      researchSessions = _parsed.researchSessions || [];
      console.log('[数据恢复] 从 localStorage 恢复 (离线模式): ' + researchSessions.length + ' 场次, ' + userSamples.length + ' 样本');
    }
  } catch(e) {}
}

// ★ 获取已完成调研的用户样本（只返回所属调研状态为"已完成"的用户）
function getCompletedUserSamples() {
  if (!userSamples || userSamples.length === 0) return [];
  
  // 构建已完成调研场次ID集合
  var completedSessionIds = {};
  for (var i = 0; i < researchSessions.length; i++) {
    if (researchSessions[i].status === '已完成') {
      completedSessionIds[researchSessions[i].id] = true;
    }
  }
  
  // 过滤：只有所属调研已完成的用户才能进入样本库
  return userSamples.filter(function(user) {
    return completedSessionIds[user.sessionId];
  });
}

// ★ 自动同步：将已完成调研的用户样本推送到共享数据桥（即用户样本库）
//    规则：只有所属调研场次状态为"已完成"的用户数据才会进入样本库
//    用户登录后可自行创建调研场次和用户样本
function autoSyncUserSamplesToBridge() {
  if (typeof SharedDataStore === 'undefined') {
    console.warn('[自动同步] SharedDataStore 未加载，跳过同步');
    return;
  }
  if (!userSamples || userSamples.length === 0) return;
  
  // 只同步已完成调研的用户 → 这些才是"用户样本库"中的真实用户
  var completedSamples = getCompletedUserSamples();
  if (completedSamples.length === 0) {
    console.log('[自动同步] 没有已完成调研的用户，跳过同步');
    return;
  }
  
  var skippedCount = userSamples.length - completedSamples.length;
  var result = SharedDataStore.pushUserSamples(completedSamples);
  console.log('[自动同步] 已推送 ' + completedSamples.length + ' 个已完成调研的用户样本 → SharedDataStore (新增 ' + result.added + ', 更新 ' + result.updated + ')' +
    (skippedCount > 0 ? '，跳过 ' + skippedCount + ' 个未完成调研的用户' : ''));
  
  // 同时触发数字分身同步（数字分身与样本库中的真实用户一一对应）
  var twins = SharedDataStore.syncToDigitalTwins();
  console.log('[自动同步] 已生成/更新 ' + twins.length + ' 个数字分身');
}

// ★ 调研结束后手动触发同步（可通过重置按钮或调试调用）
window.triggerManualSync = function() {
  autoSyncUserSamplesToBridge();
  var log = SharedDataStore ? SharedDataStore.getSyncLog() : [];
  var completedCount = getCompletedUserSamples().length;
  console.log('[手动同步] 完成。同步日志：', log);
  alert('已同步 ' + completedCount + ' 个已完成调研的用户样本到共享数据桥！\n虚拟消费者平台将自动检测并生成对应数字分身。');
};

// researchSessions 已在数据恢复段（约第66行）通过 let/赋值初始化，此处不再重复声明


let transcriptIndex = 0;
let isRecording = false;
let progress = 42;
let secondsLeft = 23 * 60 + 40;
let timerId = null;
let fullTranscriptLines = [];
let currentSession = null;
let pendingSessionStarted = false;
let openSessions = []; // 定性调研打开的会话
let activeSessionId = null; // 当前激活的定性调研ID
let openQuantSessions = []; // 定量调研打开的会话
let activeQuantSessionId = null; // 当前激活的定量调研ID
let currentSurvey = null; // 当前编辑的问卷
let questionCounter = 0; // 问题计数器
// 摄像头/麦克风状态
let cameraStream = null;        // MediaStream 对象（含视频+音频轨道）
let audioContext = null;        // AudioContext 用于音浪可视化
let audioAnalyser = null;       // AnalyserNode
let audioDataArray = null;      // 音频频域数据
let audioAnimId = null;         // requestAnimationFrame ID
let isCameraActive = false;     // 摄像头是否已开启

// MediaRecorder 录制状态
let mediaRecorder = null;          // MediaRecorder 实例（视频+音频合并流）
let audioRecorder = null;          // 纯音频 MediaRecorder 实例
let recordedVideoChunks = [];      // 视频 Blob 片段
let recordedAudioChunks = [];      // 音频 Blob 片段
let recordingStartTime = null;     // 录制开始时间戳（毫秒）
let recordingElapsedId = null;     // 录制计时器 interval ID
let storageDirHandle = null;       // FileSystemDirectoryHandle（用户选择的存储目录）

// ===== AI 实时分析状态 =====
let aiEnabled = false;                // AI 分析总开关
let currentSpeaker = '用户';           // 当前说话人角色：'用户' | '主持人'
let autoDetectSpeaker = false;         // LLM 自动识别说话人（需要 API Key）
let aiConfig = {                      // LLM API 配置
  provider: 'openai',
  apiKey: '',
  customUrl: '',
  modelName: 'gpt-4o'
};
let speechRecognition = null;         // SpeechRecognition 实例
let isSpeechListening = false;        // 是否正在监听语音
let speechRestartTimer = null;        // 语音识别重启定时器
let pendingAnalysisTexts = [];        // 待分析文本缓冲区
let lastEmotionTexts = '';            // 上次已分析的文本（去重）
let emotionHistory = [];              // 情绪历史记录
let analysisIntervalId = null;        // 分析轮询定时器
let faceCaptureIntervalId = null;     // 表情抓帧定时器
let lastFaceBase64 = null;            // 上一帧截图 base64

// 调研准备锁定状态
let preparationLocked = false;  // 是否已锁定准备
let lockPassword = '';          // 生成的数字密码

// 调研对象详细信息数据结构
const audienceDetailsTemplate = {
  name: "",
  gender: "",
  age: "",
  maritalStatus: "",
  children: "",
  city: "",
  cityLevel: "",
  education: "",
  income: "",
  carOwnership: "",
  currentCar: "",
  notes: ""
};

// 调研用户列表（支持多个用户）
let currentAudienceList = [];

// 兼容旧代码：如果只有一个用户，currentAudienceDetails 返回第一个用户
let currentAudienceDetails = { ...audienceDetailsTemplate };

const els = {
  outlineList: document.getElementById("outlineList"),
  transcriptFeed: document.getElementById("transcriptFeed"),
  fullTranscriptText: document.getElementById("fullTranscriptText"),
  transcriptStats: document.getElementById("transcriptStats"),
  questionProgress: document.getElementById("questionProgress"),
  nextSuggestion: document.getElementById("nextSuggestion"),
  emotionNote: document.getElementById("emotionNote"),
  progressMetric: document.getElementById("progressMetric"),
  progressBar: document.getElementById("progressBar"),
  timeMetric: document.getElementById("timeMetric"),
  timerLarge: document.getElementById("timerLarge"),
  liveState: document.getElementById("liveState"),
  audioStatus: document.getElementById("audioStatus"),
  videoStatus: document.getElementById("videoStatus"),
  textStatus: document.getElementById("textStatus"),
  captureBadge: document.getElementById("captureBadge"),
  recordingIndicator: document.getElementById("recordingIndicator"),
  recordingTimer: document.getElementById("recordingTimer"),
  recordStatus: document.getElementById("recordStatus"),
  captureStatus: document.querySelector(".capture-status"),
  selectStorageDirBtn: document.getElementById("selectStorageDirBtn"),
  storagePath: document.getElementById("storagePath"),
  uploadedVideo: document.getElementById("uploadedVideo"),
  uploadFileName: document.getElementById("uploadFileName"),
  sessionGroups: document.getElementById("sessionGroups"),
  sessionCount: document.getElementById("sessionCount"),
  productFilter: document.getElementById("productFilter"),
  typeFilter: document.getElementById("typeFilter"),
  sessionFilter: document.getElementById("sessionFilter"),
  researchTitle: document.getElementById("researchTitle"),
  startSessionBanner: document.getElementById("startSessionBanner"),
  startSessionBtn: document.getElementById("startSessionBtn"),
  reportVideo: document.getElementById("reportVideo"),
  reportAudio: document.getElementById("reportAudio"),
  playbackStatus: document.getElementById("playbackStatus"),
  closeSessionBtn: document.getElementById("closeSessionBtn"),
  newSessionBtn: document.getElementById("newSessionBtn"),
  newSessionModal: document.getElementById("newSessionModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelNewSessionBtn: document.getElementById("cancelNewSessionBtn"),
  newSessionForm: document.getElementById("newSessionForm"),
  // 摄像头相关
  startCameraBtn: document.getElementById("startCameraBtn"),
  stopCameraBtn: document.getElementById("stopCameraBtn"),
  cameraSelect: document.getElementById("cameraSelect"),
  cameraPreview: document.getElementById("cameraPreview"),
  cameraControls: document.getElementById("cameraControls"),
  videoFeed: document.getElementById("videoFeed"),
  audioWave: document.getElementById("audioWave"),
  faceUserA: document.getElementById("faceUserA"),
  faceModerator: document.getElementById("faceModerator"),
  // 准备锁定相关
  lockBtn: document.getElementById("lockBtn"),
  lockBtnText: document.getElementById("lockBtnText"),
  bannerTitle: document.getElementById("bannerTitle"),
  bannerDesc: document.getElementById("bannerDesc"),
  bannerEyebrow: document.getElementById("bannerEyebrow"),
  lockPasswordDisplay: document.getElementById("lockPasswordDisplay"),
  lockPasswordCode: document.getElementById("lockPasswordCode"),
  unlockModal: document.getElementById("unlockModal"),
  closeUnlockModalBtn: document.getElementById("closeUnlockModalBtn"),
  unlockPasswordInput: document.getElementById("unlockPasswordInput"),
  unlockError: document.getElementById("unlockError"),
  cancelUnlockBtn: document.getElementById("cancelUnlockBtn"),
  confirmUnlockBtn: document.getElementById("confirmUnlockBtn"),
  briefForm: document.getElementById("briefForm"),
  outlineCard: document.querySelector(".outline-card"),
  audienceSection: document.querySelector(".audience-section"),
  // 表单输入元素
  goalInput: document.getElementById("goalInput"),
  productInput: document.getElementById("productInput"),
  durationInput: document.getElementById("durationInput"),
  editOutlineBtn: document.getElementById("editOutlineBtn"),
  manageAudienceBtn: document.getElementById("manageAudienceBtn"),
  // AI 实时分析元素
  aiAnalysisPanel: document.getElementById("aiAnalysisPanel"),
  aiToggleBtn: document.getElementById("aiToggleBtn"),
  aiSettingsBtn: document.getElementById("aiSettingsBtn"),
  aiSettingsBody: document.getElementById("aiSettingsBody"),
  aiProvider: document.getElementById("aiProvider"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiCustomUrl: document.getElementById("aiCustomUrl"),
  aiCustomUrlLabel: document.getElementById("aiCustomUrlLabel"),
  aiModelName: document.getElementById("aiModelName"),
  aiSaveSettingsBtn: document.getElementById("aiSaveSettingsBtn"),
  aiTestConnBtn: document.getElementById("aiTestConnBtn"),
  aiTestResult: document.getElementById("aiTestResult"),
  aiStatusDot: document.getElementById("aiStatusDot"),
  asrStatus: document.getElementById("asrStatus"),
  asrText: document.getElementById("asrText"),
  emotionMain: document.getElementById("emotionMain"),
  emotionPos: document.getElementById("emotionPos"),
  emotionNeu: document.getElementById("emotionNeu"),
  emotionNeg: document.getElementById("emotionNeg"),
  expressionTag: document.getElementById("expressionTag"),
  expressionDetail: document.getElementById("expressionDetail"),
  speakerUserBtn: document.getElementById("speakerUserBtn"),
  speakerHostBtn: document.getElementById("speakerHostBtn")
};

function renderOutline(items = outlineDefaults) {
  els.outlineList.innerHTML = items.map((item) => `<li contenteditable="true">${item}</li>`).join("");
}

function renderQuestions() {
  els.questionProgress.innerHTML = questionState
    .map((item) => {
      const cls = item.done ? "done" : "pending";
      const label = item.done ? "已覆盖" : "待追问";
      return `<div class="question-item"><span>${item.text}</span><em class="pill ${cls}">${label}</em></div>`;
    })
    .join("");
}

function setStage(stage) {
  const target = document.querySelector(`.segment[data-stage="${stage}"]`);
  if (target?.classList.contains("hidden")) return;
  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.stage === stage);
  });
  document.querySelectorAll(".stage").forEach((panel) => panel.classList.remove("active"));
  document.getElementById(`${stage}Stage`).classList.add("active");

  // ★ 切换到准备阶段且调研进行中：刷新锁定 UI
  if (stage === "prepare" && preparationLocked && currentSession && currentSession.status === "进行中") {
    applyPreparationLockedUI();
  }
}

function setView(view) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
  var target = document.getElementById(view);
  if (target) {
    target.classList.add("active");
    console.log('[setView] ✓ 切换到: #' + view);
  } else {
    console.error('[setView] ✗ 目标面板不存在: #' + view);
  }
  updateContextVisibility();
}

function showSubNav(sessionId, sessionName, type = 'qual') {
  const containerId = type === 'quant' ? 'quantSubNavContainer' : 'qualSubNavContainer';
  const subNavId = type === 'quant' ? 'quantSubNav' : 'qualSubNav';
  
  const container = document.getElementById(containerId);
  const subNav = document.getElementById(subNavId);
  
  if (!sessionId) {
    container.style.display = "none";
    return;
  }
  
  // 使用不同的数组存储定性和定量调研
  const sessionsArray = type === 'quant' ? openQuantSessions : openSessions;
  const activeIdVar = type === 'quant' ? activeQuantSessionId : activeSessionId;
  
  // 检查该会话是否已经打开
  const existingSession = sessionsArray.find(s => s.id === sessionId);
  if (!existingSession) {
    sessionsArray.push({ id: sessionId, name: sessionName });
  }
  
  if (type === 'quant') {
    activeQuantSessionId = sessionId;
  } else {
    activeSessionId = sessionId;
  }
  
  renderSubNavTabs(type);
  container.style.display = "block";
}

function renderSubNavTabs(type = 'qual') {
  const containerId = type === 'quant' ? 'quantSubNavContainer' : 'qualSubNavContainer';
  const subNavId = type === 'quant' ? 'quantSubNav' : 'qualSubNav';
  const sessionsArray = type === 'quant' ? openQuantSessions : openSessions;
  const activeId = type === 'quant' ? activeQuantSessionId : activeSessionId;
  
  const subNav = document.getElementById(subNavId);
  
  if (sessionsArray.length === 0) {
    document.getElementById(containerId).style.display = "none";
    return;
  }
  
  subNav.innerHTML = sessionsArray.map(session => `
    <button class="sub-nav-item ${session.id === activeId ? 'active' : ''}" 
            data-session="${session.id}" 
            data-type="${type}"
            type="button">
      <span class="sub-nav-item-content">
        <span class="sub-nav-icon">⬡</span>
        ${session.name}
      </span>
      <span class="sub-nav-close" data-close-session="${session.id}" data-close-type="${type}" title="关闭此标签">×</span>
    </button>
  `).join("");
  
  // 添加点击事件 - 切换会话
  subNav.querySelectorAll(".sub-nav-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.classList.contains("sub-nav-close")) return;
      const sessionId = btn.dataset.session;
      const sessionType = btn.dataset.type;
      if (sessionType === 'quant') {
        switchToQuantSession(sessionId);
      } else {
        switchToSession(sessionId);
      }
    });
  });
  
  // 添加关闭按钮事件
  subNav.querySelectorAll(".sub-nav-close").forEach(closeBtn => {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const sessionId = closeBtn.dataset.closeSession;
      const sessionType = closeBtn.dataset.closeType;
      closeSessionTab(sessionId, sessionType);
    });
  });
}

function hideSubNav(type = 'qual') {
  const containerId = type === 'quant' ? 'quantSubNavContainer' : 'qualSubNavContainer';
  const container = document.getElementById(containerId);
  container.style.display = "none";
}

function switchToSession(sessionId) {
  const session = researchSessions.find((item) => item.id === sessionId);
  if (!session) return;
  
  currentSession = session;
  activeSessionId = sessionId;
  
  els.researchTitle.textContent = `${session.id} ${session.product}｜${session.type}`;
  document.getElementById("goalInput").value = session.goal;
  document.getElementById("productInput").value = session.product;
  document.getElementById("durationInput").value = session.duration;
  
  // 加载调研对象详细信息（如果有）
  if (session.audienceList && session.audienceList.length > 0) {
    currentAudienceList = [...session.audienceList];
  } else if (session.audienceDetails) {
    // 兼容旧数据格式
    currentAudienceList = [session.audienceDetails];
  } else {
    currentAudienceList = [];
  }
  
  // 更新当前用户详情（取第一个用户用于兼容）
  currentAudienceDetails = currentAudienceList.length > 0 ? currentAudienceList[0] : { ...audienceDetailsTemplate };
  
  // 渲染头像卡片
  renderAudienceAvatars();
  
  const footerTitle = document.querySelector(".sidebar-footer strong");
  if (footerTitle) footerTitle.textContent = `${session.id} ${session.product}`;
  
  const audienceSummary = formatAudienceSummary(currentAudienceList);
  renderOutline([
    `开场确认：核对${audienceSummary}的基本情况、购车阶段和真实用车场景。`,
    `目标聚焦：围绕"${session.goal}"拆解用户最关心的决策因素。`,
    `产品体验：收集用户对${session.product}外观、空间、座舱、智驾和补能的评价。`,
    `场景追问：结合${session.signals}继续挖掘具体经历和高价值原话。`,
    `收尾验证：确认影响用户最终选择的前三个因素和可打动用户的一句话表达。`
  ]);
  
  renderSubNavTabs();
  setView("research");
  configureSessionStages(session);
}

function closeSessionTab(sessionId) {
  // 从打开的会话列表中移除
  openSessions = openSessions.filter(s => s.id !== sessionId);
  
  // 如果关闭的是当前激活的会话
  if (sessionId === activeSessionId) {
    if (openSessions.length > 0) {
      // 切换到最后一个打开的会话
      const lastSession = openSessions[openSessions.length - 1];
      switchToSession(lastSession.id);
    } else {
      // 没有更多会话了，返回主页
      activeSessionId = null;
      currentSession = null;
      els.closeSessionBtn.classList.add("hidden");
      hideSubNav();
      setView("overview");
    }
  } else {
    // 只是刷新标签显示
    renderSubNavTabs();
  }
}

function closeSessionDetail() {
  if (activeSessionId) {
    closeSessionTab(activeSessionId);
  } else {
    currentSession = null;
    els.closeSessionBtn.classList.add("hidden");
    hideSubNav();
    setView("overview");
  }
}

function isLiveContextVisible() {
  return currentSession?.status === "进行中" || pendingSessionStarted;
}

function updateContextVisibility() {
  const researchActive = document.getElementById("research").classList.contains("active");
  document.body.classList.toggle("context-hidden", !researchActive || !isLiveContextVisible());
}

function setAvailableStages(stages, activeStage) {
  document.querySelectorAll(".segment").forEach((button) => {
    const visible = stages.includes(button.dataset.stage);
    button.classList.toggle("hidden", !visible);
  });

  document.querySelectorAll(".stage").forEach((panel) => {
    const stage = panel.id.replace("Stage", "");
    panel.classList.toggle("locked", !stages.includes(stage));
  });

  setStage(activeStage);
}

function configureSessionStages(session) {
  const status = session?.status || "待开始";
  pendingSessionStarted = false;
  els.startSessionBanner.classList.add("hidden");

  // ★ 只在切换到"待开始"或"已完成"会话时重置锁定
  //    "进行中"的会话应保持锁定，防止准备信息被私自修改
  if (status !== "进行中") {
    resetPreparationLock();
  }

  if (status === "已完成") {
    setAvailableStages(["report"], "report");
    renderReportContent();
    updateContextVisibility();
    return;
  }

  if (status === "待开始") {
    setAvailableStages(["prepare"], "prepare");
    els.startSessionBanner.classList.remove("hidden");
    updateContextVisibility();
    return;
  }

  // 进行中：三阶段均可查看，准备页保持锁定状态
  setAvailableStages(["prepare", "live", "report"], "live");
  if (preparationLocked) {
    applyPreparationLockedUI();
  }
  updateContextVisibility();
}

// ===== 调研准备锁定/解锁 =====

// 生成6位随机数字密码
function generateLockPassword() {
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// 锁定准备
function lockPreparation() {
  if (preparationLocked) return;

  // 已有密码则复用（解锁后重新锁定场景），否则生成新密码
  if (!lockPassword) {
    lockPassword = generateLockPassword();
  }
  preparationLocked = true;

  var isInProgress = currentSession && currentSession.status === "进行中";

  // 更新横幅
  els.bannerEyebrow.textContent = 'Ready to launch';
  els.bannerTitle.textContent = isInProgress ? '调研准备已锁定' : '调研准备已完成';
  els.bannerDesc.textContent = isInProgress
    ? '调研访谈进行中。如需修改准备信息，请点击解锁并输入授权密码。'
    : '点击开始后，系统将开启音视频采集、实时转写、AI主持提醒和报告生成流程。';

  // 显示密码
  els.lockPasswordCode.textContent = lockPassword;
  els.lockPasswordDisplay.classList.remove('hidden');

  // 锁定按钮变成解锁状态
  els.lockBtn.classList.add('locked');
  els.lockBtnText.textContent = '解锁';
  els.lockBtn.querySelector('svg').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="14" x2="12" y2="17" style="stroke:#34d399;stroke-width:2"/>';

  // 开始调研按钮：进行中时隐藏，否则启用
  if (isInProgress) {
    els.startSessionBtn.disabled = true;
    els.startSessionBtn.style.display = 'none';
  } else {
    els.startSessionBtn.disabled = false;
    els.startSessionBtn.style.display = '';
  }

  // 锁定表单：所有输入框不可编辑
  els.briefForm.classList.add('locked');
  els.goalInput.readOnly = true;
  els.productInput.readOnly = true;
  els.durationInput.readOnly = true;
  els.manageAudienceBtn.style.display = 'none';

  // 锁定提纲卡片
  if (els.outlineCard) els.outlineCard.classList.add('locked');
  if (els.editOutlineBtn) els.editOutlineBtn.style.display = 'none';

  // 锁定用户管理区域
  if (els.audienceSection) els.audienceSection.classList.add('locked');

  if (!isInProgress) {
    showToast('调研已锁定，密码：' + lockPassword + '（请妥善保存）', 'success');
  } else {
    showToast('准备已重新锁定', 'success');
  }
}

// 显示解锁弹窗
function showUnlockModal() {
  els.unlockPasswordInput.value = '';
  els.unlockError.classList.add('hidden');
  els.unlockModal.classList.remove('hidden');
  setTimeout(function() { els.unlockPasswordInput.focus(); }, 150);
}

// 关闭解锁弹窗
function hideUnlockModal() {
  els.unlockModal.classList.add('hidden');
}

// 验证密码并解锁
function verifyAndUnlock() {
  var input = els.unlockPasswordInput.value.trim();
  if (input !== lockPassword) {
    els.unlockError.classList.remove('hidden');
    els.unlockPasswordInput.value = '';
    els.unlockPasswordInput.focus();
    return;
  }

  // 密码正确，解锁
  doUnlock();
  hideUnlockModal();
  showToast('调研已解锁，可重新编辑', 'success');
}

// 执行解锁
function doUnlock() {
  preparationLocked = false;

  var isInProgress = currentSession && currentSession.status === "进行中";

  // 更新横幅
  els.bannerEyebrow.textContent = 'Preparation';
  els.bannerTitle.textContent = isInProgress ? '调研进行中 - 准备可编辑' : '调研准备中';
  els.bannerDesc.textContent = isInProgress
    ? '编辑完成后请重新锁定。'
    : '确认调研信息无误后，请点击锁定按钮完成准备。锁定后信息不可修改，生成数字密码供授权人员查看。';

  // 密码保持不变（下次锁定时复用）
  els.lockPasswordDisplay.classList.add('hidden');

  // 解锁按钮恢复锁定状态
  els.lockBtn.classList.remove('locked');
  els.lockBtnText.textContent = '锁定准备';
  els.lockBtn.querySelector('svg').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';

  // 开始调研按钮：进行中时隐藏，否则禁用但不隐藏
  els.startSessionBtn.disabled = true;
  if (isInProgress) {
    els.startSessionBtn.style.display = 'none';
  } else {
    els.startSessionBtn.style.display = '';
  }

  // 解锁表单
  els.briefForm.classList.remove('locked');
  els.goalInput.readOnly = false;
  els.productInput.readOnly = false;
  els.durationInput.readOnly = false;
  els.manageAudienceBtn.style.display = '';
  if (els.outlineCard) els.outlineCard.classList.remove('locked');
  if (els.editOutlineBtn) els.editOutlineBtn.style.display = '';
  if (els.audienceSection) els.audienceSection.classList.remove('locked');
}

// 重置准备锁定状态（切换会话时调用）
function resetPreparationLock() {
  preparationLocked = false;
  lockPassword = '';
  els.bannerEyebrow.textContent = 'Preparation';
  els.bannerTitle.textContent = '调研准备中';
  els.bannerDesc.textContent = '确认调研信息无误后，请点击锁定按钮完成准备。锁定后信息不可修改，生成数字密码供授权人员查看。';
  els.lockBtn.classList.remove('locked');
  els.lockBtnText.textContent = '锁定准备';
  els.lockBtn.querySelector('svg').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
  els.lockPasswordDisplay.classList.add('hidden');
  els.startSessionBtn.disabled = true;
  els.briefForm.classList.remove('locked');
  els.goalInput.readOnly = false;
  els.productInput.readOnly = false;
  els.durationInput.readOnly = false;
  els.manageAudienceBtn.style.display = '';
  if (els.outlineCard) els.outlineCard.classList.remove('locked');
  if (els.editOutlineBtn) els.editOutlineBtn.style.display = '';
  if (els.audienceSection) els.audienceSection.classList.remove('locked');
}

// ★ 刷新准备页锁定 UI（切换回准备阶段时调用，不改变密码）
function applyPreparationLockedUI() {
  if (!preparationLocked) return;

  // 横幅状态
  els.startSessionBanner.classList.remove('hidden');
  els.bannerEyebrow.textContent = 'Ready to launch';
  els.bannerTitle.textContent = '调研准备已完成';
  els.bannerDesc.textContent = '调研已进入访谈阶段。如需修改准备信息，请点击解锁并输入授权密码。';
  els.lockPasswordCode.textContent = lockPassword;
  els.lockPasswordDisplay.classList.remove('hidden');

  // 锁定按钮 → 解锁按钮
  els.lockBtn.classList.add('locked');
  els.lockBtnText.textContent = '解锁';
  els.lockBtn.querySelector('svg').innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="14" x2="12" y2="17" style="stroke:#34d399;stroke-width:2"/>';

  // 开始调研按钮隐藏（已在进行中）
  els.startSessionBtn.disabled = true;
  els.startSessionBtn.style.display = 'none';

  // 表单全部锁定
  els.briefForm.classList.add('locked');
  els.goalInput.readOnly = true;
  els.productInput.readOnly = true;
  els.durationInput.readOnly = true;
  els.manageAudienceBtn.style.display = 'none';
  if (els.outlineCard) els.outlineCard.classList.add('locked');
  if (els.editOutlineBtn) els.editOutlineBtn.style.display = 'none';
  if (els.audienceSection) els.audienceSection.classList.add('locked');
}

function fillSelect(select, values, defaultLabel) {
  select.innerHTML = [`<option value="">${defaultLabel}</option>`]
    .concat(values.map((value) => `<option value="${value}">${value}</option>`))
    .join("");
}

function renderSessionFilters() {
  fillSelect(els.productFilter, [...new Set(researchSessions.map((item) => item.product))], "全部产品");
  fillSelect(els.typeFilter, [...new Set(researchSessions.map((item) => item.type))], "全部类型");
  fillSelect(els.sessionFilter, researchSessions.map((item) => item.id), "全部场次");
}

// ===== 新建调研 =====
function generateSessionId() {
  const maxNum = researchSessions.reduce((max, s) => {
    const match = s.id && s.id.match(/^S-(\d+)$/);
    if (match) { const n = parseInt(match[1], 10); return n > max ? n : max; }
    return max;
  }, 0);
  return 'S-' + String(maxNum + 1).padStart(3, '0');
}

function showNewSessionModal() {
  // 预填默认时间
  const now = new Date();
  const tzOffset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tzOffset * 60000);
  document.getElementById('newTime').value = local.toISOString().slice(0, 16);
  els.newSessionModal.classList.remove('hidden');
}

function hideNewSessionModal() {
  els.newSessionModal.classList.add('hidden');
  els.newSessionForm.reset();
}

function handleNewSessionSubmit(e) {
  e.preventDefault();
  const product = document.getElementById('newProduct').value.trim();
  const type = document.getElementById('newType').value;
  const goal = document.getElementById('newGoal').value.trim();
  const audience = document.getElementById('newAudience').value.trim();
  const time = document.getElementById('newTime').value.replace('T', ' ');
  const host = document.getElementById('newHost').value.trim() || '用户研究组';
  const duration = document.getElementById('newDuration').value;
  const signals = document.getElementById('newSignals').value.trim() || '用户需求';

  const newSession = {
    id: generateSessionId(),
    product: product,
    type: type,
    status: '待开始',
    time: time,
    goal: goal,
    audience: audience,
    host: host,
    duration: duration,
    signals: signals
  };

  researchSessions.push(newSession);
  hideNewSessionModal();
  renderSessionFilters();
  renderSessions();
  triggerInsightSave();
  showToast('调研 "' + newSession.id + ' ' + product + '" 已创建', 'success');
}



function getFilteredSessions() {
  return researchSessions.filter((item) => {
    const productMatched = !els.productFilter.value || item.product === els.productFilter.value;
    const typeMatched = !els.typeFilter.value || item.type === els.typeFilter.value;
    const sessionMatched = !els.sessionFilter.value || item.id === els.sessionFilter.value;
    return productMatched && typeMatched && sessionMatched;
  });
}

function statusClass(status) {
  if (status === "进行中") return "running";
  if (status === "待开始") return "pending";
  return "";
}

function renderSessions() {
  const sessions = getFilteredSessions();
  els.sessionCount.textContent = String(sessions.length);
  const grouped = sessions.reduce((groups, item) => {
    const key = `${item.product} / ${item.type}`;
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});

  els.sessionGroups.innerHTML = Object.entries(grouped).map(([groupName, items]) => `
    <section class="summary-group">
      <div class="summary-group-title">
        <h3>${groupName}</h3>
        <span>${items.length}场</span>
      </div>
      <div class="summary-card-grid">
        ${items.map((item) => {
          const users = typeof userSamples !== 'undefined' ? userSamples.filter((u) => u.sessionId === item.id) : [];
          const userCount = users.length;
          const userAvatars = users.slice(0, 4).map((u, i) => {
            const initials = u.name ? u.name.charAt(0) : 'U';
            const colors = ['#3b82f6', '#22d3ee', '#34d399', '#f59e0b'];
            const color = colors[i % colors.length];
            return `<span class="session-user-avatar" style="background:${color};margin-left:${i > 0 ? '-8px' : '0'}">${initials}</span>`;
          }).join('');
          const moreCount = userCount > 4 ? `<span class="session-user-more">+${userCount - 4}</span>` : '';
          const userListHtml = users.map((u) => {
            const tags = [u.gender, `${u.age}岁`, u.city, u.maritalStatus].filter(Boolean).join(' · ');
            return `<div class="session-user-item">${u.name || u.id} (${tags})</div>`;
          }).join('');
          return `
          <div class="summary-card" data-session-id="${item.id}" role="button" tabindex="0">
            <div class="summary-card-top">
              <span class="session-no">${item.id}</span>
              <span class="session-status ${statusClass(item.status)}">${item.status}</span>
            </div>
            <h4>${item.product}</h4>
            <p>${item.goal}</p>
            <div class="summary-card-meta">
              <span>${item.type}</span>
              <span>${item.time}</span>
            </div>
            <div class="session-user-bar">
              <div class="session-user-avatars">${userAvatars}${moreCount}</div>
              <span class="session-user-count">${userCount}位用户</span>
            </div>
            <div class="session-hover" aria-hidden="true">
              <dl>
                <dt>开展时间</dt><dd>${item.time}</dd>
                <dt>调研目的</dt><dd>${item.goal}</dd>
                <dt>调研对象</dt><dd>${item.audience}</dd>
                <dt>用户列表</dt><dd class="session-user-list">${userListHtml || '暂无用户'}</dd>
                <dt>主持团队</dt><dd>${item.host}</dd>
                <dt>访谈时长</dt><dd>${item.duration}</dd>
                <dt>关键信号</dt><dd>${item.signals}</dd>
              </dl>
            </div>
          </div>
        `}).join("")}
      </div>
    </section>
  `).join("") || `<div class="summary-card"><h4>暂无匹配场次</h4><p>请调整产品、类型或场次号筛选条件。</p></div>`;

  const cards = document.querySelectorAll(".summary-card[data-session-id]");
  console.log(`找到 ${cards.length} 个调研卡片`);
  
  cards.forEach((card) => {
    console.log(`绑定点击事件到卡片: ${card.dataset.sessionId}`);
    card.addEventListener("click", (e) => {
      console.log(`点击了卡片: ${card.dataset.sessionId}`);
      e.stopPropagation();
      openSessionDetail(card.dataset.sessionId);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openSessionDetail(card.dataset.sessionId);
      }
    });
  });
}

function openSessionDetail(sessionId) {
  const session = researchSessions.find((item) => item.id === sessionId);
  if (!session) return;

  currentSession = session;
  els.researchTitle.textContent = `${session.id} ${session.product}｜${session.type}`;
  document.getElementById("goalInput").value = session.goal;
  document.getElementById("productInput").value = session.product;
  document.getElementById("durationInput").value = session.duration;
  
  // 从 userSamples 按 sessionId 加载该场次的用户
  const sessionUsers = userSamples.filter((u) => u.sessionId === sessionId);
  if (sessionUsers.length > 0) {
    currentAudienceList = sessionUsers.map((u) => ({
      uniqueCode: u.uniqueCode,
      name: u.name || u.id,
      gender: u.gender,
      age: String(u.age),
      maritalStatus: u.maritalStatus,
      children: u.children,
      city: u.city,
      cityLevel: u.cityLevel,
      education: u.education,
      income: u.income,
      carOwnership: u.carOwnership,
      currentCar: u.currentCar,
      notes: u.notes
    }));
  } else if (session.audienceList && session.audienceList.length > 0) {
    currentAudienceList = [...session.audienceList];
  } else if (session.audienceDetails) {
    currentAudienceList = [session.audienceDetails];
  } else {
    currentAudienceList = [];
  }
  
  // 更新当前用户详情（取第一个用户用于兼容）
  currentAudienceDetails = currentAudienceList.length > 0 ? currentAudienceList[0] : { ...audienceDetailsTemplate };
  
  // 渲染头像卡片
  renderAudienceAvatars();
  
  const footerTitle = document.querySelector(".sidebar-footer strong");
  if (footerTitle) footerTitle.textContent = `${session.id} ${session.product}`;
  
  const audienceSummary = formatAudienceSummary(currentAudienceList);
  renderOutline([
    `开场确认：核对${audienceSummary}的基本情况、购车阶段和真实用车场景。`,
    `目标聚焦：围绕"${session.goal}"拆解用户最关心的决策因素。`,
    `产品体验：收集用户对${session.product}外观、空间、座舱、智驾和补能的评价。`,
    `场景追问：结合${session.signals}继续挖掘具体经历和高价值原话。`,
    `收尾验证：确认影响用户最终选择的前三个因素和可打动用户的一句话表达。`
  ]);
  
  // 显示二级标签
  const shortName = `${session.id} ${session.product}`;
  showSubNav(sessionId, shortName);
  
  // 显示关闭按钮
  els.closeSessionBtn.classList.remove("hidden");
  
  setView("research");
  configureSessionStages(session);
}

function startPendingSession() {
  if (!currentSession) return;

  // ★ 自动锁定：如尚未锁定，自动生成密码并锁定准备页
  if (!preparationLocked) {
    lockPassword = generateLockPassword();
    preparationLocked = true;
    // 锁定表单 DOM（不显示 banner，由 applyPreparationLockedUI 统一处理）
    els.briefForm.classList.add('locked');
    els.goalInput.readOnly = true;
    els.productInput.readOnly = true;
    els.durationInput.readOnly = true;
    els.manageAudienceBtn.style.display = 'none';
    if (els.outlineCard) els.outlineCard.classList.add('locked');
    if (els.editOutlineBtn) els.editOutlineBtn.style.display = 'none';
    if (els.audienceSection) els.audienceSection.classList.add('locked');
  }

  pendingSessionStarted = true;
  currentSession.status = "进行中";
  // 保存用户列表到会话
  currentSession.audienceList = [...currentAudienceList];
  // ★ 自动同步：调研开始后，将用户样本推送到共享数据桥
  autoSyncUserSamplesToBridge();
  triggerInsightSave();
  els.startSessionBanner.classList.add("hidden");
  setAvailableStages(["prepare", "live", "report"], "live");
  // ★ 刷新准备页锁定 UI（密码已显示在横幅，入口按钮变成解锁）
  applyPreparationLockedUI();
  updateContextVisibility();
  updateCaptureStatus(true, document.querySelector(".video-feed").classList.contains("has-upload"));
  els.liveState.textContent = "记录中";
  if (!isRecording) {
    isRecording = true;
    document.getElementById("recordBtn").textContent = "暂停实时记录";
    addTranscriptLine();
  }
  window.clearInterval(timerId);
  timerId = window.setInterval(() => {
    secondsLeft = Math.max(0, secondsLeft - 1);
    updateTimer();
  }, 1000);
}

function updateProgress(value) {
  progress = Math.min(100, value);
  els.progressMetric.textContent = `${progress}%`;
  els.progressBar.style.width = `${progress}%`;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimer() {
  const value = formatTime(secondsLeft);
  els.timeMetric.textContent = value;
  els.timerLarge.textContent = value;
}

function updateCaptureStatus(active, uploaded = false) {
  var hasCamera = isCameraActive;
  els.audioStatus.textContent = hasCamera || active ? "音频：采集中" : "音频：待开始";
  els.videoStatus.textContent = hasCamera ? "视频：摄像头实时" : active ? "视频：采集中" : uploaded ? "视频：已上传" : "视频：待开始";
  els.textStatus.textContent = active ? "文本：同步生成中" : fullTranscriptLines.length ? "文本：已生成" : "文本：待同步";
  els.captureBadge.textContent = hasCamera ? "摄像头正在实时采集" : active ? "音频 / 视频 / 文本同步中" : uploaded ? "视频文件已接入" : "音频 / 视频待采集";
  [els.audioStatus, els.videoStatus, els.textStatus].forEach(function(node) {
    node.classList.toggle("active", (hasCamera || active) && (node === els.audioStatus || node === els.videoStatus)
      || node === els.videoStatus && (uploaded || hasCamera)
      || node === els.textStatus && (active || fullTranscriptLines.length > 0));
  });
}

function syncFullTranscript() {
  const text = fullTranscriptLines.join("\n");
  els.fullTranscriptText.value = text;
  els.transcriptStats.textContent = `${fullTranscriptLines.length}条发言 · ${text.replace(/\s/g, "").length}字`;
  if (!isRecording) {
    updateCaptureStatus(false, document.querySelector(".video-feed").classList.contains("has-upload"));
  }
}

function appendFullTranscript(item) {
  const lineNumber = String(fullTranscriptLines.length + 1).padStart(2, "0");
  fullTranscriptLines.push(`${lineNumber}. ${item.speaker}：${item.text}`);
  syncFullTranscript();
}

function addTranscriptLine() {
  const item = transcriptLines[transcriptIndex % transcriptLines.length];
  const node = document.createElement("div");
  node.className = "line";
  node.innerHTML = `<strong>${item.speaker}</strong><p>${item.text}</p><span class="tag">${item.tag}</span>`;
  els.transcriptFeed.appendChild(node);
  els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;
  appendFullTranscript(item);
  transcriptIndex += 1;

  if (transcriptIndex === 1) {
    els.nextSuggestion.textContent = "追问冬季续航是否发生在返乡、高速或低温城市，区分真实经历和听说担忧。";
    els.emotionNote.textContent = "用户谈到续航时停顿明显，担忧强度较高，建议让用户讲具体场景。";
  } else if (transcriptIndex === 3) {
    questionState[3].done = true;
    els.nextSuggestion.textContent = "进入竞品B/C对比，确认品牌信任和座舱体验哪个更影响成交。";
  } else if (transcriptIndex >= 5) {
    questionState[4].done = true;
    els.nextSuggestion.textContent = "收束到最终购买阻力：预算、家人意见、保值率和售后服务。";
  }

  renderQuestions();
  updateProgress(progress + 9);
  document.getElementById("signalMetric").textContent = String(8 + transcriptIndex);
}

// ★ 启动录制计时器（每秒更新 UI）
function startRecordingTimer() {
  recordingStartTime = Date.now();
  function tick() {
    var elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    var timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    els.recordingTimer.textContent = timeStr;
    els.recordStatus.textContent = '录制时长：' + timeStr;
  }
  tick(); // 立即显示
  recordingElapsedId = setInterval(tick, 1000);
}

// ★ 停止录制计时器
function stopRecordingTimer() {
  if (recordingElapsedId) {
    clearInterval(recordingElapsedId);
    recordingElapsedId = null;
  }
  recordingStartTime = null;
  els.recordingIndicator.style.display = 'none';
  els.recordStatus.style.display = 'none';
  if (els.captureStatus) els.captureStatus.classList.remove('recording-active');
}

// ★ 生成时间戳字符串（用于文件名）
function getTimestampString() {
  var now = new Date();
  return now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '_'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
}

async function startRecording() {
  const recordBtn = document.getElementById("recordBtn");

  if (!isRecording) {
    // ===== 开始录制 =====
    try {
      // 1. 如果尚未开启摄像头，先开启（同时获取音视频流）
      if (!isCameraActive) {
        await startCameraInternal();
      }

      // 2. 确保有媒体流可用
      if (!cameraStream) {
        showToast('无法获取摄像头/麦克风，录制失败', 'error');
        return;
      }

      // 3. 确定文件名前缀（调研编号 + 时间戳）
      var timestamp = getTimestampString();
      var filePrefix = currentSession ? currentSession.id + '_' + timestamp : 'recording_' + timestamp;

      // 4. 启动视频录制（含音频轨道的完整流）
      var videoMime = getSupportedMimeType('video');
      mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: videoMime,
        videoBitsPerSecond: 2500000  // 2.5 Mbps
      });
      recordedVideoChunks = [];

      mediaRecorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
          recordedVideoChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = function() {
        var videoBlob = new Blob(recordedVideoChunks, { type: mediaRecorder.mimeType });
        var videoExt = getExtensionFromMime(mediaRecorder.mimeType);
        saveFileToLocal(videoBlob, filePrefix + '_video.' + videoExt);
        console.log('[录制] 视频已保存: ' + filePrefix + '_video.' + videoExt + ' (' + (videoBlob.size / 1024 / 1024).toFixed(1) + 'MB)');
      };

      // 每 5 秒收集一次数据块，确保不丢数据
      mediaRecorder.start(5000);

      // 5. 启动纯音频录制（单独保存一份音频文件）
      try {
        var audioTrack = cameraStream.getAudioTracks()[0];
        if (audioTrack) {
          var audioOnlyStream = new MediaStream([audioTrack]);
          var audioMime = getSupportedMimeType('audio');
          audioRecorder = new MediaRecorder(audioOnlyStream, {
            mimeType: audioMime,
            audioBitsPerSecond: 128000
          });
          recordedAudioChunks = [];

          audioRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) {
              recordedAudioChunks.push(e.data);
            }
          };

          audioRecorder.onstop = function() {
            var audioBlob = new Blob(recordedAudioChunks, { type: audioRecorder.mimeType });
            var audioExt = getExtensionFromMime(audioRecorder.mimeType);
            saveFileToLocal(audioBlob, filePrefix + '_audio.' + audioExt);
            console.log('[录制] 音频已保存: ' + filePrefix + '_audio.' + audioExt + ' (' + (audioBlob.size / 1024 / 1024).toFixed(1) + 'MB)');
          };

          audioRecorder.start(5000);
          console.log('[录制] 纯音频录制已启动');
        }
      } catch (audioErr) {
        console.warn('[录制] 纯音频流创建失败，仅保存含音频的视频文件:', audioErr);
      }

      isRecording = true;
      recordBtn.textContent = '暂停实时记录';
      els.liveState.textContent = '录制中（视频+音频）';
      updateCaptureStatus(true, true);

      // ★ 显示录制指示灯和计时器
      els.recordingIndicator.style.display = 'flex';
      els.recordingTimer.textContent = '00:00';
      els.recordStatus.style.display = '';
      if (els.captureStatus) els.captureStatus.classList.add('recording-active');
      startRecordingTimer();

      // 6. 启动模拟转写 + 计时器
      addTranscriptLine();
      timerId = window.setInterval(function() {
        secondsLeft = Math.max(0, secondsLeft - 1);
        updateTimer();
      }, 1000);

      showToast('已开始录制，文件将保存为 ' + filePrefix + '_video / _audio', 'success');
      console.log('[录制] MediaRecorder 已启动, MIME: ' + videoMime);

    } catch (err) {
      console.error('[录制] 启动失败:', err);
      showToast('录制启动失败: ' + (err.message || '未知错误'), 'error');
    }
  } else {
    // ===== 暂停录制（停止 MediaRecorder 并保存文件） =====
    stopRecordingAndSave();
  }
}

// ★ 停止录制并保存文件
function stopRecordingAndSave() {
  isRecording = false;

  // ★ 停止录制计时器并隐藏指示灯
  stopRecordingTimer();

  var recordBtn = document.getElementById("recordBtn");
  recordBtn.textContent = '开始实时记录';
  els.liveState.textContent = isCameraActive ? '摄像头已接入' : '已暂停';

  // 停止视频录制（onstop 会触发自动保存）
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    console.log('[录制] 视频 MediaRecorder 已停止');
  }

  // 停止音频录制（onstop 会触发自动保存）
  if (audioRecorder && audioRecorder.state !== 'inactive') {
    audioRecorder.stop();
    console.log('[录制] 音频 MediaRecorder 已停止');
  }

  // 清理定时器
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }

  var hasMedia = els.videoFeed.classList.contains('has-upload') || els.videoFeed.classList.contains('has-camera');
  updateCaptureStatus(false, hasMedia);

  // ★ 录制结束后提示文件保存位置
  if (hasMedia) {
    showToast('录制已停止，视频和音频文件已保存到本地', 'success');
  }
}

// ★ 获取浏览器支持的 MIME 类型
function getSupportedMimeType(kind) {
  // 按优先顺序尝试
  if (kind === 'video') {
    var types = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  } else {
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  }
  for (var i = 0; i < types.length; i++) {
    if (MediaRecorder.isTypeSupported(types[i])) {
      return types[i];
    }
  }
  // 兜底：不指定 mimeType，让浏览器自动选择
  return kind === 'video' ? 'video/webm' : 'audio/webm';
}

// ★ 从 MIME 类型获取文件扩展名
function getExtensionFromMime(mime) {
  if (mime.indexOf('mp4') !== -1) return 'mp4';
  if (mime.indexOf('ogg') !== -1) return 'ogg';
  return 'webm';
}

// ========== 录像存储目录选择 ==========

// ★ 让用户选择本地存储目录（File System Access API）
async function selectStorageDir() {
  try {
    // 检查浏览器是否支持
    if (!window.showDirectoryPicker) {
      showToast('当前浏览器不支持目录选择，请使用 Chrome / Edge 最新版', 'warning');
      return;
    }

    var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    storageDirHandle = handle;
    els.storagePath.textContent = '✓ ' + handle.name;
    els.storagePath.title = handle.name;
    showToast('录像将保存到「' + handle.name + '」', 'success');

    // 持久化保存到 IndexedDB（按用户隔离）
    await StorageEngine.save('_storage_dir_granted', true);
    console.log('[存储目录] 已选择: ' + handle.name);
  } catch (e) {
    if (e.name === 'AbortError') return; // 用户取消
    console.error('[存储目录] 选择失败:', e);
    showToast('目录选择失败: ' + e.message, 'error');
  }
}

// ★ 检查上次是否已授权过目录（页面加载时调用）
async function restoreStorageDir() {
  if (!window.showDirectoryPicker) return;
  try {
    var result = await StorageEngine.load('_storage_dir_granted');
    if (result && result.data) {
      // 之前已授权，引导用户重新选择（handle 无法跨会话持久化，但用户可能需要重新绑定）
      els.selectStorageDirBtn.textContent = '重新选择存储目录';
      // 不自动弹窗，等用户自己点
    }
  } catch (e) {}
}

// ★ 将 Blob 写入用户选择的目录
async function writeFileToDir(blob, filename) {
  if (!storageDirHandle) return false;

  try {
    // 验证权限仍然有效
    var permission = await storageDirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      permission = await storageDirHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        console.warn('[存储目录] 权限已过期，回退到下载方式');
        storageDirHandle = null;
        els.storagePath.textContent = '⚠ 权限过期，请重新选择';
        return false;
      }
    }

    var fileHandle = await storageDirHandle.getFileHandle(filename, { create: true });
    var writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    console.log('[存储目录] 文件已写入: ' + filename + ' (' + (blob.size / 1024 / 1024).toFixed(2) + 'MB)');
    return true;
  } catch (e) {
    console.error('[存储目录] 写入失败:', e);
    return false;
  }
}

// ★ 保存 Blob 到本地文件（优先写入用户选择目录，否则触发浏览器下载）
async function saveFileToLocal(blob, filename) {
  // 如果用户选择了存储目录，优先写入
  if (storageDirHandle) {
    var written = await writeFileToDir(blob, filename);
    if (written) {
      showToast('已保存到「' + storageDirHandle.name + '」→ ' + filename, 'success');
      return;
    }
  }

  // 回退：触发浏览器下载
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放 blob URL
  setTimeout(function() {
    URL.revokeObjectURL(url);
  }, 1000);
  console.log('[保存] 文件已触发下载: ' + filename + ' (' + (blob.size / 1024 / 1024).toFixed(2) + 'MB)');
}

function handleVideoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const videoUrl = URL.createObjectURL(file);
  els.uploadedVideo.src = videoUrl;
  els.uploadedVideo.parentElement.classList.add("has-upload");
  els.uploadFileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB`;
  els.liveState.textContent = "视频已接入";
  updateCaptureStatus(isRecording, true);

  const item = {
    speaker: "系统",
    text: `已上传视频文件《${file.name}》，可用于后续音视频同步转写、情绪动作识别和完整对话文本生成。`,
    tag: "视频上传：等待AI转写"
  };
  const node = document.createElement("div");
  node.className = "line";
  node.innerHTML = `<strong>${item.speaker}</strong><p>${item.text}</p><span class="tag">${item.tag}</span>`;
  els.transcriptFeed.appendChild(node);
  els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;
  appendFullTranscript(item);

  // 语音识别始终启动，LLM 分析按需启动
  startSpeechPipeline();
  if (aiEnabled && aiConfig.apiKey) {
    startEmotionFacePipeline();
  }
}

// ===== 摄像头/麦克风实时采集 =====

// 枚举可用摄像头设备
async function enumerateCameraDevices() {
  try {
    // 先请求一次权限以获取完整设备标签
    var devices = await navigator.mediaDevices.enumerateDevices();
    var cameras = devices.filter(function(d) { return d.kind === 'videoinput'; });
    els.cameraSelect.innerHTML = cameras.map(function(cam, idx) {
      return '<option value="' + cam.deviceId + '">' + (cam.label || '摄像头 ' + (idx + 1)) + '</option>';
    }).join('');
    return cameras;
  } catch (e) {
    console.warn('枚举摄像头设备失败:', e);
    return [];
  }
}

// 启动音频可视化（音浪动画）
function startAudioVisualizer(stream) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 128;
    audioAnalyser.smoothingTimeConstant = 0.5;
    var source = audioContext.createMediaStreamSource(stream);
    source.connect(audioAnalyser);
    audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    renderAudioWave();
    console.log('[摄像头] 音频可视化已启动');
  } catch (e) {
    console.warn('[摄像头] 音频可视化启动失败（可能未授权麦克风）:', e);
  }
}

// 渲染音浪条
function renderAudioWave() {
  if (!audioAnalyser || !audioDataArray) return;
  audioAnalyser.getByteFrequencyData(audioDataArray);
  var bars = els.audioWave.querySelectorAll('span');
  if (bars.length === 0) return;
  // 取低频段数据映射到5个音浪条
  var step = Math.floor(audioDataArray.length / bars.length);
  for (var i = 0; i < bars.length; i++) {
    var val = audioDataArray[i * step] / 255; // 0~1
    var h = Math.max(4, val * 36);
    var hue = 180 + val * 90; // 青色(180) → 紫色(270)
    bars[i].style.height = h + 'px';
    bars[i].style.background = 'rgba(' + Math.floor(150 - val * 80) + ',' + Math.floor(211 - val * 50) + ',' + (238 - val * 100) + ',' + (0.4 + val * 0.55) + ')';
    bars[i].style.boxShadow = '0 0 ' + (val * 10) + 'px rgba(34,211,238,' + (0.2 + val * 0.4) + ')';
  }
  audioAnimId = requestAnimationFrame(renderAudioWave);
}

// 停止音频可视化
function stopAudioVisualizer() {
  if (audioAnimId) {
    cancelAnimationFrame(audioAnimId);
    audioAnimId = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(function() {});
  }
  audioContext = null;
  audioAnalyser = null;
  audioDataArray = null;
  // 恢复音浪条默认状态
  var bars = els.audioWave.querySelectorAll('span');
  for (var i = 0; i < bars.length; i++) {
    bars[i].style.height = '';
    bars[i].style.background = '';
    bars[i].style.boxShadow = '';
  }
}

// 开启摄像头
// ★ 内部方法：获取摄像头+麦克风流（不处理 UI），供录制自动调用
async function startCameraInternal() {
  // 枚举可用设备
  var cameras = await enumerateCameraDevices();
  if (cameras.length === 0) {
    throw new Error('未检测到可用摄像头设备');
  }

  // 如果已有流，先停止
  if (cameraStream) {
    stopCameraInternal();
  }

  var selectedDeviceId = els.cameraSelect.value;
  var constraints = {
    video: {
      deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  };

  cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  els.cameraPreview.srcObject = cameraStream;
  isCameraActive = true;

  // 更新 UI
  els.videoFeed.classList.add('has-camera');
  els.videoFeed.classList.remove('has-upload');
  els.cameraControls.style.display = 'flex';
  els.startCameraBtn.style.display = 'none';

  // 启动音频可视化
  startAudioVisualizer(cameraStream);

  console.log('[摄像头] 内部启动完成');

  // 语音识别始终自动启动（浏览器原生，无需 API Key）
  startSpeechPipeline();

  // LLM 情绪/表情分析需要开关 + API Key
  if (aiEnabled && aiConfig.apiKey) {
    startEmotionFacePipeline();
  }

  return cameraStream;
}

// 公开方法：用户手动点击"开启摄像头"
async function startCamera() {
  try {
    await startCameraInternal();

    // 自动切换到实时采集阶段
    if (currentSession) {
      setStage("live");
    }

    // 更新状态
    updateCaptureStatus(isRecording, true);
    els.liveState.textContent = isRecording ? '录制中（视频+音频）' : '摄像头已接入';

    console.log('[摄像头] 已开启');
    showToast('摄像头已开启，正在实时采集画面与声音', 'success');
  } catch (err) {
    console.error('[摄像头] 开启失败:', err);
    if (err.name === 'NotAllowedError') {
      showToast('摄像头/麦克风权限被拒绝，请在浏览器设置中允许访问', 'error');
    } else if (err.name === 'NotFoundError') {
      showToast('未检测到摄像头或麦克风设备', 'error');
    } else {
      showToast('摄像头开启失败：' + (err.message || '未知错误'), 'error');
    }
  }
}

// 内部停止方法
function stopCameraInternal() {
  // ★ 如果正在录制，先停止 MediaRecorder 并保存文件，再关闭摄像头轨道
  if (isRecording) {
    isRecording = false;
    var recordBtn = document.getElementById("recordBtn");
    if (recordBtn) recordBtn.textContent = '开始实时记录';

    // 停止视频录制（先停止，触发 onstop → 保存视频文件）
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log('[录制] 摄像头关闭前 — 视频 MediaRecorder 已停止');
    }

    // 停止音频录制
    if (audioRecorder && audioRecorder.state !== 'inactive') {
      audioRecorder.stop();
      console.log('[录制] 摄像头关闭前 — 音频 MediaRecorder 已停止');
    }

    // 清理计时器
    window.clearInterval(timerId);
    timerId = null;
    stopRecordingTimer();
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach(function(track) { track.stop(); });
    cameraStream = null;
  }
  stopAudioVisualizer();
  els.cameraPreview.srcObject = null;

  // 停止所有分析
  stopAllAnalysis();
}

// 关闭摄像头
function stopCamera() {
  stopCameraInternal();
  isCameraActive = false;

  els.videoFeed.classList.remove('has-camera');
  els.cameraControls.style.display = 'none';
  els.startCameraBtn.style.display = 'inline-flex';

  // 如果之前有上传视频，恢复显示
  var hasUpload = els.uploadedVideo.src && els.uploadedVideo.src.indexOf('blob:') === 0;
  if (hasUpload) {
    els.videoFeed.classList.add('has-upload');
  }
  updateCaptureStatus(false, hasUpload);
  els.liveState.textContent = '待开始';

  console.log('[摄像头] 已关闭');
}

// 切换摄像头设备
async function switchCamera() {
  if (!isCameraActive) return;
  console.log('[摄像头] 切换设备...');
  await startCamera();
}

async function copyTranscript() {
  const text = els.fullTranscriptText.value.trim();
  if (!text) {
    els.transcriptStats.textContent = "暂无可复制文本";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    els.transcriptStats.textContent = `${fullTranscriptLines.length}条发言 · 已复制全文`;
  } catch {
    els.fullTranscriptText.select();
    els.transcriptStats.textContent = "已选中文本，可手动复制";
  }
}

function clearTranscript() {
  fullTranscriptLines = [];
  transcriptIndex = 0;
  els.transcriptFeed.innerHTML = "";
  syncFullTranscript();
}

function generateOutline(event) {
  event.preventDefault();
  const goal = document.getElementById("goalInput").value.trim();
  const audience = formatAudienceSummary(currentAudienceList);
  const product = document.getElementById("productInput").value.trim();
  const duration = document.getElementById("durationInput").value.trim();
  const generated = [
    `开场确认：围绕“${audience}”确认用户背景、当前车辆、家庭成员和日常出行半径。`,
    `需求探索：基于“${goal}”追问购车动机、替换现车原因和理想车型标准。`,
    `产品体验：针对“${product}”收集外观、空间、座舱、智驾、续航、服务的真实评价。`,
    "场景复盘：让用户讲一次通勤、接送孩子、周末出游或长途返乡的完整用车经历。",
    "竞品对比：追问用户为什么考虑竞品，以及本品需要做到什么才会改变选择。",
    "成交阻力：拆解预算、续航可信度、家人意见、保值率、售后和补能焦虑。",
    `时间控制：按${duration}设计阶段节奏，最后5分钟确认最打动用户的一句话卖点。`
  ];
  renderOutline(generated);
  if (currentSession?.status === "待开始" && !pendingSessionStarted) {
    els.startSessionBanner.classList.remove("hidden");
    return;
  }
  setStage("live");
}

function renderReportContent() {
  document.getElementById("insightList").innerHTML = [
    "目标用户并不排斥纯电SUV，核心顾虑集中在冬季续航可信度和长途补能规划。",
    "智能座舱最能打动年轻家庭的不是技术参数，而是孩子安静、操作省心、家人愿意坐。",
    "竞品B的品牌信任仍有优势，本品应通过试驾体验和真实车主案例降低不确定感。",
    "营销表达应减少抽象技术词，转向真实家庭场景和可验证的使用证据。"
  ].map((item) => `<li>${item}</li>`).join("");

  document.getElementById("personaSummary").innerHTML = `
    <p><strong>核心人群：</strong>25-35岁年轻家庭增换购用户。</p>
    <p><strong>关键需求：</strong>可靠续航、亲子空间、易用智能座舱、清晰金融方案。</p>
    <p><strong>成交触发：</strong>试驾中感知到座舱价值，并看到真实长途补能案例。</p>
  `;

  els.playbackStatus.textContent = currentSession?.status === "已完成" ? "访谈资料已归档" : "可在调研结束后归档回放";
  if (els.uploadedVideo.src) {
    els.reportVideo.src = els.uploadedVideo.src;
    els.reportAudio.src = els.uploadedVideo.src;
  } else {
    els.reportVideo.removeAttribute("src");
    els.reportAudio.removeAttribute("src");
  }
}

function renderReport() {
  // ★ 自动同步：调研报告生成时，将用户样本库最新数据同步到共享数据桥
  autoSyncUserSamplesToBridge();
  renderReportContent();
  setView("research");
  setStage("report");
}

function renderPersona() {
  const container = document.getElementById("personaCards");
  if (!container) return;
  container.innerHTML = personaData.map((item) => `
    <article class="persona-card">
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <div class="knowledge-meta">${item.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </article>
  `).join("");
}

function renderCompetitors() {
  const container = document.getElementById("competitorMatrix");
  if (!container) return;
  container.innerHTML = competitorData.map((item) => `
    <article class="matrix-card">
      <h3>${item.name}</h3>
      <div class="score">
        ${Object.entries(item.scores).map(([label, score]) => `
          <div class="score-row">
            <span>${label}</span>
            <div class="bar"><i style="width: ${score}%"></i></div>
            <strong>${score}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderStrategies() {
  const container = document.getElementById("strategyCards");
  if (!container) return;
  container.innerHTML = strategies.map((item) => `
    <article class="strategy-card">
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </article>
  `).join("");
}

function renderKnowledge(filter = "") {
  const normalized = filter.trim().toLowerCase();
  const list = knowledgeItems.filter((item) => {
    const haystack = `${item.title} ${item.text} ${item.meta.join(" ")}`.toLowerCase();
    return haystack.includes(normalized);
  });

  const container = document.getElementById("knowledgeList");
  if (!container) return;
  container.innerHTML = list.map((item) => `
    <article class="knowledge-item">
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <div class="knowledge-meta">${item.meta.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </article>
  `).join("");
}

function resetDemo() {
  currentSession = null;
  activeSessionId = null;
  openSessions = [];
  activeQuantSessionId = null;
  openQuantSessions = [];
  currentSurvey = null;
  pendingSessionStarted = false;
  transcriptIndex = 0;
  isRecording = false;
  // 停止摄像头采集
  if (isCameraActive) {
    stopCamera();
  }
  fullTranscriptLines = [];
  secondsLeft = 23 * 60 + 40;
  progress = 42;
  window.clearInterval(timerId);
  questionState.forEach((item, index) => {
    item.done = index < 3;
  });
  els.transcriptFeed.innerHTML = "";
  els.fullTranscriptText.value = "";
  els.transcriptStats.textContent = "0条发言 · 0字";
  els.uploadedVideo.removeAttribute("src");
  els.uploadedVideo.parentElement.classList.remove("has-upload");
  els.uploadFileName.textContent = "支持访谈视频、试驾回访视频、焦点小组录像";
  els.liveState.textContent = "待开始";
  document.getElementById("recordBtn").textContent = "开始实时记录";
  document.getElementById("signalMetric").textContent = "8";
  els.nextSuggestion.textContent = "先确认用户家庭成员结构，再进入真实用车场景。";
  els.emotionNote.textContent = "用户语速放慢，谈到冬季续航时出现停顿，建议追问真实经历。";
  updateProgress(42);
  updateTimer();
  updateCaptureStatus(false, false);
  renderQuestions();
  renderOutline();
  setAvailableStages(["prepare", "live", "report"], "prepare");
  resetPreparationLock();
  els.startSessionBanner.classList.add("hidden");
  hideSubNav('qual');
  hideSubNav('quant');
  els.closeSessionBtn.classList.add("hidden");
  renderSessions();
  renderSurveys();
  // 初始化渲染用户头像卡片
  renderAudienceAvatars();
  setView("overview");
  setStage("prepare");
}

document.querySelectorAll(".nav-item").forEach((button) => {
  console.log(`绑定导航点击事件: ${button.dataset.view}`);
  button.addEventListener("click", () => {
    console.log(`点击了导航: ${button.dataset.view}`);
    const view = button.dataset.view;
    
    // 定性调研（原用户调研）
    if (view === "overview") {
      if (openSessions.length > 0) {
        renderSubNavTabs('qual');
      } else {
        hideSubNav('qual');
      }
    }
    // 定量调研
    else if (view === "quantOverview") {
      if (openQuantSessions.length > 0) {
        renderSubNavTabs('quant');
      } else {
        hideSubNav('quant');
      }
    }
    
    console.log(`切换到视图: ${view}`);
    setView(view);
  });
});

// ============================================================
//  AI 实时分析模块
//  1) 语音识别 (Web Speech API)
//  2) 情绪分析 (LLM 文本分析)
//  3) 表情分析 (Canvas 抓帧 + LLM Vision)
// ============================================================

// ---- AI 配置管理 ----
function loadAIConfig() {
  try {
    var saved = localStorage.getItem('ai_analysis_config');
    if (saved) {
      var parsed = JSON.parse(saved);
      aiConfig.provider = parsed.provider || 'openai';
      aiConfig.apiKey = parsed.apiKey || '';
      aiConfig.customUrl = parsed.customUrl || '';
      aiConfig.modelName = parsed.modelName || 'gpt-4o';
      aiEnabled = parsed.enabled === true;
    }
  } catch (e) { /* ignore */ }
  syncAIConfigUI();
}

function saveAIConfig() {
  aiConfig.provider = els.aiProvider.value;
  aiConfig.apiKey = els.aiApiKey.value.trim();
  aiConfig.customUrl = els.aiCustomUrl.value.trim();
  aiConfig.modelName = els.aiModelName.value.trim();
  localStorage.setItem('ai_analysis_config', JSON.stringify({
    provider: aiConfig.provider,
    apiKey: aiConfig.apiKey,
    customUrl: aiConfig.customUrl,
    modelName: aiConfig.modelName,
    enabled: aiEnabled
  }));
}

function syncAIConfigUI() {
  els.aiProvider.value = aiConfig.provider;
  els.aiApiKey.value = aiConfig.apiKey;
  els.aiCustomUrl.value = aiConfig.customUrl;
  els.aiModelName.value = aiConfig.modelName || getDefaultModel(aiConfig.provider);
  els.aiCustomUrlLabel.style.display = aiConfig.provider === 'custom' ? '' : 'none';

  // 面板始终可见，只切换激活状态和开关
  if (aiEnabled) {
    els.aiToggleBtn.classList.add('on');
    els.aiAnalysisPanel.classList.add('active');
  } else {
    els.aiToggleBtn.classList.remove('on');
    els.aiAnalysisPanel.classList.remove('active');
  }
  updateAutoDetectState();
}

function getDefaultModel(provider) {
  var defaults = {
    openai: 'gpt-4o',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-plus',
    zhipu: 'glm-4-flash',
    custom: ''
  };
  return defaults[provider] || '';
}

function getAPIEndpoint() {
  var endpoints = {
    openai: 'https://api.openai.com/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    custom: aiConfig.customUrl
  };
  return endpoints[aiConfig.provider] || aiConfig.customUrl;
}

function getVisionModel() {
  var models = {
    openai: 'gpt-4o',
    deepseek: null,       // DeepSeek 不支持视觉
    qwen: 'qwen-vl-plus',
    zhipu: 'glm-4v',
    custom: aiConfig.modelName
  };
  return models[aiConfig.provider];
}

// ---- 语音识别 (Web Speech API) ----
function initSpeechRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('[AI] 浏览器不支持 SpeechRecognition API');
    return false;
  }
  return true;
}

function startSpeechRecognition() {
  if (!aiEnabled || isSpeechListening) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    els.asrStatus.textContent = '不支持';
    els.asrStatus.className = 'ai-card-status';
    els.asrText.textContent = '当前浏览器不支持语音识别，请使用 Chrome 浏览器';
    return;
  }

  try {
    speechRecognition = new SR();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'zh-CN';
    speechRecognition.maxAlternatives = 1;

    speechRecognition.onstart = function () {
      isSpeechListening = true;
      els.asrStatus.textContent = '监听中';
      els.asrStatus.className = 'ai-card-status recording';
      els.aiStatusDot.className = 'ai-status-dot listening';
      console.log('[AI] 语音识别已启动');
    };

    speechRecognition.onresult = function (event) {
      var interim = '';
      var finalText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      // 显示实时转写
      if (interim) {
        els.asrText.innerHTML = '<em style="color:#94a3b8">' + escapeHtml(interim) + '</em>';
      }
      if (finalText) {
        els.asrText.textContent = finalText;
        // 追加到转写 feed 和全文
        onSpeechRecognized(finalText);
      }
    };

    speechRecognition.onerror = function (event) {
      console.error('[AI] 语音识别错误:', event.error);
      if (event.error === 'not-allowed') {
        els.asrStatus.textContent = '权限拒绝';
        els.asrStatus.className = 'ai-card-status';
        els.asrText.textContent = '请允许麦克风权限后重试';
      } else if (event.error === 'no-speech') {
        // 静默，自动重启
      } else {
        els.asrStatus.textContent = '错误';
        els.asrStatus.className = 'ai-card-status';
        els.aiStatusDot.className = 'ai-status-dot error';
      }
    };

    speechRecognition.onend = function () {
      isSpeechListening = false;
      // 摄像头或视频仍在，自动重启
      if (aiEnabled && (isCameraActive || document.querySelector('.video-feed.has-upload'))) {
        if (speechRestartTimer) clearTimeout(speechRestartTimer);
        speechRestartTimer = setTimeout(function () {
          if (aiEnabled && !isSpeechListening) {
            try { startSpeechRecognition(); } catch (e) { /* ignore */ }
          }
        }, 300);
      } else {
        els.asrStatus.textContent = '已停止';
        els.asrStatus.className = 'ai-card-status';
        els.aiStatusDot.className = 'ai-status-dot';
      }
    };

    speechRecognition.start();
  } catch (e) {
    console.error('[AI] 语音识别启动失败:', e);
    els.asrStatus.textContent = '启动失败';
    els.asrStatus.className = 'ai-card-status';
  }
}

function stopSpeechRecognition() {
  if (speechRestartTimer) { clearTimeout(speechRestartTimer); speechRestartTimer = null; }
  if (speechRecognition) {
    try {
      speechRecognition.onend = null; // 防止自动重启
      speechRecognition.stop();
    } catch (e) { /* ignore */ }
    speechRecognition = null;
  }
  isSpeechListening = false;
  els.asrStatus.textContent = '已停止';
  els.asrStatus.className = 'ai-card-status';
  els.aiStatusDot.className = 'ai-status-dot';
}

// 是否启用 LLM 自动说话人识别（需要 API Key）
let autoDetectSpeaker = false;
// 上下文窗口（用于 LLM 判断说话人）
let speakerContextWindow = [];

function onSpeechRecognized(text) {
  if (!text || !text.trim()) return;
  var cleanText = text.trim();

  // 如果开启了 LLM 自动识别，用大模型判断说话人
  if (autoDetectSpeaker && aiConfig.apiKey) {
    autoIdentifySpeaker(cleanText);
    // 结果异步返回，暂时先用当前说话人标注
  }

  // 带角色标注的文本（存缓冲区时附角色）
  var labeledText = '[' + currentSpeaker + '] ' + cleanText;
  pendingAnalysisTexts.push(labeledText);
  if (pendingAnalysisTexts.length > 30) pendingAnalysisTexts.shift();

  // 追加到转写面板
  var node = document.createElement('div');
  node.className = 'line';
  var roleColor = currentSpeaker === '主持人' ? '#60a5fa' : '#34d399';
  node.innerHTML = '<strong style="color:' + roleColor + '">' + escapeHtml(currentSpeaker) + '</strong><p>' + escapeHtml(cleanText) + '</p><span class="tag">实时语音</span>';
  els.transcriptFeed.appendChild(node);
  els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;

  // 追加到完整文本（带角色）
  var lineNumber = String(fullTranscriptLines.length + 1).padStart(2, '0');
  fullTranscriptLines.push(lineNumber + '. ' + currentSpeaker + '：' + cleanText);
  syncFullTranscript();

  // 维护上下文窗口
  speakerContextWindow.push({ role: currentSpeaker, text: cleanText });
  if (speakerContextWindow.length > 20) speakerContextWindow.shift();
}

// LLM 自动判断说话人
async function autoIdentifySpeaker(text) {
  try {
    // 构建上下文
    var ctxText = speakerContextWindow.slice(-6).map(function (item) {
      return item.role + '：' + item.text;
    }).join('\n');

    var promptText = '你是一个访谈场景的说话人识别助手。请根据对话上下文，判断下面这句新说的话是谁说的。\n'
      + '只有两个角色：主持人（研究人员，负责提问和追问）和用户（受访者，提供个人看法和体验）。\n\n'
      + '最近对话：\n' + (ctxText || '（无）') + '\n\n'
      + '新的语句：' + text + '\n\n'
      + '只返回一个词："主持人"或"用户"，不要解释。';

    var result = await callLLM([
      { role: 'user', content: promptText }
    ], { temperature: 0, maxTokens: 10 });

    var predicted = result.trim().replace(/["\s]/g, '');
    if (predicted === '用户' || predicted === '主持人') {
      if (predicted !== currentSpeaker) {
        switchSpeaker(predicted);
      }
    }
  } catch (e) {
    // 静默失败，保持当前说话人
  }
}

// ---- LLM API 调用 ----
async function callLLM(messages, options) {
  options = options || {};
  var endpoint = getAPIEndpoint();
  var model = options.model || aiConfig.modelName || getDefaultModel(aiConfig.provider);
  var apiKey = aiConfig.apiKey;

  if (!apiKey) throw new Error('请先配置 API Key');
  if (!endpoint) throw new Error('请配置 API 端点地址');

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };

  // 部分服务商需要额外 headers
  if (aiConfig.provider === 'qwen') {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  var body = {
    model: model,
    messages: messages,
    max_tokens: options.maxTokens || 512,
    temperature: options.temperature || 0.3
  };

  var resp = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('API 请求失败 (' + resp.status + '): ' + errText.substring(0, 200));
  }

  var data = await resp.json();
  return data.choices[0].message.content;
}

// ---- 情绪分析 ----
async function analyzeEmotion() {
  if (!aiEnabled || !aiConfig.apiKey) return;
  var allText = pendingAnalysisTexts.join(' ');
  if (!allText || allText === lastEmotionTexts) return;
  lastEmotionTexts = allText;

  els.aiStatusDot.className = 'ai-status-dot analyzing';

  try {
    var prompt = '你是一个情绪分析专家。请分析以下对话片段中说话人的情绪，返回JSON格式（只返回JSON，不要其他文字）：\n{\n  "primary_emotion": "正面/中性/负面",\n  "emotion_label": "具体情绪词，如满意、焦虑、愤怒、开心、失望、期待等",\n  "confidence": 0.0-1.0,\n  "positive_score": 0.0-1.0,\n  "neutral_score": 0.0-1.0,\n  "negative_score": 0.0-1.0,\n  "brief_reason": "一句话分析原因"\n}\n\n对话内容：\n' + allText.substring(allText.length - 1500);

    var result = await callLLM([
      { role: 'system', content: '你是一个专业的情绪分析AI。请严格按JSON格式返回结果。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.1, maxTokens: 256 });

    // 解析 JSON
    var jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var analysis = JSON.parse(jsonStr);

    // 更新 UI
    var emojiMap = {
      '正面': '😊', '满意': '😊', '开心': '😄', '期待': '🤩', '惊喜': '😲', '感动': '🥹',
      '中性': '😐', '平静': '😐', '好奇': '🤔',
      '负面': '😟', '焦虑': '😰', '失望': '😞', '愤怒': '😠', '担忧': '😨', '困惑': '😕'
    };
    var emoji = emojiMap[analysis.emotion_label] || emojiMap[analysis.primary_emotion] || '😐';

    els.emotionMain.textContent = emoji;
    els.emotionMain.title = analysis.emotion_label + ' (' + (analysis.confidence * 100).toFixed(0) + '%)';

    var posW = (analysis.positive_score * 100).toFixed(0) + '%';
    var neuW = (analysis.neutral_score * 100).toFixed(0) + '%';
    var negW = (analysis.negative_score * 100).toFixed(0) + '%';
    els.emotionPos.style.width = posW;
    els.emotionNeu.style.width = neuW;
    els.emotionNeg.style.width = negW;

    // 添加到情绪历史
    emotionHistory.push({
      time: new Date().toISOString(),
      emotion: analysis.emotion_label,
      primary: analysis.primary_emotion,
      confidence: analysis.confidence,
      reason: analysis.brief_reason
    });

    els.aiStatusDot.className = 'ai-status-dot listening';
  } catch (e) {
    console.error('[AI] 情绪分析失败:', e);
    els.aiStatusDot.className = 'ai-status-dot error';
    setTimeout(function () {
      if (isSpeechListening) els.aiStatusDot.className = 'ai-status-dot listening';
    }, 2000);
  }
}

// ---- 表情分析 ----
function captureVideoFrame() {
  // 优先使用摄像头预览，其次使用上传的视频
  var video = els.cameraPreview;
  if (!video || !video.videoWidth) {
    video = els.uploadedVideo;
  }
  if (!video || !video.videoWidth || video.paused) return null;

  try {
    var canvas = document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth, 640);
    canvas.height = Math.min(video.videoHeight, 480);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5);
  } catch (e) {
    console.error('[AI] 抓帧失败:', e);
    return null;
  }
}

async function analyzeFacialExpression(imageBase64) {
  if (!aiEnabled || !aiConfig.apiKey || !imageBase64) return;

  // 检查是否有视觉模型
  var visionModel = getVisionModel();
  if (!visionModel) {
    els.expressionTag.textContent = 'N/A';
    els.expressionDetail.textContent = '当前模型不支持视觉分析';
    return;
  }

  try {
    var result = await callLLM([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请分析这张人脸图片的表情。返回JSON格式（只返回JSON）：\n{\n  "expression": "表情词，如微笑、严肃、惊讶、困惑、中性、不满等",\n  "intensity": "强烈/明显/轻微",\n  "confidence": 0.0-1.0,\n  "brief_desc": "一句话描述"\n}'
          },
          {
            type: 'image_url',
            image_url: { url: imageBase64, detail: 'low' }
          }
        ]
      }
    ], { model: visionModel, temperature: 0.1, maxTokens: 200 });

    var jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    var analysis = JSON.parse(jsonStr);

    var exprEmojiMap = {
      '微笑': '😊', '大笑': '😄', '严肃': '😐', '惊讶': '😲', '困惑': '😕',
      '中性': '😶', '不满': '😒', '悲伤': '😢', '愤怒': '😠', '厌恶': '😖',
      '专注': '🧐', '思考': '🤔'
    };
    var emoji = exprEmojiMap[analysis.expression] || '😶';

    els.expressionTag.textContent = emoji + ' ' + analysis.expression;
    els.expressionDetail.textContent = analysis.brief_desc + ' (' + (analysis.confidence * 100).toFixed(0) + '%)';
  } catch (e) {
    console.error('[AI] 表情分析失败:', e);
    els.expressionDetail.textContent = '分析超时，将在下个周期重试';
  }
}

// ---- 分析管线 ----
// 语音识别始终随摄像头启动（浏览器原生，无需 API Key）
function startSpeechPipeline() {
  if (initSpeechRecognition()) {
    startSpeechRecognition();
  } else {
    els.asrStatus.textContent = '不支持';
    els.asrStatus.className = 'ai-card-status';
    els.asrText.textContent = '当前浏览器不支持语音识别，请使用 Chrome 浏览器';
  }
}

// LLM 情绪 + 表情分析（需要 AI 开关 + API Key）
function startEmotionFacePipeline() {
  if (!aiEnabled || !aiConfig.apiKey) return;

  // 定时情绪分析（每 8 秒）
  if (analysisIntervalId) clearInterval(analysisIntervalId);
  analysisIntervalId = setInterval(function () {
    if (aiEnabled && aiConfig.apiKey && pendingAnalysisTexts.length > 0) {
      analyzeEmotion();
    }
  }, 8000);

  // 定时表情分析（每 10 秒）
  if (faceCaptureIntervalId) clearInterval(faceCaptureIntervalId);
  faceCaptureIntervalId = setInterval(function () {
    if (aiEnabled && aiConfig.apiKey) {
      var frame = captureVideoFrame();
      if (frame && frame !== lastFaceBase64) {
        lastFaceBase64 = frame;
        analyzeFacialExpression(frame);
      }
    }
  }, 10000);

  console.log('[AI] LLM 情绪/表情分析已启动');
}

function stopEmotionFacePipeline() {
  if (analysisIntervalId) { clearInterval(analysisIntervalId); analysisIntervalId = null; }
  if (faceCaptureIntervalId) { clearInterval(faceCaptureIntervalId); faceCaptureIntervalId = null; }
  els.emotionMain.textContent = '--';
  els.emotionPos.style.width = '0%';
  els.emotionNeu.style.width = '0%';
  els.emotionNeg.style.width = '0%';
  els.expressionTag.textContent = '--';
  els.expressionDetail.textContent = '配置 API Key 后启用';
}

function stopAllAnalysis() {
  stopSpeechRecognition();
  stopEmotionFacePipeline();

  els.aiStatusDot.className = 'ai-status-dot';
  els.asrStatus.textContent = '已停止';
  els.asrStatus.className = 'ai-card-status';
  els.asrText.textContent = '开启摄像头后自动启动语音识别...';
}

// ---- AI 开关 ----
function toggleAI() {
  aiEnabled = !aiEnabled;
  if (aiEnabled) {
    els.aiToggleBtn.classList.add('on');
    els.aiAnalysisPanel.classList.add('active');
    // 如果已有视频源且 API 已配置，启动 LLM 情绪/表情分析
    if (isCameraActive || document.querySelector('.video-feed.has-upload')) {
      if (aiConfig.apiKey) startEmotionFacePipeline();
    }
    showToast('AI 情绪/表情分析已开启（语音识别始终自动运行）', 'success');
  } else {
    els.aiToggleBtn.classList.remove('on');
    els.aiAnalysisPanel.classList.remove('active');
    stopEmotionFacePipeline();
    showToast('AI 情绪/表情分析已关闭（语音识别仍运行中）', 'info');
  }
  updateAutoDetectState();
  saveAIConfig();
}

// ---- API 设置保存 ----
function handleAISettingsSave() {
  saveAIConfig();
  els.aiSettingsBody.style.display = 'none';
  updateAutoDetectState();
  showToast('AI 配置已保存', 'success');

  // 如果当前开启了 AI 且有视频源，重启 LLM 分析管线
  if (aiEnabled && aiConfig.apiKey && (isCameraActive || document.querySelector('.video-feed.has-upload'))) {
    stopEmotionFacePipeline();
    startEmotionFacePipeline();
  }
}

// ---- API 连接测试 ----
async function handleAITestConnection() {
  var key = els.aiApiKey.value.trim();
  if (!key) {
    els.aiTestResult.textContent = '请先输入 API Key';
    els.aiTestResult.className = 'ai-test-result error';
    return;
  }

  // 临时保存配置用于测试
  var prevKey = aiConfig.apiKey;
  aiConfig.apiKey = key;
  aiConfig.provider = els.aiProvider.value;
  aiConfig.customUrl = els.aiCustomUrl.value.trim();
  aiConfig.modelName = els.aiModelName.value.trim();

  els.aiTestResult.textContent = '测试中...';
  els.aiTestResult.className = 'ai-test-result';

  try {
    await callLLM([
      { role: 'user', content: '回复"OK"' }
    ], { maxTokens: 10, temperature: 0 });
    els.aiTestResult.textContent = '连接成功 ✓';
    els.aiTestResult.className = 'ai-test-result success';
  } catch (e) {
    els.aiTestResult.textContent = '失败: ' + e.message.substring(0, 60);
    els.aiTestResult.className = 'ai-test-result error';
  }

  aiConfig.apiKey = prevKey; // 恢复
}

// ---- 工具函数 ----
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type) {
  // 简单 toast 实现（如果已有 toast 函数则使用已有的）
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
    return;
  }
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:8px;font-size:13px;z-index:99999;pointer-events:none;animation:fadeIn 0.3s ease;'
    + (type === 'success' ? 'background:rgba(16,185,129,0.9);color:#fff;' :
       type === 'error' ? 'background:rgba(239,68,68,0.9);color:#fff;' :
       'background:rgba(59,130,246,0.9);color:#fff;');
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function () { toast.remove(); }, 300);
  }, 2500);
}

// ===== 调研阶段切换（使用 querySelectorAll，不会因为单个元素缺失而抛错） =====
document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => setStage(button.dataset.stage));
});

// ★ 防御性绑定：使用 safeBind 避免某个 el 缺失导致后续代码全部失效
function safeBind(el, event, handler, label) {
  if (!el) {
    console.warn('[事件绑定] 跳过：' + (label || 'unknown') + ' — 元素不存在');
    return false;
  }
  try {
    el.addEventListener(event, handler);
    return true;
  } catch(e) {
    console.error('[事件绑定] 失败：' + (label || 'unknown'), e);
    return false;
  }
}

safeBind(els.closeSessionBtn, "click", closeSessionDetail, "closeSessionBtn");

document.getElementById("briefForm").addEventListener("submit", generateOutline);
document.getElementById("recordBtn").addEventListener("click", startRecording);
document.getElementById("nextLineBtn").addEventListener("click", addTranscriptLine);
document.getElementById("videoUpload").addEventListener("change", handleVideoUpload);
document.getElementById("copyTranscriptBtn").addEventListener("click", copyTranscript);
document.getElementById("clearTranscriptBtn").addEventListener("click", clearTranscript);
safeBind(els.selectStorageDirBtn, "click", selectStorageDir, "selectStorageDirBtn");
safeBind(els.startSessionBtn, "click", startPendingSession, "startSessionBtn");

// 准备锁定/解锁事件
safeBind(els.lockBtn, "click", function() {
  if (preparationLocked) {
    showUnlockModal();
  } else {
    lockPreparation();
  }
}, "lockBtn");
safeBind(els.closeUnlockModalBtn, "click", hideUnlockModal, "closeUnlockModalBtn");
safeBind(els.cancelUnlockBtn, "click", hideUnlockModal, "cancelUnlockBtn");
safeBind(els.confirmUnlockBtn, "click", verifyAndUnlock, "confirmUnlockBtn");
safeBind(els.unlockPasswordInput, "keydown", function(e) {
  if (e.key === 'Enter') verifyAndUnlock();
}, "unlockPasswordInput");
// 点击弹窗遮罩关闭
safeBind(els.unlockModal, "click", function(e) {
  if (e.target === els.unlockModal) hideUnlockModal();
}, "unlockModal");

safeBind(document.getElementById("generateReportBtn"), "click", renderReport, "generateReportBtn");
safeBind(document.getElementById("resetBtn"), "click", resetDemo, "resetBtn");
var _msb = document.getElementById("manualSyncBtn");
if (_msb) _msb.addEventListener("click", function() {
  autoSyncUserSamplesToBridge();
  var completedCount = getCompletedUserSamples().length;
  alert('已同步 ' + completedCount + ' 个已完成调研的用户样本到共享数据桥！\n虚拟消费者平台将自动检测并生成对应数字分身。');
});
safeBind(document.getElementById("editOutlineBtn"), "click", function() {
  els.outlineList.querySelector("li")?.focus();
}, "editOutlineBtn");

// ★★★ 所有初始化渲染移到事件绑定之前 ★★★
//     确保页面至少能渲染出来，不被事件绑定错误阻断
console.log('[初始化] 开始渲染页面...');

renderSessionFilters();
renderSessions();
renderOutline();
renderQuestions();
renderPersona();
renderCompetitors();
renderStrategies();
renderKnowledge();
updateProgress(progress);
updateTimer();
updateCaptureStatus(false, false);

// ★ 初始化视图：确保只显示 overview 面板
setView("overview");
setStage("prepare");
updateContextVisibility();

console.log('[初始化] 渲染完成 — 活跃视图数=' + document.querySelectorAll('.view.active').length);

// ===== 事件绑定（续） =====

safeBind(els.productFilter, "change", renderSessions, "productFilter");
safeBind(els.typeFilter, "change", renderSessions, "typeFilter");
safeBind(els.sessionFilter, "change", renderSessions, "sessionFilter");
document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  els.productFilter.value = "";
  els.typeFilter.value = "";
  els.sessionFilter.value = "";
  renderSessions();
});

// 新建调研弹窗事件
safeBind(els.newSessionBtn, "click", showNewSessionModal, "newSessionBtn");
safeBind(els.closeModalBtn, "click", hideNewSessionModal, "closeModalBtn");
safeBind(els.cancelNewSessionBtn, "click", hideNewSessionModal, "cancelNewSessionBtn");
safeBind(els.newSessionModal, "click", function(e) {
  if (e.target === els.newSessionModal) hideNewSessionModal();
}, "newSessionModal");
safeBind(els.newSessionForm, "submit", handleNewSessionSubmit, "newSessionForm");

// 摄像头事件
safeBind(els.startCameraBtn, "click", startCamera, "startCameraBtn");
safeBind(els.stopCameraBtn, "click", stopCamera, "stopCameraBtn");
safeBind(els.cameraSelect, "change", switchCamera, "cameraSelect");

// ---- 说话人切换 ----
function switchSpeaker(role) {
  if (currentSpeaker === role) return;
  currentSpeaker = role;
  if (role === '用户') {
    els.speakerUserBtn.classList.add('active');
    els.speakerHostBtn.classList.remove('active');
  } else {
    els.speakerHostBtn.classList.add('active');
    els.speakerUserBtn.classList.remove('active');
  }
  // 更新语音识别卡片提示
  els.asrText.textContent = '当前识别为「' + role + '」的发言...';
}

// ---- AI 分析事件绑定 ----
safeBind(els.aiToggleBtn, "click", toggleAI, "aiToggleBtn");
safeBind(els.aiSettingsBtn, "click", function () {
  var body = els.aiSettingsBody;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}, "aiSettingsBtn");
safeBind(els.aiProvider, "change", function () {
  aiConfig.provider = els.aiProvider.value;
  els.aiCustomUrlLabel.style.display = aiConfig.provider === 'custom' ? '' : 'none';
  els.aiModelName.value = getDefaultModel(aiConfig.provider);
}, "aiProvider");
safeBind(els.aiSaveSettingsBtn, "click", handleAISettingsSave, "aiSaveSettingsBtn");
safeBind(els.aiTestConnBtn, "click", handleAITestConnection, "aiTestConnBtn");

// 说话人切换按钮
safeBind(els.speakerUserBtn, "click", function () { switchSpeaker('用户'); }, "speakerUserBtn");
safeBind(els.speakerHostBtn, "click", function () { switchSpeaker('主持人'); }, "speakerHostBtn");

// AI 自动识别说话人复选框
var speakerAutoCheck = document.getElementById('speakerAutoCheck');
var speakerAutoLabel = document.getElementById('speakerAutoLabel');
if (speakerAutoCheck) {
  speakerAutoCheck.addEventListener('change', function () {
    autoDetectSpeaker = this.checked;
    if (autoDetectSpeaker && !aiConfig.apiKey) {
      showToast('请先配置 LLM API Key 才能使用 AI 自动识别', 'error');
      this.checked = false;
      autoDetectSpeaker = false;
      return;
    }
    showToast(autoDetectSpeaker ? 'AI 自动识别说话人已启用' : '已切换到手动模式', 'info');
  });
}
// 更新复选框状态
function updateAutoDetectState() {
  var hasKey = !!aiConfig.apiKey;
  if (speakerAutoCheck) speakerAutoCheck.disabled = !aiEnabled || !hasKey;
  if (speakerAutoLabel) speakerAutoLabel.className = 'speaker-auto-label' + (aiEnabled && hasKey ? ' enabled' : '');
  if (!aiEnabled || !hasKey) {
    if (speakerAutoCheck) speakerAutoCheck.checked = false;
    autoDetectSpeaker = false;
  }
}

// 加载 AI 分析配置
loadAIConfig();

// ===== 字体大小控制 =====
(function initFontSizeControl() {
  const FONT_SIZE_KEY = 'app_font_size_zoom';
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.0;
  const STEP = 0.1;
  const DEFAULT_ZOOM = 1.2;
  const html = document.documentElement;
  const valueEl = document.getElementById('fontSizeValue');
  const decBtn = document.getElementById('fontSizeDec');
  const incBtn = document.getElementById('fontSizeInc');

  function applyZoom(zoom) {
    // 限制范围
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    // 保留一位小数
    zoom = Math.round(zoom * 10) / 10;
    html.style.zoom = String(zoom);
    if (valueEl) {
      valueEl.textContent = Math.round(zoom * 100) + '%';
    }
    if (decBtn) {
      decBtn.disabled = zoom <= MIN_ZOOM;
      decBtn.style.opacity = zoom <= MIN_ZOOM ? '0.4' : '1';
    }
    if (incBtn) {
      incBtn.disabled = zoom >= MAX_ZOOM;
      incBtn.style.opacity = zoom >= MAX_ZOOM ? '0.4' : '1';
    }
    return zoom;
  }

  // 从 localStorage 读取
  let currentZoom = DEFAULT_ZOOM;
  const saved = localStorage.getItem(FONT_SIZE_KEY);
  if (saved) {
    const parsed = parseFloat(saved);
    if (!isNaN(parsed)) {
      currentZoom = parsed;
    }
  }
  currentZoom = applyZoom(currentZoom);

  // 绑定按钮事件
  if (decBtn) {
    decBtn.addEventListener('click', () => {
      currentZoom = applyZoom(currentZoom - STEP);
      localStorage.setItem(FONT_SIZE_KEY, String(currentZoom));
    });
  }
  if (incBtn) {
    incBtn.addEventListener('click', () => {
      currentZoom = applyZoom(currentZoom + STEP);
      localStorage.setItem(FONT_SIZE_KEY, String(currentZoom));
    });
  }
})();

// ===== 定量调研模块数据 =====
const surveyTemplates = [
  {
    id: "Q-001",
    title: "纯电SUV用户满意度调查",
    type: "satisfaction",
    status: "active",
    responses: 328,
    targetSample: 500,
    completionRate: 65.6,
    npsScore: 42,
    satisfaction: 4.2,
    createTime: "2026-05-15",
    description: "收集已购车用户对车辆各方面的满意度评价"
  },
  {
    id: "Q-002",
    title: "品牌认知度调研",
    type: "brand",
    status: "active",
    responses: 156,
    targetSample: 300,
    completionRate: 52,
    npsScore: 38,
    satisfaction: 4.0,
    createTime: "2026-05-20",
    description: "了解目标用户对本品牌及竞品的认知程度"
  },
  {
    id: "Q-003",
    title: "NPS净推荐值测评",
    type: "nps",
    status: "closed",
    responses: 500,
    targetSample: 500,
    completionRate: 100,
    npsScore: 45,
    satisfaction: 4.3,
    createTime: "2026-04-10",
    description: "季度NPS跟踪调研，衡量用户推荐意愿"
  },
  {
    id: "Q-004",
    title: "新车型配置偏好调查",
    type: "product",
    status: "draft",
    responses: 0,
    targetSample: 400,
    completionRate: 0,
    npsScore: null,
    satisfaction: null,
    createTime: "2026-06-01",
    description: "测试用户对新车型各项配置的偏好和支付意愿"
  }
];

const sampleQuestions = [
  { type: "rating", text: "请对车辆的整体满意度打分", scale: 5 },
  { type: "nps", text: "您向朋友或同事推荐本品牌的可能性有多大？", scale: 10 },
  { type: "multiple", text: "您最看重的购车因素有哪些？", options: ["价格", "续航", "空间", "智能座舱", "品牌"] },
  { type: "single", text: "您的年龄段是？", options: ["18-25岁", "26-35岁", "36-45岁", "46岁以上"] }
];

// ===== 定量调研功能函数 =====
function renderSurveys() {
  const statusFilter = document.getElementById("surveyStatusFilter")?.value || "";
  const typeFilter = document.getElementById("surveyTypeFilter")?.value || "";
  
  const filtered = surveyTemplates.filter(s => {
    const statusMatch = !statusFilter || s.status === statusFilter;
    const typeMatch = !typeFilter || s.type === typeFilter;
    return statusMatch && typeMatch;
  });
  
  const grouped = filtered.reduce((groups, item) => {
    const typeNames = {
      satisfaction: "满意度调查",
      nps: "NPS净推荐值",
      brand: "品牌认知",
      product: "产品偏好"
    };
    const key = typeNames[item.type] || item.type;
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
  
  const container = document.getElementById("surveyGroups");
  if (!container) return;
  
  container.innerHTML = Object.entries(grouped).map(([groupName, items]) => `
    <section class="summary-group">
      <div class="summary-group-title">
        <h3>${groupName}</h3>
        <span>${items.length}份问卷</span>
      </div>
      <div class="summary-card-grid">
        ${items.map((item) => {
          const statusClass = item.status === 'active' ? 'running' : item.status === 'draft' ? 'pending' : '';
          const statusText = item.status === 'active' ? '收集中' : item.status === 'draft' ? '草稿' : '已关闭';
          return `
            <button class="summary-card" data-survey-id="${item.id}" type="button">
              <div class="summary-card-top">
                <span class="session-no">${item.id}</span>
                <span class="session-status ${statusClass}">${statusText}</span>
              </div>
              <h4>${item.title}</h4>
              <p>${item.description}</p>
              <div class="summary-card-meta">
                <span>回收: ${item.responses}/${item.targetSample}</span>
                <span>完成率: ${item.completionRate}%</span>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `).join("") || `<div class="summary-card"><h4>暂无匹配问卷</h4><p>请调整筛选条件。</p></div>`;
  
  // 添加点击事件
  document.querySelectorAll(".summary-card[data-survey-id]").forEach((card) => {
    card.addEventListener("click", () => openSurveyDetail(card.dataset.surveyId));
  });
}

function openSurveyDetail(surveyId) {
  const survey = surveyTemplates.find(s => s.id === surveyId);
  if (!survey) return;
  
  currentSurvey = survey;
  
  // 更新统计页面数据
  document.getElementById("surveyStatsTitle").textContent = `${survey.id} ${survey.title}`;
  document.getElementById("responseCount").textContent = survey.responses;
  document.getElementById("completionRate").textContent = `${survey.completionRate}%`;
  document.getElementById("npsScore").textContent = survey.npsScore !== null ? survey.npsScore : "--";
  document.getElementById("satisfactionScore").textContent = survey.satisfaction !== null ? survey.satisfaction : "--";
  
  // 显示二级标签
  showSubNav(surveyId, survey.title, 'quant');
  
  setView("surveyStats");
}

function switchToQuantSession(surveyId) {
  openSurveyDetail(surveyId);
}

function closeSessionTab(sessionId, type = 'qual') {
  if (type === 'quant') {
    openQuantSessions = openQuantSessions.filter(s => s.id !== sessionId);
    
    if (sessionId === activeQuantSessionId) {
      if (openQuantSessions.length > 0) {
        const lastSession = openQuantSessions[openQuantSessions.length - 1];
        switchToQuantSession(lastSession.id);
      } else {
        activeQuantSessionId = null;
        currentSurvey = null;
        hideSubNav('quant');
        setView("quantOverview");
      }
    } else {
      renderSubNavTabs('quant');
    }
  } else {
    // 定性调研的关闭逻辑（原有）
    openSessions = openSessions.filter(s => s.id !== sessionId);
    
    if (sessionId === activeSessionId) {
      if (openSessions.length > 0) {
        const lastSession = openSessions[openSessions.length - 1];
        switchToSession(lastSession.id);
      } else {
        activeSessionId = null;
        currentSession = null;
        els.closeSessionBtn.classList.add("hidden");
        hideSubNav('qual');
        setView("overview");
      }
    } else {
      renderSubNavTabs('qual');
    }
  }
}

// 问卷编辑器功能
function openSurveyEditor(surveyId = null) {
  questionCounter = 0;
  const titleEl = document.getElementById("surveyEditorTitle");
  
  if (surveyId) {
    const survey = surveyTemplates.find(s => s.id === surveyId);
    if (survey) {
      currentSurvey = survey;
      titleEl.textContent = `编辑问卷: ${survey.title}`;
      document.getElementById("surveyTitleInput").value = survey.title;
      document.getElementById("surveyDescInput").value = survey.description;
      document.getElementById("surveyTypeInput").value = survey.type;
      // 加载已有问题（演示用示例问题）
      renderQuestionList(sampleQuestions);
    }
  } else {
    currentSurvey = null;
    titleEl.textContent = "新建问卷";
    document.getElementById("surveyForm").reset();
    renderQuestionList([]);
  }
  
  setView("surveyEditor");
}

function renderQuestionList(questions) {
  const container = document.getElementById("questionList");
  if (!container) return;
  
  container.innerHTML = questions.map((q, idx) => `
    <li class="question-item-editor">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>问题 ${idx + 1}</strong>
          <span style="color: #94a3b8; font-size: 12px; margin-left: 8px;">[${getQuestionTypeLabel(q.type)}]</span>
          <p style="margin: 4px 0 0; color: #aec3d5;">${q.text}</p>
        </div>
        <button class="ghost-btn" onclick="removeQuestion(${idx})" style="padding: 4px 8px; font-size: 12px;">删除</button>
      </div>
    </li>
  `).join("") || '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无问题，点击"添加问题"开始创建</p>';
}

function getQuestionTypeLabel(type) {
  const labels = {
    rating: "评分题",
    nps: "NPS题",
    multiple: "多选题",
    single: "单选题",
    text: "开放题"
  };
  return labels[type] || type;
}

function addNewQuestion() {
  questionCounter++;
  const newQuestion = {
    type: "single",
    text: `新问题 ${questionCounter}`,
    options: ["选项1", "选项2"]
  };
  
  const container = document.getElementById("questionList");
  const currentQuestions = Array.from(container.querySelectorAll(".question-item-editor")).length;
  const questions = [];
  for (let i = 0; i < currentQuestions; i++) {
    questions.push({ type: "single", text: "现有问题", options: [] });
  }
  questions.push(newQuestion);
  renderQuestionList(questions);
}

function removeQuestion(idx) {
  // 简化处理：重新渲染时跳过该索引
  const container = document.getElementById("questionList");
  const items = container.querySelectorAll(".question-item-editor");
  const questions = Array.from(items).map((item, i) => ({
    type: "single",
    text: `问题 ${i + 1}`,
    options: []
  })).filter((_, i) => i !== idx);
  renderQuestionList(questions);
}

// ===== 定量调研模块数据结束 =====

// ===== 用户数据持久化（双存储引擎：IndexedDB本地 + Supabase云端）=====

// 保存到 IndexedDB 本地 + Supabase 云端（100MB 配额）
function saveInsightDataToCloud() {
  var dataToSave = {
    researchSessions: researchSessions,
    userSamples: userSamples
  };

  // 始终先写 localStorage 紧急备份（同步，瞬时完成）
  try {
    localStorage.setItem('vc_insight_backup', JSON.stringify({
      researchSessions: researchSessions,
      userSamples: userSamples,
      timestamp: Date.now()
    }));
  } catch(e) {}

  if (!window.StorageEngine) {
    // 降级：直接写 Supabase
    if (window.SUPABASE_READY && window.Auth) {
      window.Auth.saveUserData('insight_data', dataToSave)
        .then(function() { console.log('[Insight] ☁ 云端保存成功'); })
        .catch(function(e) { console.error('[Insight] ☁ 云端保存失败:', e.message); });
    }
    return;
  }
  StorageEngine.save('insight_data', dataToSave).then(function(r) {
    if (r.cloud && r.cloud.ok) {
      console.log('[Insight] ☁ 云端保存成功 (' + r.cloud.size + 'B)');
    } else if (r.cloud) {
      console.warn('[Insight] ☁ 云端保存跳过:', r.cloudSkipped || r.cloud.reason, '| 数据已存本地 + localStorage');
    }
  });
}

// 防抖版保存（避免频繁请求，但缩短延迟防止数据丢失）
var _insightSaveTimer = null;
function saveInsightDataDebounced() {
  if (_insightSaveTimer) clearTimeout(_insightSaveTimer);
  _insightSaveTimer = setTimeout(saveInsightDataToCloud, 500);
}

// ★★★ 强制立即保存（登出前调用，取消防抖并同步写入）★★★
window.flushInsightSave = function() {
  return new Promise(function(resolve) {
    // 1) 取消等待中的防抖定时器
    if (_insightSaveTimer) {
      clearTimeout(_insightSaveTimer);
      _insightSaveTimer = null;
    }
    // 2) 立即写 localStorage 紧急备份（同步操作，确保不丢数据）
    try {
      localStorage.setItem('vc_insight_backup', JSON.stringify({
        researchSessions: researchSessions,
        userSamples: userSamples,
        timestamp: Date.now()
      }));
    } catch(e) {}
    // 3) 调用云端保存
    saveInsightDataToCloud();
    // 4) 给网络请求 1.5 秒时间完成
    setTimeout(function() {
      console.log('[Insight] flush 完成');
      resolve(true);
    }, 1500);
  });
};

// 加载：云端优先 → 本地 IndexedDB 兜底 → localStorage 兜底
function loadInsightDataFromCloud() {
  return new Promise(function(resolve) {
    if (window.StorageEngine) {
      StorageEngine.load('insight_data').then(function(r) {
        if (r && r.data) {
          researchSessions = r.data.researchSessions || [];
          userSamples = r.data.userSamples || [];
          console.log('[Insight] 加载 (来源=' + r.source + '): ' + researchSessions.length + ' 场次, ' + userSamples.length + ' 样本');
          resolve(true);
        } else {
          console.log('[Insight] 无历史数据');
          resolve(false);
        }
      });
      return;
    }

    // 降级：旧版云端加载
    if (!window.SUPABASE_READY || !window.Auth) { resolve(false); return; }
    window.Auth.loadUserData('insight_data').then(function(data) {
      if (data) {
        researchSessions = data.researchSessions || [];
        userSamples = data.userSamples || [];
        console.log('[Insight] 已从云端恢复：' + researchSessions.length + ' 场次, ' + userSamples.length + ' 样本');
        resolve(true);
      } else {
        console.log('[Insight] 云端无历史数据');
        resolve(false);
      }
    }).catch(function(e) {
      console.warn('[Insight] 云端加载失败:', e.message);
      resolve(false);
    });
  });
}

// 触发数据保存（在关键操作后调用）
function triggerInsightSave() {
  saveInsightDataDebounced();
  // 保留 localStorage 紧急备份 + beforeunload 备份
  var backup = {
    researchSessions: researchSessions,
    userSamples: userSamples,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem('vc_insight_backup', JSON.stringify(backup));
  } catch(e) {}
  // 同时更新 beforeunload 紧急备份（供 sendBeacon 使用）
  window._emergencyBackupData = backup;
}

// ===== 调研对象详细信息功能 =====
function getAudienceDetailsFromForm() {
  return {
    name: document.getElementById("audienceName")?.value || "",
    gender: document.getElementById("audienceGender")?.value || "",
    age: document.getElementById("audienceAge")?.value || "",
    maritalStatus: document.getElementById("audienceMarital")?.value || "",
    children: document.getElementById("audienceChildren")?.value || "",
    city: document.getElementById("audienceCity")?.value || "",
    cityLevel: document.getElementById("audienceCityLevel")?.value || "",
    education: document.getElementById("audienceEducation")?.value || "",
    income: document.getElementById("audienceIncome")?.value || "",
    carOwnership: document.getElementById("audienceCarOwnership")?.value || "",
    currentCar: document.getElementById("audienceCurrentCar")?.value || "",
    notes: document.getElementById("audienceNotes")?.value || ""
  };
}

function setAudienceDetailsToForm(details) {
  const fields = {
    audienceName: details.name,
    audienceGender: details.gender,
    audienceAge: details.age,
    audienceMarital: details.maritalStatus,
    audienceChildren: details.children,
    audienceCity: details.city,
    audienceCityLevel: details.cityLevel,
    audienceEducation: details.education,
    audienceIncome: details.income,
    audienceCarOwnership: details.carOwnership,
    audienceCurrentCar: details.currentCar,
    audienceNotes: details.notes
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

function clearAudienceForm() {
  currentAudienceDetails = { ...audienceDetailsTemplate };
  setAudienceDetailsToForm(currentAudienceDetails);
}

function formatAudienceSummary(details) {
  // 如果传入的是数组，格式化为多用户摘要
  if (Array.isArray(details)) {
    if (details.length === 0) return "未填写";
    const names = details.map(u => u.name).filter(Boolean);
    if (names.length === 0) return "未填写";
    return `${names.join("、")}等${details.length}位用户`;
  }
  
  // 单个用户的格式化（兼容旧代码）
  const parts = [];
  if (details.name) parts.push(details.name);
  if (details.gender) parts.push(details.gender);
  if (details.age) parts.push(`${details.age}岁`);
  if (details.maritalStatus) parts.push(details.maritalStatus);
  if (details.children) parts.push(details.children);
  if (details.city) parts.push(details.city);
  if (details.cityLevel) parts.push(`${details.cityLevel}城市`);
  if (details.education) parts.push(details.education);
  if (details.income) parts.push(`年收入${details.income}`);
  if (details.carOwnership) parts.push(details.carOwnership);
  return parts.length > 0 ? parts.join("，") : "未填写";
}

// 根据用户信息生成虚拟头像颜色
function generateAvatarColor(name) {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// 根据用户信息生成写实风格头像
function generateCartoonAvatar(user, size = 72) {
  const isMale = user.gender === '男';
  const age = parseInt(user.age) || 30;
  
  // ===== 智能分析用户特征 =====
  // 肤色（根据城市线级和收入）
  const skinTones = isMale 
    ? ['#F5D0A9', '#E8C4A0', '#DDB892', '#F0C8A0'] 
    : ['#FDDCB5', '#F5D0B0', '#F0C5A5', '#F8D5BA'];
  let skinIndex = 0;
  if (user.cityLevel === '一线' || user.cityLevel === '二线') skinIndex = (skinIndex + 1) % skinTones.length;
  if (user.income && (user.income.includes('50-100万') || user.income.includes('100万以上'))) skinIndex = (skinIndex + 2) % skinTones.length;
  const skinColor = skinTones[skinIndex];
  
  // 发色和发型（根据年龄、性别、收入）
  let hairColor, hairStyle;
  if (age >= 60) {
    hairColor = isMale ? '#C0C0C0' : '#D0D0D0';
    hairStyle = isMale ? 'short-gray' : 'medium-gray';
  } else if (age >= 50) {
    hairColor = isMale ? '#5D4E42' : '#6B5D52';
    hairStyle = isMale ? 'short-mature' : 'medium-mature';
  } else if (age >= 40) {
    hairColor = isMale ? '#3D2817' : '#4A3728';
    hairStyle = isMale ? 'short-professional' : 'long-elegant';
  } else if (age >= 30) {
    hairColor = isMale ? '#2C1810' : '#3D2817';
    hairStyle = isMale ? 'short-modern' : (user.maritalStatus === '已婚' ? 'long-tied' : 'long-loose');
  } else {
    hairColor = isMale ? '#1A1A1A' : '#2C1810';
    hairStyle = isMale ? 'short-trendy' : 'long-young';
  }
  
  // 高收入用户可能有更精致的发型
  if (user.income && (user.income.includes('50-100万') || user.income.includes('100万以上'))) {
    hairStyle = isMale ? 'short-styled' : 'long-styled';
  }
  
  // 背景色（根据婚姻状况和性别）
  let bgColor;
  if (isMale) {
    if (user.maritalStatus === '已婚') bgColor = '#4A7FB5';
    else if (user.maritalStatus === '未婚') bgColor = '#5B9BD5';
    else bgColor = '#6BA3DC';
  } else {
    if (user.maritalStatus === '已婚') bgColor = '#C96B9D';
    else if (user.maritalStatus === '未婚') bgColor = '#E88FBF';
    else bgColor = '#D47BA8';
  }
  
  // 衣服颜色（根据收入和职业感）
  let shirtColor;
  if (user.income) {
    if (user.income.includes('50-100万') || user.income.includes('100万以上')) {
      shirtColor = isMale ? '#2C3E50' : '#8E44AD'; // 深色商务/优雅紫色
    } else if (user.income.includes('30-50万')) {
      shirtColor = isMale ? '#34495E' : '#C0392B'; // 深灰/酒红
    } else {
      shirtColor = isMale ? '#5DADE2' : '#E91E63'; // 亮蓝/粉色
    }
  } else {
    shirtColor = isMale ? '#4A90D9' : '#E879A8';
  }
  
  // 是否有眼镜（根据年龄和教育程度）
  const hasGlasses = (age >= 40 && Math.random() > 0.4) || 
                     (user.education === '硕士' && Math.random() > 0.5) ||
                     (user.education === '博士及以上' && Math.random() > 0.3);
  
  // 面部特征哈希（确保每个用户独特）
  let featureHash = 0;
  const featureStr = (user.name || '') + (user.age || '') + (user.city || '');
  for (let i = 0; i < featureStr.length; i++) {
    featureHash = featureStr.charCodeAt(i) + ((featureHash << 5) - featureHash);
  }
  
  const s = size;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs>
        <radialGradient id="bg${featureHash}" cx="50%" cy="40%">
          <stop offset="0%" stop-color="${bgColor}"/>
          <stop offset="100%" stop-color="${adjustColor(bgColor, -30)}"/>
        </radialGradient>
        <linearGradient id="skin${featureHash}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skinColor}"/>
          <stop offset="100%" stop-color="${adjustColor(skinColor, -18)}"/>
        </linearGradient>
      </defs>
      
      <!-- 背景 -->
      <rect width="${s}" height="${s}" fill="url(#bg${featureHash})"/>
      
      <!-- 肩膀/身体 -->
      <path d="M${s*0.15} ${s} Q${s*0.15} ${s*0.78} ${s*0.5} ${s*0.75} Q${s*0.85} ${s*0.78} ${s*0.85} ${s}" fill="${shirtColor}"/>
      
      <!-- 脖子 -->
      <rect x="${s/2-s*0.065}" y="${s*0.60}" width="${s*0.13}" height="${s*0.12}" fill="url(#skin${featureHash})"/>
      <rect x="${s/2-s*0.065}" y="${s*0.68}" width="${s*0.13}" height="${s*0.04}" fill="${adjustColor(skinColor, -25)}" opacity="0.25"/>
      
      <!-- 脸部 - 椭圆形更接近真实 -->
      <ellipse cx="${s/2}" cy="${s*0.44}" rx="${s*0.23}" ry="${s*0.27}" fill="url(#skin${featureHash})"/>
      
      <!-- 耳朵 -->
      <ellipse cx="${s/2-s*0.22}" cy="${s*0.45}" rx="${s*0.038}" ry="${s*0.055}" fill="url(#skin${featureHash})"/>
      <ellipse cx="${s/2+s*0.22}" cy="${s*0.45}" rx="${s*0.038}" ry="${s*0.055}" fill="url(#skin${featureHash})"/>
      
      <!-- 头发 -->
      ${generateHairSVG(s, hairStyle, hairColor, isMale)}
      
      <!-- 眼睛 -->
      ${generateEyesSVG(s, isMale, age, featureHash)}
      
      <!-- 眉毛 -->
      ${generateEyebrowsSVG(s, isMale, age, hairColor, featureHash)}
      
      <!-- 鼻子 -->
      ${generateNoseSVG(s, skinColor, featureHash)}
      
      <!-- 嘴巴 -->
      ${generateMouthSVG(s, isMale, age, featureHash)}
      
      <!-- 眼镜 -->
      ${hasGlasses ? generateGlassesSVG(s, featureHash) : ''}
      
      <!-- 面部细节（皱纹等，根据年龄） -->
      ${age >= 45 ? generateAgeLinesSVG(s, age, featureHash) : ''}
      
      <!-- 衣领 -->
      <path d="M${s/2-s*0.11} ${s*0.75} Q${s/2} ${s*0.82} ${s/2+s*0.11} ${s*0.75}" fill="${adjustColor(shirtColor, -20)}" opacity="0.4"/>
    </svg>
  `;
  
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

// 生成头发SVG
function generateHairSVG(s, style, color, isMale) {
  const hairs = {
    'short-gray': `<path d="M${s*0.28} ${s*0.38} Q${s*0.29} ${s*0.24} ${s*0.5} ${s*0.22} Q${s*0.71} ${s*0.24} ${s*0.72} ${s*0.38} Q${s*0.70} ${s*0.33} ${s*0.68} ${s*0.40} L${s*0.65} ${s*0.46} Q${s*0.5} ${s*0.43} ${s*0.35} ${s*0.46} L${s*0.32} ${s*0.40} Q${s*0.30} ${s*0.33} ${s*0.28} ${s*0.38}" fill="${color}"/>`,
    'medium-gray': `<path d="M${s*0.27} ${s*0.40} Q${s*0.28} ${s*0.22} ${s*0.5} ${s*0.20} Q${s*0.72} ${s*0.22} ${s*0.73} ${s*0.40} Q${s*0.75} ${s*0.52} ${s*0.73} ${s*0.65} L${s*0.68} ${s*0.62} Q${s*0.70} ${s*0.50} ${s*0.68} ${s*0.40} Q${s*0.5} ${s*0.36} ${s*0.32} ${s*0.40} Q${s*0.30} ${s*0.50} ${s*0.32} ${s*0.62} L${s*0.27} ${s*0.65} Q${s*0.25} ${s*0.52} ${s*0.27} ${s*0.40}" fill="${color}"/>`,
    'short-mature': `<path d="M${s*0.28} ${s*0.38} Q${s*0.29} ${s*0.23} ${s*0.5} ${s*0.21} Q${s*0.71} ${s*0.23} ${s*0.72} ${s*0.38} Q${s*0.70} ${s*0.32} ${s*0.67} ${s*0.40} L${s*0.64} ${s*0.47} Q${s*0.5} ${s*0.44} ${s*0.36} ${s*0.47} L${s*0.33} ${s*0.40} Q${s*0.30} ${s*0.32} ${s*0.28} ${s*0.38}" fill="${color}"/>`,
    'medium-mature': `<path d="M${s*0.27} ${s*0.39} Q${s*0.28} ${s*0.21} ${s*0.5} ${s*0.19} Q${s*0.72} ${s*0.21} ${s*0.73} ${s*0.39} Q${s*0.75} ${s*0.50} ${s*0.73} ${s*0.62} L${s*0.68} ${s*0.58} Q${s*0.70} ${s*0.48} ${s*0.68} ${s*0.39} Q${s*0.5} ${s*0.35} ${s*0.32} ${s*0.39} Q${s*0.30} ${s*0.48} ${s*0.32} ${s*0.58} L${s*0.27} ${s*0.62} Q${s*0.25} ${s*0.50} ${s*0.27} ${s*0.39}" fill="${color}"/>`,
    'short-professional': `<path d="M${s*0.28} ${s*0.37} Q${s*0.29} ${s*0.21} ${s*0.5} ${s*0.19} Q${s*0.71} ${s*0.21} ${s*0.72} ${s*0.37} Q${s*0.70} ${s*0.30} ${s*0.67} ${s*0.38} L${s*0.64} ${s*0.45} Q${s*0.5} ${s*0.42} ${s*0.36} ${s*0.45} L${s*0.33} ${s*0.38} Q${s*0.30} ${s*0.30} ${s*0.28} ${s*0.37}" fill="${color}"/>`,
    'long-elegant': `<path d="M${s*0.27} ${s*0.38} Q${s*0.28} ${s*0.19} ${s*0.5} ${s*0.17} Q${s*0.72} ${s*0.19} ${s*0.73} ${s*0.38} Q${s*0.76} ${s*0.50} ${s*0.74} ${s*0.68} L${s*0.68} ${s*0.64} Q${s*0.70} ${s*0.48} ${s*0.68} ${s*0.38} Q${s*0.5} ${s*0.34} ${s*0.32} ${s*0.38} Q${s*0.30} ${s*0.48} ${s*0.32} ${s*0.64} L${s*0.26} ${s*0.68} Q${s*0.24} ${s*0.50} ${s*0.27} ${s*0.38}" fill="${color}"/>`,
    'short-modern': `<path d="M${s*0.28} ${s*0.37} Q${s*0.30} ${s*0.20} ${s*0.5} ${s*0.18} Q${s*0.70} ${s*0.20} ${s*0.72} ${s*0.37} Q${s*0.69} ${s*0.29} ${s*0.66} ${s*0.37} L${s*0.63} ${s*0.44} Q${s*0.5} ${s*0.41} ${s*0.37} ${s*0.44} L${s*0.34} ${s*0.37} Q${s*0.31} ${s*0.29} ${s*0.28} ${s*0.37}" fill="${color}"/>`,
    'short-trendy': `<path d="M${s*0.29} ${s*0.37} Q${s*0.31} ${s*0.19} ${s*0.5} ${s*0.17} Q${s*0.69} ${s*0.19} ${s*0.71} ${s*0.37} Q${s*0.68} ${s*0.28} ${s*0.65} ${s*0.36} L${s*0.62} ${s*0.43} Q${s*0.5} ${s*0.40} ${s*0.38} ${s*0.43} L${s*0.35} ${s*0.36} Q${s*0.32} ${s*0.28} ${s*0.29} ${s*0.37}" fill="${color}"/>`,
    'short-styled': `<path d="M${s*0.28} ${s*0.36} Q${s*0.30} ${s*0.18} ${s*0.5} ${s*0.16} Q${s*0.70} ${s*0.18} ${s*0.72} ${s*0.36} Q${s*0.68} ${s*0.27} ${s*0.65} ${s*0.35} L${s*0.62} ${s*0.43} Q${s*0.5} ${s*0.40} ${s*0.38} ${s*0.43} L${s*0.35} ${s*0.35} Q${s*0.32} ${s*0.27} ${s*0.28} ${s*0.36}" fill="${color}"/>`,
    'long-loose': `<path d="M${s*0.27} ${s*0.37} Q${s*0.28} ${s*0.18} ${s*0.5} ${s*0.16} Q${s*0.72} ${s*0.18} ${s*0.73} ${s*0.37} Q${s*0.76} ${s*0.50} ${s*0.74} ${s*0.70} L${s*0.68} ${s*0.66} Q${s*0.70} ${s*0.48} ${s*0.68} ${s*0.37} Q${s*0.5} ${s*0.33} ${s*0.32} ${s*0.37} Q${s*0.30} ${s*0.48} ${s*0.32} ${s*0.66} L${s*0.26} ${s*0.70} Q${s*0.24} ${s*0.50} ${s*0.27} ${s*0.37}" fill="${color}"/>`,
    'long-tied': `<path d="M${s*0.27} ${s*0.37} Q${s*0.28} ${s*0.18} ${s*0.5} ${s*0.16} Q${s*0.72} ${s*0.18} ${s*0.73} ${s*0.37} Q${s*0.75} ${s*0.48} ${s*0.73} ${s*0.58} L${s*0.68} ${s*0.55} Q${s*0.70} ${s*0.45} ${s*0.68} ${s*0.37} Q${s*0.5} ${s*0.33} ${s*0.32} ${s*0.37} Q${s*0.30} ${s*0.45} ${s*0.32} ${s*0.55} L${s*0.27} ${s*0.58} Q${s*0.25} ${s*0.48} ${s*0.27} ${s*0.37}" fill="${color}"/>`,
    'long-young': `<path d="M${s*0.27} ${s*0.37} Q${s*0.29} ${s*0.17} ${s*0.5} ${s*0.15} Q${s*0.71} ${s*0.17} ${s*0.73} ${s*0.37} Q${s*0.76} ${s*0.52} ${s*0.74} ${s*0.72} L${s*0.68} ${s*0.68} Q${s*0.70} ${s*0.50} ${s*0.68} ${s*0.37} Q${s*0.5} ${s*0.33} ${s*0.32} ${s*0.37} Q${s*0.30} ${s*0.50} ${s*0.32} ${s*0.68} L${s*0.26} ${s*0.72} Q${s*0.24} ${s*0.52} ${s*0.27} ${s*0.37}" fill="${color}"/>`,
    'long-styled': `<path d="M${s*0.27} ${s*0.36} Q${s*0.29} ${s*0.17} ${s*0.5} ${s*0.15} Q${s*0.71} ${s*0.17} ${s*0.73} ${s*0.36} Q${s*0.76} ${s*0.50} ${s*0.74} ${s*0.68} L${s*0.68} ${s*0.64} Q${s*0.70} ${s*0.48} ${s*0.68} ${s*0.36} Q${s*0.5} ${s*0.32} ${s*0.32} ${s*0.36} Q${s*0.30} ${s*0.48} ${s*0.32} ${s*0.64} L${s*0.26} ${s*0.68} Q${s*0.24} ${s*0.50} ${s*0.27} ${s*0.36}" fill="${color}"/>`
  };
  return hairs[style] || hairs['short-modern'];
}

// 生成眼睛SVG
function generateEyesSVG(s, isMale, age, hash) {
  const eyeY = s * 0.43;
  const leftX = s/2 - s * 0.12;
  const rightX = s/2 + s * 0.12;
  const eyeSize = s * 0.035;
  
  // 眼角下垂程度（年龄越大越明显）
  const droop = age >= 50 ? 0.005 : (age >= 40 ? 0.003 : 0);
  
  return `
    <g>
      <path d="M${leftX-eyeSize} ${eyeY+droop*s} Q${leftX} ${eyeY-eyeSize*0.8} ${leftX+eyeSize} ${eyeY+droop*s} Q${leftX} ${eyeY+eyeSize*0.6} ${leftX-eyeSize} ${eyeY+droop*s}" fill="#FFF"/>
      <circle cx="${leftX}" cy="${eyeY}" r="${eyeSize*0.65}" fill="#5D4E3C"/>
      <circle cx="${leftX}" cy="${eyeY}" r="${eyeSize*0.35}" fill="#1A1A1A"/>
      <circle cx="${leftX+eyeSize*0.2}" cy="${eyeY-eyeSize*0.2}" r="${eyeSize*0.15}" fill="#FFF"/>
      
      <path d="M${rightX-eyeSize} ${eyeY+droop*s} Q${rightX} ${eyeY-eyeSize*0.8} ${rightX+eyeSize} ${eyeY+droop*s} Q${rightX} ${eyeY+eyeSize*0.6} ${rightX-eyeSize} ${eyeY+droop*s}" fill="#FFF"/>
      <circle cx="${rightX}" cy="${eyeY}" r="${eyeSize*0.65}" fill="#5D4E3C"/>
      <circle cx="${rightX}" cy="${eyeY}" r="${eyeSize*0.35}" fill="#1A1A1A"/>
      <circle cx="${rightX+eyeSize*0.2}" cy="${eyeY-eyeSize*0.2}" r="${eyeSize*0.15}" fill="#FFF"/>
      
      ${!isMale ? `
        <path d="M${leftX-eyeSize*1.2} ${eyeY} Q${leftX} ${eyeY-eyeSize*1.1} ${leftX+eyeSize*1.2} ${eyeY}" stroke="#333" stroke-width="0.7" fill="none"/>
        <path d="M${rightX-eyeSize*1.2} ${eyeY} Q${rightX} ${eyeY-eyeSize*1.1} ${rightX+eyeSize*1.2} ${eyeY}" stroke="#333" stroke-width="0.7" fill="none"/>
      ` : ''}
    </g>
  `;
}

// 生成眉毛SVG
function generateEyebrowsSVG(s, isMale, age, hairColor, hash) {
  const browY = s * 0.395;
  const spacing = s * 0.12;
  const width = s * 0.06;
  const thickness = isMale ? 0.015 : 0.012;
  
  // 眉毛形状（年龄影响）
  const arch = age >= 50 ? 0.008 : 0.012;
  
  return `
    <path d="M${s/2-spacing-width} ${browY+arch*s/2} Q${s/2-spacing} ${browY-arch*s} ${s/2-spacing+width} ${browY}" stroke="${hairColor}" stroke-width="${s*thickness}" fill="none" stroke-linecap="round"/>
    <path d="M${s/2+spacing-width} ${browY} Q${s/2+spacing} ${browY-arch*s} ${s/2+spacing+width} ${browY+arch*s/2}" stroke="${hairColor}" stroke-width="${s*thickness}" fill="none" stroke-linecap="round"/>
  `;
}

// 生成鼻子SVG
function generateNoseSVG(s, skinColor, hash) {
  return `
    <path d="M${s/2} ${s*0.45} Q${s/2-s*0.008} ${s*0.49} ${s/2-s*0.015} ${s*0.515}" stroke="${adjustColor(skinColor, -30)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="${s/2-s*0.012}" cy="${s*0.52}" rx="${s*0.018}" ry="${s*0.012}" fill="${adjustColor(skinColor, -15)}" opacity="0.4"/>
  `;
}

// 生成嘴巴SVG
function generateMouthSVG(s, isMale, age, hash) {
  const mouthY = s * 0.57;
  const width = s * 0.07;
  const color = isMale ? '#B8645A' : '#C97B8E';
  
  // 微笑程度（年轻人更明显）
  const smile = age >= 50 ? 0.008 : (age >= 35 ? 0.012 : 0.016);
  
  return `
    <path d="M${s/2-width} ${mouthY} Q${s/2} ${mouthY-smile*s} ${s/2+width} ${mouthY}" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M${s/2-width*0.7} ${mouthY+s*0.008} Q${s/2} ${mouthY+s*0.015} ${s/2+width*0.7} ${mouthY+s*0.008}" stroke="${color}" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.5"/>
  `;
}

// 生成眼镜SVG
function generateGlassesSVG(s, hash) {
  const lensY = s * 0.43;
  const spacing = s * 0.12;
  const radius = s * 0.055;
  
  return `
    <circle cx="${s/2-spacing}" cy="${lensY}" r="${radius}" stroke="#444" stroke-width="1.2" fill="rgba(200,220,255,0.15)"/>
    <circle cx="${s/2+spacing}" cy="${lensY}" r="${radius}" stroke="#444" stroke-width="1.2" fill="rgba(200,220,255,0.15)"/>
    <line x1="${s/2-spacing+radius}" y1="${lensY}" x2="${s/2+spacing-radius}" y2="${lensY}" stroke="#444" stroke-width="1.2"/>
    <line x1="${s/2-spacing-radius}" y1="${lensY}" x2="${s/2-spacing-radius-s*0.04}" y2="${lensY-s*0.02}" stroke="#444" stroke-width="1"/>
    <line x1="${s/2+spacing+radius}" y1="${lensY}" x2="${s/2+spacing+radius+s*0.04}" y2="${lensY-s*0.02}" stroke="#444" stroke-width="1"/>
  `;
}

// 生成年龄线条SVG
function generateAgeLinesSVG(s, age, hash) {
  const intensity = Math.min(1, (age - 45) / 30);
  return `
    <!-- 额头纹 -->
    <path d="M${s*0.42} ${s*0.35} Q${s*0.5} ${s*0.345} ${s*0.58} ${s*0.35}" stroke="rgba(0,0,0,0.15)" stroke-width="0.6" fill="none" opacity="${intensity}"/>
    <path d="M${s*0.43} ${s*0.37} Q${s*0.5} ${s*0.365} ${s*0.57} ${s*0.37}" stroke="rgba(0,0,0,0.12)" stroke-width="0.5" fill="none" opacity="${intensity}"/>
    <!-- 法令纹 -->
    <path d="M${s*0.44} ${s*0.52} Q${s*0.43} ${s*0.55} ${s*0.44} ${s*0.57}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" fill="none" opacity="${intensity}"/>
    <path d="M${s*0.56} ${s*0.52} Q${s*0.57} ${s*0.55} ${s*0.56} ${s*0.57}" stroke="rgba(0,0,0,0.1)" stroke-width="0.5" fill="none" opacity="${intensity}"/>
  `;
}

// 颜色调整辅助函数
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

// 根据年龄获取发色
function getHairColor(age) {
  const ageNum = parseInt(age) || 30;
  if (ageNum >= 60) {
    return '#C0C0C0'; // 灰色
  }
  const hairColors = ['#2C1810', '#4A3728', '#1A1A1A', '#3D2817', '#5C4033'];
  return hairColors[Math.floor(Math.random() * hairColors.length)];
}

// 根据用户信息获取衣服颜色
function getShirtColor(user) {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  let hash = 0;
  const str = (user.name || '') + (user.gender || '');
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

//  lighten color helper
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

// 获取用户姓名的首字用于头像显示
function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0);
}

// 渲染准备页面的用户头像卡片
function renderAudienceAvatars() {
  const container = document.getElementById('audienceAvatars');
  if (!container) return;
  
  if (currentAudienceList.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无调研用户，点击"管理用户"添加</div>';
    return;
  }
  
  const avatarsHtml = currentAudienceList.map((user, index) => {
    const avatarUrl = generateCartoonAvatar(user, 72);
    const summary = formatUserBriefSummary(user);
    const userTag = generateUserTag(user, index);
    
    return `
      <div class="audience-avatar-card" data-index="${index}">
        <img class="avatar-circle" src="${avatarUrl}" alt="${user.name || '用户'}" />
        <div class="avatar-label">${userTag}</div>
        <div class="avatar-tooltip">
          <div class="avatar-tooltip-title">${user.name || '未命名用户'}</div>
          <div class="avatar-tooltip-content">
            ${user.uniqueCode ? `<div><strong style="color:#f59e0b;">唯一识别码：</strong>${user.uniqueCode}</div>` : ''}
            ${user.gender ? `<div><strong>性别：</strong>${user.gender}</div>` : ''}
            ${user.age ? `<div><strong>年龄：</strong>${user.age}岁</div>` : ''}
            ${user.maritalStatus ? `<div><strong>婚姻：</strong>${user.maritalStatus}</div>` : ''}
            ${user.children ? `<div><strong>生育：</strong>${user.children}</div>` : ''}
            ${user.city ? `<div><strong>城市：</strong>${user.city}</div>` : ''}
            ${user.cityLevel ? `<div><strong>线级：</strong>${user.cityLevel}</div>` : ''}
            ${user.education ? `<div><strong>学历：</strong>${user.education}</div>` : ''}
            ${user.income ? `<div><strong>收入：</strong>${user.income}</div>` : ''}
            ${user.carOwnership ? `<div><strong>拥车：</strong>${user.carOwnership}</div>` : ''}
            ${user.currentCar ? `<div><strong>车辆：</strong>${user.currentCar}</div>` : ''}
            ${user.notes ? `<div><strong>备注：</strong>${user.notes}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = avatarsHtml;
}

// 格式化用户简要信息（用于tooltip）
function formatUserBriefSummary(user) {
  const parts = [];
  if (user.gender) parts.push(user.gender);
  if (user.age) parts.push(`${user.age}岁`);
  if (user.city) parts.push(user.city);
  return parts.join('，') || '暂无详细信息';
}

// 生成用户概括词标签
function generateUserTag(user, index) {
  // 智能分析用户特征，生成定制化标签
  const features = [];
  
  // 1. 基础身份特征
  const age = parseInt(user.age) || 0;
  const isMale = user.gender === '男';
  const isFemale = user.gender === '女';
  
  // 年龄阶段标签
  let ageLabel = '';
  if (age > 0) {
    if (age < 25) ageLabel = 'Z世代';
    else if (age < 30) ageLabel = '95后';
    else if (age < 35) ageLabel = '90后';
    else if (age < 40) ageLabel = '85后';
    else if (age < 45) ageLabel = '80后';
    else if (age < 50) ageLabel = '75后';
    else if (age < 60) ageLabel = '70后';
    else ageLabel = '银发族';
  }
  
  // 2. 家庭状态标签
  let familyLabel = '';
  if (user.maritalStatus === '已婚' && user.children && user.children !== '无子女') {
    if (isMale) {
      familyLabel = '宝爸';
    } else if (isFemale) {
      familyLabel = '宝妈';
    } else {
      familyLabel = '家长';
    }
    // 根据孩子数量细化
    if (user.children === '2个孩子') familyLabel = '二孩家长';
    else if (user.children === '3个及以上') familyLabel = '多孩家长';
  } else if (user.maritalStatus === '已婚' && (!user.children || user.children === '无子女')) {
    familyLabel = '丁克家庭';
  } else if (user.maritalStatus === '未婚') {
    if (age < 30) {
      familyLabel = isFemale ? '单身小姐姐' : '单身小哥哥';
    } else {
      familyLabel = isFemale ? '独立女性' : '钻石王老五';
    }
  } else if (user.maritalStatus === '离异') {
    familyLabel = isFemale ? '离异女士' : '离异先生';
  }
  
  // 3. 职业/收入水平标签
  let incomeLabel = '';
  if (user.income) {
    if (user.income.includes('100万以上')) incomeLabel = '高净值人群';
    else if (user.income.includes('50-100万')) incomeLabel = '富裕阶层';
    else if (user.income.includes('30-50万')) incomeLabel = '中产精英';
    else if (user.income.includes('20-30万')) incomeLabel = '小康家庭';
    else if (user.income.includes('10-20万')) incomeLabel = '工薪阶层';
    else if (user.income.includes('10万以下')) incomeLabel = '经济实惠型';
  }
  
  // 4. 教育背景标签
  let educationLabel = '';
  if (user.education) {
    if (user.education === '博士及以上') educationLabel = '博士';
    else if (user.education === '硕士') educationLabel = '硕士';
    else if (user.education === '本科') educationLabel = '本科';
    else if (user.education === '大专') educationLabel = '大专';
  }
  
  // 5. 城市层级标签
  let cityLabel = '';
  if (user.cityLevel) {
    if (user.cityLevel === '一线') cityLabel = '一线城市';
    else if (user.cityLevel === '二线') cityLabel = '二线城市';
    else if (user.cityLevel === '三线') cityLabel = '三线城市';
    else cityLabel = '下沉市场';
  }
  
  // 6. 拥车状态标签
  let carLabel = '';
  if (user.carOwnership) {
    if (user.carOwnership === '无车') carLabel = '首购用户';
    else if (user.carOwnership === '1辆新能源车') carLabel = '新能源车主';
    else if (user.carOwnership === '1辆燃油车') carLabel = '燃油车主';
    else if (user.carOwnership === '多辆车') carLabel = '多车家庭';
  }
  
  // 7. 组合智能标签（选择最有代表性的2-3个特征）
  const tagParts = [];
  
  // 优先添加家庭身份（如果有的话）
  if (familyLabel) tagParts.push(familyLabel);
  
  // 添加年龄代际
  if (ageLabel) tagParts.push(ageLabel);
  
  // 如果有高收入或高学历，添加
  if (incomeLabel && (incomeLabel.includes('高净值') || incomeLabel.includes('富裕'))) {
    tagParts.push(incomeLabel);
  }
  if (educationLabel && (educationLabel === '博士' || educationLabel === '硕士')) {
    tagParts.push(educationLabel);
  }
  
  // 如果标签太少，补充城市和拥车信息
  if (tagParts.length < 2 && cityLabel) tagParts.push(cityLabel);
  if (tagParts.length < 2 && carLabel) tagParts.push(carLabel);
  if (tagParts.length < 2 && incomeLabel) tagParts.push(incomeLabel);
  
  // 如果还是没有足够标签，使用默认
  if (tagParts.length === 0) {
    if (isFemale) tagParts.push('女性用户');
    else if (isMale) tagParts.push('男性用户');
    else tagParts.push('潜在用户');
  }
  
  // 组合成最终标签
  return `${index + 1}号用户 ${tagParts.slice(0, 3).join('·')}`;
}

// 切换调研对象表单展开/收起
function toggleAudienceForm() {
  const container = document.getElementById("audienceFormContainer");
  if (container) {
    const isHidden = container.style.display === "none";
    container.style.display = isHidden ? "grid" : "none";
  }
}

// ===== 调研用户管理模态框功能 =====
var editingUserIndex = -1; // -1 表示新增，>=0 表示编辑现有用户

// 打开模态框
function openAudienceModal() {
  console.log('openAudienceModal called');
  const modal = document.getElementById('audienceModal');
  console.log('modal element:', modal);
  if (modal) {
    modal.classList.remove('hidden');
    renderUserList();
    hideUserEditForm();
  }
}

// 关闭模态框
function closeAudienceModal() {
  const modal = document.getElementById('audienceModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 渲染用户列表
function renderUserList() {
  const container = document.getElementById('userListContainer');
  if (!container) return;
  
  if (currentAudienceList.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无用户，点击下方按钮添加</div>';
    return;
  }
  
  const listHtml = currentAudienceList.map((user, index) => {
    const avatarUrl = generateCartoonAvatar(user, 48);
    const summary = formatUserBriefSummary(user);
    const codeDisplay = user.uniqueCode
      ? `<span class="user-unique-code" title="唯一识别码">${user.uniqueCode}</span>`
      : '';

    return `
      <div class="user-list-item">
        <img class="user-list-avatar" src="${avatarUrl}" alt="${user.name || '用户'}" />
        <div class="user-list-info">
          <div class="user-list-name">${user.name || '未命名用户'}${codeDisplay ? ' ' + codeDisplay : ''}</div>
          <div class="user-list-summary">${summary}</div>
        </div>
        <div class="user-list-actions">
          <button onclick="editUser(${index})">编辑</button>
          <button class="delete-btn" onclick="deleteUser(${index})">删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = listHtml;
}

// 显示用户编辑表单
function showUserEditForm(isEdit = false) {
  const form = document.getElementById('userEditForm');
  const title = document.getElementById('userEditTitle');
  if (form) form.classList.remove('hidden');
  if (title) title.textContent = isEdit ? '编辑用户' : '添加用户';
}

// 隐藏用户编辑表单
function hideUserEditForm() {
  const form = document.getElementById('userEditForm');
  if (form) form.classList.add('hidden');
  clearUserEditForm();
  editingUserIndex = -1;
}

// 清空编辑表单
function clearUserEditForm() {
  const fields = [
    'editAudienceUniqueCode', 'editAudienceName', 'editAudienceGender',
    'editAudienceAge', 'editAudienceMarital', 'editAudienceChildren',
    'editAudienceCity', 'editAudienceCityLevel', 'editAudienceEducation',
    'editAudienceIncome', 'editAudienceCarOwnership', 'editAudienceCurrentCar',
    'editAudienceNotes'
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// 从表单获取用户数据
function getUserFromEditForm() {
  return {
    uniqueCode: document.getElementById('editAudienceUniqueCode')?.value || '',
    name: document.getElementById('editAudienceName')?.value || '',
    gender: document.getElementById('editAudienceGender')?.value || '',
    age: document.getElementById('editAudienceAge')?.value || '',
    maritalStatus: document.getElementById('editAudienceMarital')?.value || '',
    children: document.getElementById('editAudienceChildren')?.value || '',
    city: document.getElementById('editAudienceCity')?.value || '',
    cityLevel: document.getElementById('editAudienceCityLevel')?.value || '',
    education: document.getElementById('editAudienceEducation')?.value || '',
    income: document.getElementById('editAudienceIncome')?.value || '',
    carOwnership: document.getElementById('editAudienceCarOwnership')?.value || '',
    currentCar: document.getElementById('editAudienceCurrentCar')?.value || '',
    notes: document.getElementById('editAudienceNotes')?.value || ''
  };
}

// 设置表单数据
function setUserToEditForm(user) {
  const fields = {
    editAudienceUniqueCode: user.uniqueCode || '',
    editAudienceName: user.name,
    editAudienceGender: user.gender,
    editAudienceAge: user.age,
    editAudienceMarital: user.maritalStatus,
    editAudienceChildren: user.children,
    editAudienceCity: user.city,
    editAudienceCityLevel: user.cityLevel,
    editAudienceEducation: user.education,
    editAudienceIncome: user.income,
    editAudienceCarOwnership: user.carOwnership,
    editAudienceCurrentCar: user.currentCar,
    editAudienceNotes: user.notes
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

// 编辑用户
function editUser(index) {
  editingUserIndex = index;
  const user = currentAudienceList[index];
  setUserToEditForm(user);
  showUserEditForm(true);
}

// 删除用户
function deleteUser(index) {
  if (confirm('确定要删除这个用户吗？')) {
    currentAudienceList.splice(index, 1);
    triggerInsightSave();
    renderUserList();
    renderAudienceAvatars();
  }
}

// 保存用户
function saveUser() {
  const userData = getUserFromEditForm();

  if (!userData.name) {
    alert('请输入用户姓名');
    return;
  }

  if (editingUserIndex >= 0) {
    // 编辑现有用户
    currentAudienceList[editingUserIndex] = userData;
  } else {
    // 新增用户，自动生成唯一识别码
    if (!userData.uniqueCode) {
      userData.uniqueCode = generateUniqueCode();
    }
    currentAudienceList.push(userData);
  }

  // ★ 自动同步：用户新增/编辑后，同步到共享数据桥
  // 同时更新全局 userSamples 和推送到 SharedDataStore
  var existingInSamples = false;
  for (var i = 0; i < userSamples.length; i++) {
    if (userSamples[i].id === userData.id || 
        (userData.uniqueCode && userSamples[i].uniqueCode === userData.uniqueCode)) {
      userSamples[i] = Object.assign({}, userData, { sessionId: currentSession ? currentSession.id : '' });
      existingInSamples = true;
      break;
    }
  }
  if (!existingInSamples) {
    userSamples.push(Object.assign({}, userData, { sessionId: currentSession ? currentSession.id : '' }));
  }
  autoSyncUserSamplesToBridge();
  triggerInsightSave();

  renderUserList();
  renderAudienceAvatars();
  hideUserEditForm();
}

// 添加新用户
function addNewUser() {
  editingUserIndex = -1;
  clearUserEditForm();
  showUserEditForm(false);
}

// 根据唯一识别码关联已有用户
function linkUserByCode() {
  const codeInput = document.getElementById('linkUserCodeInput');
  const code = codeInput?.value?.trim();
  if (!code) {
    alert('请输入唯一识别码');
    return;
  }

  // 在全局 userSamples 中查找该用户
  const foundUser = userSamples.find(u => u.uniqueCode === code);
  if (!foundUser) {
    alert('未找到该识别码对应的用户，请检查输入');
    return;
  }

  // 填充用户信息到表单（保留新识别码）
  const newUniqueCode = generateUniqueCode();
  const fields = {
    editAudienceUniqueCode: newUniqueCode,
    editAudienceName: foundUser.name || '',
    editAudienceGender: foundUser.gender || '',
    editAudienceAge: String(foundUser.age || ''),
    editAudienceMarital: foundUser.maritalStatus || '',
    editAudienceChildren: foundUser.children || '',
    editAudienceCity: foundUser.city || '',
    editAudienceCityLevel: foundUser.cityLevel || '',
    editAudienceEducation: foundUser.education || '',
    editAudienceIncome: foundUser.income || '',
    editAudienceCarOwnership: foundUser.carOwnership || '',
    editAudienceCurrentCar: foundUser.currentCar || '',
    editAudienceNotes: (foundUser.notes ? foundUser.notes + '\n\n【关联记录】关联自用户 ' + code : '')
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  // 清空关联输入框
  codeInput.value = '';
  alert(`已关联用户：${foundUser.name || foundUser.id}，已自动填充历史信息`);
}

// ===== 长安品牌判断函数 =====
const CHANGAN_BRANDS = ['长安', '启源', '深蓝', '阿维塔', '凯程'];
const CHANGAN_BRAND_MAP = {
  '长安V标': ['长安'],
  '长安启源': ['启源'],
  '深蓝': ['深蓝'],
  '阿维塔': ['阿维塔'],
  '凯程': ['凯程']
};

function isChanganCar(carName) {
  if (!carName) return false;
  return CHANGAN_BRANDS.some(brand => carName.includes(brand));
}

function getChanganBrandType(carName) {
  if (!carName) return null;
  for (const [brandType, keywords] of Object.entries(CHANGAN_BRAND_MAP)) {
    if (keywords.some(k => carName.includes(k))) {
      return brandType;
    }
  }
  return null;
}

function getUserChanganStatus(user) {
  const hasChanganCar = isChanganCar(user.currentCar);
  // 简化为：有长安车则视为现车主，否则视为非长安车主
  // 注："前车主"需要历史数据支持，当前简化处理
  if (hasChanganCar) {
    return { status: 'current-changan', brand: getChanganBrandType(user.currentCar) };
  }
  return { status: 'non-changan', brand: null };
}

// ===== 用户样本库功能函数 =====
function renderUserSamples() {
  const productFilter = document.getElementById("userProductFilter")?.value || "";
  const typeFilter = document.getElementById("userTypeFilter")?.value || "";
  const startDate = document.getElementById("userStartDate")?.value || "";
  const endDate = document.getElementById("userEndDate")?.value || "";
  const ageRange = document.getElementById("userAgeRange")?.value || "";
  const genderFilter = document.getElementById("userGenderFilter")?.value || "";
  const maritalFilter = document.getElementById("userMaritalFilter")?.value || "";
  const cityLevelFilter = document.getElementById("userCityLevelFilter")?.value || "";
  const changanFilter = document.getElementById("userChanganOwnerFilter")?.value || "";
  const changanBrandFilter = document.getElementById("userChanganBrandFilter")?.value || "";
  
  // ★ 只展示已完成调研的用户（调研状态为"已完成"的场次中的用户）
  const completedSamples = getCompletedUserSamples();
  
  const filtered = completedSamples.filter(user => {
    const productMatch = !productFilter || user.product === productFilter;
    const typeMatch = !typeFilter || user.researchType === typeFilter;
    
    let dateMatch = true;
    if (startDate) dateMatch = dateMatch && user.researchDate >= startDate;
    if (endDate) dateMatch = dateMatch && user.researchDate <= endDate;
    
    let ageMatch = true;
    if (ageRange) {
      const [min, max] = ageRange.split("-").map(Number);
      ageMatch = user.age >= min && user.age <= max;
    }
    
    const genderMatch = !genderFilter || user.gender === genderFilter;
    const maritalMatch = !maritalFilter || user.maritalStatus === maritalFilter;
    const cityMatch = !cityLevelFilter || user.cityLevel === cityLevelFilter;
    
    // 长安车主筛选
    let changanMatch = true;
    const userStatus = getUserChanganStatus(user);
    if (changanFilter) {
      if (changanFilter === 'non-changan') {
        changanMatch = userStatus.status === 'non-changan';
      } else if (changanFilter === 'current-changan') {
        changanMatch = userStatus.status === 'current-changan';
      } else if (changanFilter === 'former-changan') {
        // 简化：当前数据中无法精确判断前车主，暂按非现车主处理
        changanMatch = userStatus.status === 'non-changan';
      }
    }
    
    // 长安品牌筛选
    let changanBrandMatch = true;
    if (changanBrandFilter && (changanFilter === 'current-changan' || changanFilter === 'former-changan')) {
      changanBrandMatch = userStatus.brand === changanBrandFilter;
    }
    
    return productMatch && typeMatch && dateMatch && ageMatch && genderMatch && maritalMatch && cityMatch && changanMatch && changanBrandMatch;
  });
  
  const container = document.getElementById("userSampleList");
  if (!container) return;
  
  container.innerHTML = filtered.map(user => `
    <div class="user-sample-item" data-user-id="${user.id}" onclick="openUserDetail('${user.id}')">
      <span class="user-id">${user.id}</span>
      <span class="user-info-preview">
        ${user.age}岁 · ${user.gender} · ${user.cityLevel}线
      </span>
      <div class="user-hover-detail">
        <h4>${user.id} 用户档案</h4>
        <dl>
          <dt>唯一识别码</dt><dd style="color:#f59e0b;font-weight:600;">${user.uniqueCode || '-'}</dd>
          <dt>年龄</dt><dd>${user.age}岁</dd>
          <dt>性别</dt><dd>${user.gender}</dd>
          <dt>婚姻状况</dt><dd>${user.maritalStatus}</dd>
          <dt>城市线级</dt><dd>${user.cityLevel}线</dd>
          <dt>是否有子女</dt><dd>${user.hasChildren ? '是' : '否'}</dd>
          <dt>参与产品</dt><dd>${user.product}</dd>
          <dt>调研类型</dt><dd>${user.researchType}</dd>
          <dt>调研日期</dt><dd>${user.researchDate}</dd>
          <dt>场次编号</dt><dd>${user.sessionId}</dd>
          <dt>完成问卷</dt><dd>${user.surveysCompleted.length > 0 ? user.surveysCompleted.join(', ') : '无'}</dd>
        </dl>
      </div>
    </div>
  `).join("") || `<div class="empty-state"><p>暂无符合条件的用户样本</p></div>`;
  
  // 更新统计
  document.getElementById("userSampleCount").textContent = filtered.length;
}

// ===== 用户样本库数据结束 =====

// 为 userSamples 中的用户自动生成唯一识别码
userSamples.forEach((user, index) => {
  if (!user.uniqueCode) {
    const dateStr = user.researchDate?.replace(/-/g, '') || '20260518';
    user.uniqueCode = `USR-${dateStr}-${String(index + 1).padStart(3, '0')}`;
  }
});

// ★ 首次加载时自动将初始用户样本推送到共享数据桥
setTimeout(function() {
  autoSyncUserSamplesToBridge();
}, 500);

// ===== 用户样本库事件监听器 =====
document.getElementById("userProductFilter")?.addEventListener("change", renderUserSamples);
document.getElementById("userTypeFilter")?.addEventListener("change", renderUserSamples);
document.getElementById("userStartDate")?.addEventListener("change", renderUserSamples);
document.getElementById("userEndDate")?.addEventListener("change", renderUserSamples);
document.getElementById("userAgeRange")?.addEventListener("change", renderUserSamples);
document.getElementById("userGenderFilter")?.addEventListener("change", renderUserSamples);
document.getElementById("userMaritalFilter")?.addEventListener("change", renderUserSamples);
document.getElementById("userCityLevelFilter")?.addEventListener("change", renderUserSamples);

// 长安车主筛选器事件
document.getElementById("userChanganOwnerFilter")?.addEventListener("change", function() {
  const brandLabel = document.getElementById("changanBrandLabel");
  const brandFilter = document.getElementById("userChanganBrandFilter");
  const value = this.value;
  
  if (value === 'current-changan' || value === 'former-changan') {
    brandLabel.style.display = '';
  } else {
    brandLabel.style.display = 'none';
    if (brandFilter) brandFilter.value = '';
  }
  renderUserSamples();
});

document.getElementById("userChanganBrandFilter")?.addEventListener("change", renderUserSamples);

document.getElementById("clearUserFiltersBtn")?.addEventListener("click", () => {
  document.getElementById("userProductFilter").value = "";
  document.getElementById("userTypeFilter").value = "";
  document.getElementById("userStartDate").value = "";
  document.getElementById("userEndDate").value = "";
  document.getElementById("userAgeRange").value = "";
  document.getElementById("userGenderFilter").value = "";
  document.getElementById("userMaritalFilter").value = "";
  document.getElementById("userCityLevelFilter").value = "";
  document.getElementById("userChanganOwnerFilter").value = "";
  document.getElementById("userChanganBrandFilter").value = "";
  document.getElementById("changanBrandLabel").style.display = 'none';
  renderUserSamples();
});

// ===== 调研对象表单事件监听器 =====
// 管理用户按钮
document.getElementById("manageAudienceBtn")?.addEventListener("click", openAudienceModal);
document.getElementById("closeAudienceModal")?.addEventListener("click", closeAudienceModal);
document.getElementById("addUserBtn")?.addEventListener("click", addNewUser);
document.getElementById("saveUserBtn")?.addEventListener("click", saveUser);
document.getElementById("cancelEditUserBtn")?.addEventListener("click", hideUserEditForm);

// 点击模态框背景关闭
document.getElementById("audienceModal")?.addEventListener("click", (e) => {
  if (e.target.id === 'audienceModal') {
    closeAudienceModal();
  }
});

// ===== 定量调研模块事件监听器 =====
document.getElementById("createSurveyBtn")?.addEventListener("click", () => openSurveyEditor());
document.getElementById("addQuestionBtn")?.addEventListener("click", addNewQuestion);
document.getElementById("saveSurveyBtn")?.addEventListener("click", () => {
  // ★ 自动同步：问卷保存后，将已完成调研的用户样本推送到共享数据桥
  autoSyncUserSamplesToBridge();
  var completedCount = getCompletedUserSamples().length;
  alert("问卷已保存！已完成调研的 " + completedCount + " 个用户样本已自动同步，虚拟消费者平台将自动更新数字分身。");
});
document.getElementById("previewSurveyBtn")?.addEventListener("click", () => {
  alert("预览功能（演示）");
});
document.getElementById("exportDataBtn")?.addEventListener("click", () => {
  alert("数据导出功能（演示）");
});
document.getElementById("surveyStatusFilter")?.addEventListener("change", renderSurveys);
document.getElementById("surveyTypeFilter")?.addEventListener("change", renderSurveys);

// 将函数暴露到全局以便onclick调用
window.removeQuestion = removeQuestion;

// ===== 初始化定量调研模块 =====
renderSurveys();
renderUserSamples();

// ===== 用户详情页功能 =====
let currentDetailUser = null;

function openUserDetail(userId) {
  const user = userSamples.find(u => u.id === userId);
  if (!user) return;
  currentDetailUser = user;
  renderUserDetail(user);
  setView('userDetail');
  renderPersonaSubNav();
}

function closeUserDetail() {
  currentDetailUser = null;
  setView('persona');
  hidePersonaSubNav();
}

function renderPersonaSubNav() {
  const container = document.getElementById('personaSubNavContainer');
  const subNav = document.getElementById('personaSubNav');

  if (!currentDetailUser) {
    container.style.display = 'none';
    return;
  }

  subNav.innerHTML = `
    <button class="sub-nav-item active" type="button" data-persona-user="${currentDetailUser.id}">
      <span class="sub-nav-item-content">
        <span class="sub-nav-icon">👤</span>
        ${currentDetailUser.uniqueCode || currentDetailUser.id}
      </span>
      <span class="sub-nav-close" data-close-persona="${currentDetailUser.id}" title="关闭此标签">×</span>
    </button>
  `;

  // 点击二级导航项（关闭按钮除外）可重新打开用户详情
  subNav.querySelectorAll(".sub-nav-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.classList.contains("sub-nav-close")) return;
      openUserDetail(btn.dataset.personaUser);
    });
  });

  // 关闭按钮事件
  subNav.querySelectorAll(".sub-nav-close").forEach(closeBtn => {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeUserDetail();
    });
  });

  container.style.display = 'block';
}

function hidePersonaSubNav() {
  const container = document.getElementById('personaSubNavContainer');
  if (container) {
    container.style.display = 'none';
  }
}

// 根据用户特征生成消费理念
function getConsumptionPhilosophy(user) {
  const philosophies = [];
  const age = parseInt(user.age) || 30;
  const income = user.income || '';
  const cityLevel = user.cityLevel || '';
  const education = user.education || '';

  // 消费理念判断
  if (income.includes('50-100万') || income.includes('100万以上')) {
    philosophies.push({ label: '品质优先', desc: '注重产品体验和品牌调性，愿意为更好的服务和体验支付溢价' });
  } else if (income.includes('30-50万')) {
    philosophies.push({ label: '理性消费', desc: '在预算范围内追求性价比，注重实用价值和长期回报' });
  } else {
    philosophies.push({ label: '务实节俭', desc: '注重基础功能和价格，对额外付费功能较为谨慎' });
  }

  if (cityLevel === '一线') {
    philosophies.push({ label: '科技尝鲜', desc: '对新科技和智能化配置保持高度关注，愿意为创新买单' });
  } else if (cityLevel === '二线') {
    philosophies.push({ label: '均衡务实', desc: '兼顾品质与实用性，重视口碑和身边人的推荐' });
  } else {
    philosophies.push({ label: '保守稳重', desc: '偏好成熟可靠的产品，对新事物持观望态度' });
  }

  if (education === '硕士' || education === '博士及以上') {
    philosophies.push({ label: '深度研究', desc: '购车前会深入了解技术参数和行业信息，决策理性' });
  }

  return philosophies;
}

// 根据用户特征生成车辆偏好
function getVehiclePreference(user) {
  const preferences = [];
  const age = parseInt(user.age) || 30;
  const maritalStatus = user.maritalStatus || '';
  const children = user.children || '';
  const carOwnership = user.carOwnership || '';
  const income = user.income || '';

  if (maritalStatus === '已婚' && (children === '1个孩子' || children === '2个孩子')) {
    preferences.push({ label: '大空间SUV', desc: '需要满足家庭出行的空间需求，后排和后备箱空间是核心考量' });
    preferences.push({ label: '安全性能', desc: '关注车辆安全配置，特别是儿童安全座椅、辅助驾驶等功能' });
  }

  if (carOwnership === '无车') {
    preferences.push({ label: '首购入门', desc: '作为第一辆车，注重易用性和后期维护成本' });
  } else if (carOwnership === '1辆燃油车') {
    preferences.push({ label: '新能源升级', desc: '考虑从燃油车切换到新能源车，关注续航和充电便利性' });
  }

  if (age < 30) {
    preferences.push({ label: '智能科技', desc: '对智能座舱、语音交互、智能驾驶等功能有较高期待' });
  } else if (age > 40) {
    preferences.push({ label: '舒适驾乘', desc: '注重驾乘舒适性和静谧性，对座椅、悬挂有更高要求' });
  }

  if (income.includes('50-100万') || income.includes('100万以上')) {
    preferences.push({ label: '豪华品牌', desc: '倾向于选择品牌影响力强、口碑好的中高端车型' });
  }

  return preferences;
}

// 根据用户特征生成购车决策因素
function getDecisionFactors(user) {
  const factors = [];
  const age = parseInt(user.age) || 30;
  const maritalStatus = user.maritalStatus || '';
  const income = user.income || '';
  const notes = user.notes || '';

  if (notes.includes('续航')) {
    factors.push({ label: '续航里程', weight: '高', desc: '实际续航里程是首要关注点，特别关注冬季续航表现' });
  }
  if (notes.includes('空间') || notes.includes('亲子')) {
    factors.push({ label: '空间表现', weight: '高', desc: '车内空间布局和储物能力是影响决策的重要因素' });
  }
  if (notes.includes('智能') || notes.includes('座舱')) {
    factors.push({ label: '智能配置', weight: '中', desc: '智能座舱功能和交互体验是重要的加分项' });
  }
  if (notes.includes('品牌')) {
    factors.push({ label: '品牌信任', weight: '高', desc: '品牌口碑和售后服务是重要决策依据' });
  }
  if (notes.includes('价格') || notes.includes('预算')) {
    factors.push({ label: '价格区间', weight: '高', desc: '购车预算和性价比是核心考量因素' });
  }

  if (factors.length === 0) {
    factors.push({ label: '综合体验', weight: '中', desc: '综合考虑车辆性能、品牌、价格等多维度因素' });
    factors.push({ label: '口碑推荐', weight: '中', desc: '参考身边亲友和网上的真实使用反馈' });
  }

  return factors;
}

// 生成写实风格头像（基于用户特征）
function generateRealisticAvatar(user, size = 200) {
  // 使用现有的 generateCartoonAvatar 函数，但增强特征表达
  const avatarUrl = generateCartoonAvatar(user, size);
  return avatarUrl;
}

// 渲染用户详情页
function renderUserDetail(user) {
  const container = document.getElementById('userDetailContainer');
  if (!container) return;

  const avatarUrl = generateRealisticAvatar(user, 200);
  const philosophies = getConsumptionPhilosophy(user);
  const preferences = getVehiclePreference(user);
  const factors = getDecisionFactors(user);

  // 查找该用户参与的所有调研场次
  const userSessions = userSamples.filter(u => u.uniqueCode === user.uniqueCode);
  const sessionIds = [...new Set(userSessions.map(u => u.sessionId))];

  container.innerHTML = `
    <div class="user-detail-layout">
      <div class="user-detail-left">
        <div class="user-detail-avatar">
          <img src="${avatarUrl}" alt="${user.name}" />
        </div>
        <div class="user-detail-card">
          <h3>${user.name || user.id}</h3>
          <div class="user-detail-meta">
            <div><span>唯一识别码</span><strong>${user.uniqueCode || '-'}</strong></div>
            <div><span>性别</span><strong>${user.gender || '-'}</strong></div>
            <div><span>年龄</span><strong>${user.age}岁</strong></div>
            <div><span>婚姻</span><strong>${user.maritalStatus || '-'}</strong></div>
            <div><span>子女</span><strong>${user.children || '-'}</strong></div>
            <div><span>城市</span><strong>${user.city || '-'} (${user.cityLevel || '-'}线)</strong></div>
            <div><span>教育</span><strong>${user.education || '-'}</strong></div>
            <div><span>收入</span><strong>${user.income || '-'}</strong></div>
            <div><span>拥车</span><strong>${user.carOwnership || '-'}</strong></div>
            <div><span>当前车辆</span><strong>${user.currentCar || '无'}</strong></div>
          </div>
        </div>
      </div>
      <div class="user-detail-right">
        <div class="user-detail-section">
          <h3><span class="section-icon">&#128161;</span> 消费理念</h3>
          <div class="detail-tags">
            ${philosophies.map(p => `<div class="detail-tag"><strong>${p.label}</strong><span>${p.desc}</span></div>`).join('')}
          </div>
        </div>
        <div class="user-detail-section">
          <h3><span class="section-icon">&#128663;</span> 车辆偏好</h3>
          <div class="detail-tags">
            ${preferences.map(p => `<div class="detail-tag"><strong>${p.label}</strong><span>${p.desc}</span></div>`).join('')}
          </div>
        </div>
        <div class="user-detail-section">
          <h3><span class="section-icon">&#128200;</span> 购车决策因素</h3>
          <div class="detail-factors">
            ${factors.map(f => `<div class="detail-factor"><span class="factor-label">${f.label}</span><span class="factor-weight weight-${f.weight.toLowerCase()}">${f.weight}</span><span class="factor-desc">${f.desc}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="user-sessions-section">
      <h3><span class="section-icon">&#128197;</span> 参与调研记录</h3>
      ${sessionIds.length > 0 ? `
        <div class="session-timeline">
          ${sessionIds.map(sid => {
            const session = researchSessions.find(s => s.id === sid);
            const sessionUser = userSessions.find(u => u.sessionId === sid);
            if (!session) return '';
            return `
              <div class="session-timeline-item" onclick="openSessionFromDetail('${sid}')">
                <div class="session-timeline-dot"></div>
                <div class="session-timeline-content">
                  <div class="session-timeline-header">
                    <strong>${session.id} ${session.product}</strong>
                    <span class="session-timeline-type">${session.type}</span>
                  </div>
                  <div class="session-timeline-meta">
                    <span>${session.time}</span>
                    <span class="session-status ${session.status === '已完成' ? 'done' : session.status === '进行中' ? 'ongoing' : 'pending'}">${session.status}</span>
                  </div>
                  <div class="session-timeline-goal">${session.goal}</div>
                  ${sessionUser?.notes ? `<div class="session-timeline-notes"><strong>用户备注：</strong>${sessionUser.notes}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<p class="empty-state">暂无调研记录</p>'}
    </div>
  `;
}

// 从用户详情页跳转到调研场次
function openSessionFromDetail(sessionId) {
  closeUserDetail();
  openSessionDetail(sessionId);
}

// 将函数暴露到全局
window.openUserDetail = openUserDetail;
window.closeUserDetail = closeUserDetail;
window.openSessionFromDetail = openSessionFromDetail;
window.openGroupUsersModal = openGroupUsersModal;
window.closeGroupUsersModal = closeGroupUsersModal;

// ===== 用户洞察模块 =====

// 人生阶段定义
const LIFE_STAGES = [
  { id: 'unmarried-female', label: '未婚女性', desc: '未婚女性用户' },
  { id: 'unmarried-male', label: '未婚男性', desc: '未婚男性用户' },
  { id: 'married-no-child-female', label: '已婚未育女性', desc: '已婚暂无子女的女性' },
  { id: 'married-no-child-male', label: '已婚未育男性', desc: '已婚暂无子女的男性' },
  { id: 'has-children', label: '有孩男女', desc: '已婚有子女的家庭' },
  { id: 'children-grown', label: '已婚子女成年', desc: '子女已成年的家庭' },
  { id: 'retired', label: '退休', desc: '已退休人群' }
];

// 价值观定义
const VALUE_ORIENTATIONS = ['保守', '稳健', '前卫'];

// 购买力定义
const PURCHASING_POWER_LEVELS = ['10万以下', '10-20万', '20-30万', '30万以上'];

// 根据用户ID哈希分配价值观（保持结果稳定）
function getUserValueOrientation(user) {
  const hash = stringHash(user.id);
  const index = Math.abs(hash) % VALUE_ORIENTATIONS.length;
  return VALUE_ORIENTATIONS[index];
}

// 简单字符串哈希
function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// 判断用户人生阶段
function getUserLifeStage(user) {
  const age = parseInt(user.age) || 0;
  const gender = user.gender;
  const marital = user.maritalStatus;
  const children = user.children;

  // 优先级：退休 > 已婚子女成年 > 有孩 > 已婚未育 > 未婚
  if (age >= 60) {
    return 'retired';
  }

  if (age >= 50 && marital === '已婚' && children !== '无子女') {
    return 'children-grown';
  }

  if (marital === '已婚' && (children === '1个孩子' || children === '2个孩子' || children === '3个及以上')) {
    return 'has-children';
  }

  if (marital === '已婚' && (children === '无子女' || children === '计划中')) {
    if (gender === '女') return 'married-no-child-female';
    return 'married-no-child-male';
  }

  if (marital === '未婚') {
    if (gender === '女') return 'unmarried-female';
    return 'unmarried-male';
  }

  // 默认处理
  if (gender === '女') return 'unmarried-female';
  return 'unmarried-male';
}

// 判断用户购买力
function getUserPurchasingPower(user) {
  const income = user.income || '';
  if (income.includes('10万以下')) return '10万以下';
  if (income.includes('10-20万')) return '10-20万';
  if (income.includes('20-30万')) return '20-30万';
  if (income.includes('30万') || income.includes('50万') || income.includes('100万')) return '30万以上';
  return '10万以下';
}

// 增强用户数据（添加推断字段）
function enrichUserData() {
  userSamples.forEach(user => {
    if (!user._lifeStage) {
      user._lifeStage = getUserLifeStage(user);
    }
    if (!user._valueOrientation) {
      user._valueOrientation = getUserValueOrientation(user);
    }
    if (!user._purchasingPower) {
      user._purchasingPower = getUserPurchasingPower(user);
    }
  });
}

// 根据筛选条件过滤用户
function filterInsightUsers() {
  const yearFilter = document.getElementById('insightYearFilter')?.value || '';
  const ageFilter = document.getElementById('insightAgeFilter')?.value || '';
  const genderFilter = document.getElementById('insightGenderFilter')?.value || '';
  const maritalFilter = document.getElementById('insightMaritalFilter')?.value || '';
  const childrenFilter = document.getElementById('insightChildrenFilter')?.value || '';
  const cityLevelFilter = document.getElementById('insightCityLevelFilter')?.value || '';
  const cityFilter = document.getElementById('insightCityFilter')?.value || '';
  const educationFilter = document.getElementById('insightEducationFilter')?.value || '';
  const incomeFilter = document.getElementById('insightIncomeFilter')?.value || '';
  const carFilter = document.getElementById('insightCarFilter')?.value || '';

  // ★ 只统计已完成调研的用户
  const completedSamples = getCompletedUserSamples();
  return completedSamples.filter(user => {
    // 年份筛选
    if (yearFilter) {
      const userYear = (user.researchDate || '').split('-')[0];
      if (userYear !== yearFilter) return false;
    }

    // 年龄段筛选
    if (ageFilter) {
      const age = parseInt(user.age) || 0;
      if (ageFilter === '50+') {
        if (age < 50) return false;
      } else {
        const [min, max] = ageFilter.split('-').map(Number);
        if (age < min || age > max) return false;
      }
    }

    // 性别
    if (genderFilter && user.gender !== genderFilter) return false;

    // 婚姻状况
    if (maritalFilter && user.maritalStatus !== maritalFilter) return false;

    // 生育情况
    if (childrenFilter && user.children !== childrenFilter) return false;

    // 城市线级
    if (cityLevelFilter && user.cityLevel !== cityLevelFilter) return false;

    // 所在城市
    if (cityFilter && user.city !== cityFilter) return false;

    // 教育程度
    if (educationFilter && user.education !== educationFilter) return false;

    // 家庭年收入
    if (incomeFilter && user.income !== incomeFilter) return false;

    // 拥车情况
    if (carFilter && user.carOwnership !== carFilter) return false;

    return true;
  });
}

// 对用户进行分组
function groupUsersByDimensions(users) {
  // 获取当前选中的购买力
  const activePowerTab = document.querySelector('.power-tab.active');
  const powerFilter = activePowerTab?.dataset.power || 'all';

  // 进一步按购买力筛选
  let filteredUsers = users;
  if (powerFilter !== 'all') {
    filteredUsers = users.filter(u => u._purchasingPower === powerFilter);
  }

  // 分组结构：{ lifeStage: { valueOrientation: [users] } }
  const groups = {};

  // 初始化所有组合
  LIFE_STAGES.forEach(stage => {
    groups[stage.id] = {};
    VALUE_ORIENTATIONS.forEach(val => {
      groups[stage.id][val] = [];
    });
  });

  // 填充用户
  filteredUsers.forEach(user => {
    const stage = user._lifeStage;
    const value = user._valueOrientation;
    if (groups[stage] && groups[stage][value]) {
      groups[stage][value].push(user);
    }
  });

  return { groups, filteredUsers };
}

// 生成群组名称
function generateGroupName(lifeStage, valueOrientation) {
  const nameMap = {
    'unmarried-female': { '保守': '谨慎待嫁', '稳健': '知性独立', '前卫': '先锋女性' },
    'unmarried-male': { '保守': '踏实青年', '稳健': '进取新锐', '前卫': '潮流先锋' },
    'married-no-child-female': { '保守': '安家常青', '稳健': '品质生活家', '前卫': '时尚辣妈预备' },
    'married-no-child-male': { '保守': '稳重支柱', '稳健': '事业中坚', '前卫': '新潮奶爸预备' },
    'has-children': { '保守': '传统家庭', '稳健': '精明爸妈', '前卫': '潮爸潮妈' },
    'children-grown': { '保守': '传统长辈', '稳健': '成熟中产', '前卫': '潇洒银发' },
    'retired': { '保守': '安享晚年', '稳健': '智慧长者', '前卫': '活力退休' }
  };

  const stageMap = nameMap[lifeStage] || {};
  return stageMap[valueOrientation] || `${valueOrientation}型用户`;
}

// 生成群组关键词
function generateGroupKeywords(lifeStage, valueOrientation, users) {
  const keywordMap = {
    'unmarried-female': { '保守': ['价格敏感', '口碑导向', '实用主义'], '稳健': ['品质追求', '理性决策', '品牌认知'], '前卫': ['科技尝鲜', '个性表达', '社交分享'] },
    'unmarried-male': { '保守': ['经济适用', '稳重可靠', '传统审美'], '稳健': ['性能均衡', '品牌忠诚', '理性消费'], '前卫': ['智能科技', '运动操控', '潮流设计'] },
    'married-no-child-female': { '保守': ['居家实用', '安全优先', '经济考量'], '稳健': ['品质升级', '生活品味', '精致出行'], '前卫': ['自我表达', '时尚科技', '社交属性'] },
    'married-no-child-male': { '保守': ['家庭责任', '稳重踏实', '传统价值'], '稳健': ['事业进阶', '品质生活', '理性投资'], '前卫': ['科技先锋', '生活方式', '个性彰显'] },
    'has-children': { '保守': ['空间优先', '安全至上', '经济实用'], '稳健': ['家庭出行', '品质教育', '理性升级'], '前卫': ['智能座舱', '亲子科技', '潮流家庭'] },
    'children-grown': { '保守': ['节俭持家', '传统观念', '稳定需求'], '稳健': ['品质养老', '舒适出行', '理性消费'], '前卫': ['享受生活', '科技养老', '品质追求'] },
    'retired': { '保守': ['节俭习惯', '安全稳重', '传统需求'], '稳健': ['舒适出行', '品质生活', '健康养生'], '前卫': ['活力老年', '科技探索', '社交生活'] }
  };

  const stageMap = keywordMap[lifeStage] || {};
  return stageMap[valueOrientation] || ['综合型用户', '多元需求'];
}

// 计算同比变化（模拟数据）
function getYearOverYearChange(users) {
  // 模拟：基于用户ID哈希生成一个变化百分比
  const total = users.length;
  if (total === 0) return { value: 0, direction: 'stable' };
  const hash = stringHash(users.map(u => u.id).join(''));
  const change = (Math.abs(hash) % 30) - 10; // -10% 到 +20%
  return {
    value: Math.abs(change),
    direction: change >= 0 ? 'up' : 'down'
  };
}

// 渲染用户洞察矩阵
function renderInsightMatrix() {
  const container = document.getElementById('insightMatrixWrapper');
  if (!container) return;

  // 确保用户数据已增强
  enrichUserData();

  // 获取筛选后的用户
  const filteredUsers = filterInsightUsers();

  // 按维度分组
  const { groups, filteredUsers: powerFiltered } = groupUsersByDimensions(filteredUsers);

  // 更新用户数量
  const countEl = document.getElementById('insightUserCount');
  if (countEl) countEl.textContent = powerFiltered.length;

  // 构建矩阵HTML
  let html = '';

  // 横轴维度标签
  html += '<div class="matrix-dimension-x">人生阶段</div>';
  
  // 矩阵主体
  html += '<div class="matrix-body">';
  
  // 纵轴维度标签
  html += '<div class="matrix-dimension-y">价值观</div>';
  
  // 矩阵内容（表头 + 数据行）
  html += '<div class="matrix-inner">'

  // 横向表头
  html += '<div class="matrix-x-headers">';
  html += '<div class="matrix-x-header-cell"></div>';
  LIFE_STAGES.forEach(stage => {
    html += `<div class="matrix-x-header-cell">${stage.label}</div>`;
  });
  html += '</div>';

  // 纵向：价值观，横向：人生阶段
  VALUE_ORIENTATIONS.forEach(val => {
    html += '<div class="insight-matrix-row">';
    html += `<div class="matrix-row-label">${val}</div>`;
    html += '<div class="matrix-row-cells">';

    LIFE_STAGES.forEach(stage => {
      const users = groups[stage.id]?.[val] || [];
      const count = users.length;
      const totalUsers = powerFiltered.length;

      if (count === 0) {
        html += '<div class="matrix-cell-empty">暂无数据</div>';
      } else {
        const groupName = generateGroupName(stage.id, val);
        const keywords = generateGroupKeywords(stage.id, val, users);
        const percent = totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(1) : '0.0';
        const yoy = getYearOverYearChange(users);

        html += `<div class="matrix-cell" onclick="openGroupDetail('${stage.id}', '${val}')">`;
        html += `<div class="matrix-cell-header">`;
        html += `<span class="matrix-cell-title">${groupName}</span>`;
        html += `<span class="matrix-cell-count">${count}</span>`;
        html += `</div>`;
        html += `<div class="matrix-cell-percent">占当前购买力 ${percent}% · 占总人群 ${((count / powerFiltered.length) * 100).toFixed(1)}%</div>`;
        html += `<div class="matrix-cell-keywords">${keywords.map(k => `<span>${k}</span>`).join('')}</div>`;
        html += `<div class="matrix-cell-trend ${yoy.direction}">`;
        html += yoy.direction === 'up' ? '▲' : '▼';
        html += ` 同比${yoy.direction === 'up' ? '增长' : '下降'} ${yoy.value}%`;
        html += `</div>`;
        html += '</div>';
      }
    });

    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>'; // matrix-inner
  html += '</div>'; // matrix-main

  container.innerHTML = html;
  
  // 确保矩阵容器有足够的宽度以显示所有列
  container.style.minWidth = '1200px';
}

// 打开群组详情
let currentGroupDetail = null;

function openGroupDetail(lifeStage, valueOrientation) {
  const detailPanel = document.getElementById('insightGroupDetail');
  const matrixContainer = document.getElementById('insightMatrixContainer');
  const titleEl = document.getElementById('groupDetailTitle');
  const contentEl = document.getElementById('groupDetailContent');

  if (!detailPanel || !contentEl) return;

  // 获取筛选后的用户
  const filteredUsers = filterInsightUsers();
  const { groups } = groupUsersByDimensions(filteredUsers);
  const users = groups[lifeStage]?.[valueOrientation] || [];

  const stageLabel = LIFE_STAGES.find(s => s.id === lifeStage)?.label || lifeStage;
  const groupName = generateGroupName(lifeStage, valueOrientation);
  const keywords = generateGroupKeywords(lifeStage, valueOrientation, users);

  // 计算统计
  const totalUsers = getCompletedUserSamples().length;
  const groupPercent = totalUsers > 0 ? ((users.length / totalUsers) * 100).toFixed(1) : '0.0';
  const avgAge = Math.round(users.reduce((s, u) => s + (parseInt(u.age) || 0), 0) / (users.length || 1));

  if (titleEl) {
    titleEl.textContent = `${groupName} (${stageLabel} · ${valueOrientation})`;
  }

  // 执行人群特征和购车需求分析
  const demographics = analyzeGroupDemographics(users);
  const carNeeds = analyzeGroupCarNeeds(users, lifeStage, valueOrientation);
  const heterogeneity = detectGroupHeterogeneity(users, carNeeds);

  // 构建详情内容
  let html = '';

  // ===== 基础统计卡片 =====
  html += '<div class="group-stats-row">';
  html += `<div class="group-stat-card"><span>用户数量</span><strong>${users.length}</strong></div>`;
  html += `<div class="group-stat-card"><span>占总人群比例</span><strong>${groupPercent}%</strong></div>`;
  html += `<div class="group-stat-card"><span>平均年龄</span><strong>${avgAge}岁</strong></div>`;
  html += `<div class="group-stat-card"><span>主要城市</span><strong>${getTopCity(users)}</strong></div>`;
  html += '</div>';

  // ===== 人群特征分析 =====
  if (demographics) {
    html += '<div class="user-detail-section group-analysis-section">';
    html += '<h3><span class="section-icon">&#128101;</span>人群特征画像</h3>';

    // 基础画像
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">基础画像</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="profile-grid">';
    html += `<div class="profile-item"><span class="profile-label">年龄区间</span><span class="profile-value">${demographics.ageRange}</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">平均年龄</span><span class="profile-value">${demographics.avgAge}岁</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">主导性别</span><span class="profile-value">${demographics.dominantGender}</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">子女比例</span><span class="profile-value">${demographics.childrenRatio}%</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">主导收入</span><span class="profile-value">${demographics.dominantIncome}</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">主导城市</span><span class="profile-value">${demographics.dominantCityLevel}</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">教育水平</span><span class="profile-value">${demographics.dominantEdu}</span></div>`;
    html += `<div class="profile-item"><span class="profile-label">拥车比例</span><span class="profile-value">${demographics.hasCarRatio}%</span></div>`;
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // 购车预算
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">购车预算分析</div>';
    html += '<div class="analysis-card-body">';
    html += `<div class="budget-analysis"><span class="budget-label">平均购车预算占年收入比例：</span><span class="budget-value">${demographics.avgBudgetRatio}%</span></div>`;
    html += `<div class="budget-analysis"><span class="budget-label">预估平均购车预算：</span><span class="budget-value">约${demographics.avgBudgetWan}万元</span></div>`;
    html += `<div class="budget-desc">该群体${demographics.avgBudgetRatio > 50 ? '对车辆投入意愿较高，愿意为优质体验支付溢价' : demographics.avgBudgetRatio > 30 ? '对车辆投入持理性态度，注重性价比' : '对车辆投入较为保守，更关注实用性和经济性'}</div>`;
    html += '</div>';
    html += '</div>';

    // 审美偏好、消费理念、生活方式
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">价值观念</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="value-dimension">';
    html += `<div class="value-item"><span class="value-tag">审美偏好</span><p>${demographics.aesthetic}</p></div>`;
    html += `<div class="value-item"><span class="value-tag">消费理念</span><p>${demographics.consumption}</p></div>`;
    html += `<div class="value-item"><span class="value-tag">生活方式</span><p>${demographics.lifestyle}</p></div>`;
    html += `<div class="value-item"><span class="value-tag">社交特征</span><p>${demographics.socialCircle}</p></div>`;
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
  }

  // ===== 购车需求特点 =====
  if (carNeeds) {
    html += '<div class="user-detail-section group-analysis-section">';
    html += '<h3><span class="section-icon">&#128663;</span>购车需求特点</h3>';

    // 核心需求优先级
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">核心需求优先级</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="priority-tags">';
    carNeeds.stageNeeds.priority.forEach((p, i) => {
      html += `<span class="priority-tag rank-${i + 1}">${i + 1}. ${p}</span>`;
    });
    html += '</div>';
    html += `<p class="priority-desc">${carNeeds.stageNeeds.concern}</p>`;
    html += '</div>';
    html += '</div>';

    // 能源类型偏好
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">能源类型偏好</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="preference-bars">';
    carNeeds.energyType.forEach(item => {
      html += `<div class="pref-bar-item"><span class="pref-label">${item.type}</span><div class="pref-bar"><div class="pref-bar-fill" style="width:${item.score}%"></div></div><span class="pref-score">${item.score}%</span></div>`;
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // 车型类别偏好
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">车型类别偏好</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="preference-bars">';
    carNeeds.bodyType.forEach(item => {
      html += `<div class="pref-bar-item"><span class="pref-label">${item.type}</span><div class="pref-bar"><div class="pref-bar-fill" style="width:${item.score}%"></div></div><span class="pref-score">${item.score}%</span></div>`;
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // 外观造型 & 内饰风格
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">外观与内饰偏好</div>';
    html += '<div class="analysis-card-body">';
    html += `<div class="style-item"><span class="style-tag">外观造型</span><p>${carNeeds.exteriorStyle}</p></div>`;
    html += `<div class="style-item"><span class="style-tag">内饰风格</span><p>${carNeeds.interiorStyle}</p></div>`;
    html += '</div>';
    html += '</div>';

    // 性能偏好
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">性能偏好</div>';
    html += '<div class="analysis-card-body">';
    html += `<p class="performance-desc">${carNeeds.performance}</p>`;
    html += '</div>';
    html += '</div>';

    // 空间布局
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">空间布局偏好</div>';
    html += '<div class="analysis-card-body">';
    html += `<p class="space-desc">${carNeeds.spaceLayout}</p>`;
    html += '</div>';
    html += '</div>';

    // 智能化配置偏好
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">智能化配置偏好</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="smart-features">';
    carNeeds.smartFeatures.forEach(f => {
      const levelClass = f.level === '高' ? 'level-high' : f.level === '中' ? 'level-mid' : 'level-low';
      html += `<div class="smart-feature-item ${levelClass}"><span class="sf-name">${f.name}</span><span class="sf-level">${f.level}</span><p>${f.desc}</p></div>`;
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // 舒适配置偏好
    html += '<div class="analysis-card">';
    html += '<div class="analysis-card-title">舒适配置偏好</div>';
    html += '<div class="analysis-card-body">';
    html += '<div class="comfort-tags">';
    carNeeds.comfortFeatures.forEach(f => {
      html += `<span class="comfort-tag">${f}</span>`;
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
  }

  // ===== 群组差异检测与细分建议 =====
  if (heterogeneity) {
    html += '<div class="user-detail-section group-analysis-section">';
    html += '<h3><span class="section-icon">&#128200;</span>群组一致性分析</h3>';

    if (heterogeneity.needsSplit) {
      html += `<div class="heterogeneity-alert alert-${heterogeneity.severity}">`;
      html += `<div class="alert-title">&#9888; 该群组存在用户异质性，建议进一步细分</div>`;
      html += `<div class="alert-desc">${heterogeneity.reason}</div>`;
      html += '</div>';

      if (heterogeneity.issues && heterogeneity.issues.length > 0) {
        html += '<div class="analysis-card">';
        html += '<div class="analysis-card-title">异质性特征</div>';
        html += '<div class="analysis-card-body">';
        html += '<ul class="issue-list">';
        heterogeneity.issues.forEach(issue => {
          const icon = issue.severity === 'high' ? '&#128308;' : '&#128993;';
          html += `<li class="issue-item issue-${issue.severity}">${icon} ${issue.desc}</li>`;
        });
        html += '</ul>';
        html += '</div>';
        html += '</div>';
      }

      if (heterogeneity.suggestions && heterogeneity.suggestions.length > 0) {
        html += '<div class="analysis-card">';
        html += '<div class="analysis-card-title">细分建议</div>';
        html += '<div class="analysis-card-body">';
        html += '<ul class="suggestion-list">';
        heterogeneity.suggestions.forEach(s => {
          html += `<li class="suggestion-item"><span class="suggestion-type">${s.type === 'age' ? '年龄' : s.type === 'income' ? '收入' : s.type === 'city' ? '城市' : s.type === 'car' ? '拥车' : '综合'}</span>${s.text}</li>`;
        });
        html += '</ul>';
        html += '</div>';
        html += '</div>';
      }
    } else {
      html += '<div class="heterogeneity-alert alert-good">';
      html += '<div class="alert-title">&#9989; 该群组用户特征一致性良好</div>';
      html += `<div class="alert-desc">${heterogeneity.reason}</div>`;
      html += '</div>';
    }

    html += '</div>';
  }

  // ===== 关键词 =====
  html += '<div class="user-detail-section">';
  html += '<h3>群组特征关键词</h3>';
  html += '<div class="matrix-cell-keywords" style="margin-top:10px;">';
  keywords.forEach(k => {
    html += `<span style="padding:4px 10px;font-size:13px;">${k}</span>`;
  });
  html += '</div>';
  html += '</div>';

  // ===== 用户列表 =====
  html += '<div class="user-detail-section">';
  html += '<h3>群组用户列表</h3>';
  html += '<div class="group-user-list" style="margin-top:12px;">';
  users.forEach(user => {
    html += `<div class="group-user-card" onclick="openUserDetail('${user.id}')">`;
    html += `<div class="user-name">${user.name || user.id}</div>`;
    html += `<div class="user-info">${user.age}岁 · ${user.gender} · ${user.maritalStatus} · ${user.income || '-'} · ${user.city || '-'}${user.cityLevel ? '(' + user.cityLevel + ')' : ''}</div>`;
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  contentEl.innerHTML = html;

  // 显示详情面板，隐藏矩阵
  if (matrixContainer) matrixContainer.classList.add('hidden');
  detailPanel.classList.remove('hidden');

  // 添加二级导航
  renderInsightSubNav(groupName, lifeStage, valueOrientation);
}

// 获取用户主要城市
function getTopCity(users) {
  if (!users.length) return '-';
  const cityCounts = {};
  users.forEach(u => {
    if (u.city) cityCounts[u.city] = (cityCounts[u.city] || 0) + 1;
  });
  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || '-';
}

// ===== 群组人群特征分析 =====
function analyzeGroupDemographics(users) {
  if (!users.length) return null;

  // 年龄区间
  const ages = users.map(u => parseInt(u.age) || 0).filter(a => a > 0);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const minAge = ages.length ? Math.min(...ages) : 0;
  const maxAge = ages.length ? Math.max(...ages) : 0;

  // 性别分布
  const genderDist = {};
  users.forEach(u => { genderDist[u.gender] = (genderDist[u.gender] || 0) + 1; });
  const dominantGender = Object.entries(genderDist).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  // 家庭构成
  const maritalDist = {};
  users.forEach(u => { maritalDist[u.maritalStatus] = (maritalDist[u.maritalStatus] || 0) + 1; });
  const hasChildrenCount = users.filter(u => u.children && u.children !== '无子女' && u.children !== '未婚').length;
  const childrenRatio = users.length ? ((hasChildrenCount / users.length) * 100).toFixed(0) : 0;

  // 收入分布
  const incomeDist = {};
  users.forEach(u => { incomeDist[u.income] = (incomeDist[u.income] || 0) + 1; });
  const sortedIncome = Object.entries(incomeDist).sort((a, b) => b[1] - a[1]);
  const dominantIncome = sortedIncome[0]?.[0] || '-';

  // 城市分布
  const cityDist = {};
  users.forEach(u => { if (u.city) cityDist[u.city] = (cityDist[u.city] || 0) + 1; });
  const cityLevelDist = {};
  users.forEach(u => { if (u.cityLevel) cityLevelDist[u.cityLevel] = (cityLevelDist[u.cityLevel] || 0) + 1; });
  const topCities = Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const dominantCityLevel = Object.entries(cityLevelDist).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  // 教育程度
  const eduDist = {};
  users.forEach(u => { eduDist[u.education] = (eduDist[u.education] || 0) + 1; });
  const dominantEdu = Object.entries(eduDist).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  // 当前拥车情况
  const carDist = {};
  users.forEach(u => { carDist[u.carOwnership] = (carDist[u.carOwnership] || 0) + 1; });
  const hasCarCount = users.filter(u => u.carOwnership && u.carOwnership !== '无车').length;
  const hasCarRatio = users.length ? ((hasCarCount / users.length) * 100).toFixed(0) : 0;

  // 购车预算占收入比例（模拟计算）
  const budgetRatios = users.map(u => {
    const incomeMap = { '20-30万': 25, '30-50万': 40, '50-100万': 75, '100万以上': 120, '20万以下': 15 };
    const incomeNum = incomeMap[u.income] || 30;
    // 根据价值观和人生阶段推断预算比例
    let ratio = 0.5; // 默认50%
    if (u._valueOrientation === '保守') ratio = 0.3;
    else if (u._valueOrientation === '稳健') ratio = 0.5;
    else if (u._valueOrientation === '前卫') ratio = 0.7;
    // 年龄调整
    if (u.age < 30) ratio += 0.1;
    else if (u.age > 45) ratio -= 0.1;
    return { income: incomeNum, ratio: Math.min(ratio, 0.8), budget: incomeNum * ratio };
  });
  const avgBudgetRatio = budgetRatios.length ? (budgetRatios.reduce((a, b) => a + b.ratio, 0) / budgetRatios.length * 100).toFixed(0) : 0;
  const avgBudgetWan = budgetRatios.length ? Math.round(budgetRatios.reduce((a, b) => a + b.budget, 0) / budgetRatios.length) : 0;

  // 审美偏好（基于价值观推断）
  const aestheticMap = {
    '保守': '经典稳重、内敛低调，偏好传统设计语言和成熟配色',
    '稳健': '均衡大气、品质优先，注重细节做工与实用美学的平衡',
    '前卫': '个性鲜明、科技未来感，偏好前卫造型和潮流元素'
  };

  // 消费理念（基于价值观推断）
  const consumptionMap = {
    '保守': '理性务实、注重性价比，偏好成熟可靠的品牌和产品',
    '稳健': '品质导向、兼顾价值与体验，愿意为优质体验适度溢价',
    '前卫': '体验优先、愿意为创新买单，对新品牌新技术接受度高'
  };

  // 生活方式（基于人生阶段和城市推断）
  const lifestyleMap = {
    'unmarried-female': '都市职场女性，注重生活品质和个人成长',
    'unmarried-male': '职场打拼期，关注事业发展和社交场景',
    'married-no-child-female': '新婚生活，追求品质与二人世界的精致',
    'married-no-child-male': '事业上升期，注重家庭责任和社会形象',
    'has-children': '以家庭为中心，注重亲子时光和家庭出行体验',
    'children-grown': '空巢期，重新关注个人兴趣和社交生活',
    'retired': '休闲养生，注重安全舒适和便捷出行'
  };

  // 社交圈特征
  const socialCircle = dominantCityLevel === '一线' ? '以职场同事和行业圈子为主，社交活动丰富' :
    dominantCityLevel === '二线' ? '以亲友邻里和本地社群为主，关系紧密' :
    '以本地亲友和社区为主，社交半径相对集中';

  // 取一个代表性的人生阶段
  const sampleUser = users[0];
  const lifeStageKey = sampleUser?._lifeStage || 'unmarried-female';
  const valueKey = sampleUser?._valueOrientation || '稳健';

  return {
    ageRange: `${minAge}-${maxAge}岁`,
    avgAge,
    dominantGender,
    genderDist,
    maritalDist,
    childrenRatio,
    incomeDist,
    dominantIncome,
    cityDist,
    topCities,
    dominantCityLevel,
    cityLevelDist,
    dominantEdu,
    eduDist,
    carDist,
    hasCarRatio,
    avgBudgetRatio,
    avgBudgetWan,
    aesthetic: aestheticMap[valueKey] || aestheticMap['稳健'],
    consumption: consumptionMap[valueKey] || consumptionMap['稳健'],
    lifestyle: lifestyleMap[lifeStageKey] || lifestyleMap['unmarried-female'],
    socialCircle
  };
}

// ===== 群组购车需求分析 =====
function analyzeGroupCarNeeds(users, lifeStage, valueOrientation) {
  if (!users.length) return null;

  // 基于人生阶段和价值观推断各项需求偏好
  const stageNeeds = getStageCarNeeds(lifeStage);
  const valueNeeds = getValueOrientationNeeds(valueOrientation);

  // 能源类型偏好
  const energyType = inferEnergyType(users, lifeStage, valueOrientation);

  // 车型类别偏好
  const bodyType = inferBodyType(users, lifeStage, valueOrientation);

  // 外观造型偏好
  const exteriorStyle = inferExteriorStyle(lifeStage, valueOrientation);

  // 内饰风格偏好
  const interiorStyle = inferInteriorStyle(lifeStage, valueOrientation);

  // 性能偏好
  const performance = inferPerformance(lifeStage, valueOrientation);

  // 空间布局偏好
  const spaceLayout = inferSpaceLayout(lifeStage, valueOrientation);

  // 智能化配置偏好
  const smartFeatures = inferSmartFeatures(lifeStage, valueOrientation, users);

  // 舒适配置偏好
  const comfortFeatures = inferComfortFeatures(lifeStage, valueOrientation);

  return {
    energyType,
    bodyType,
    exteriorStyle,
    interiorStyle,
    performance,
    spaceLayout,
    smartFeatures,
    comfortFeatures,
    stageNeeds,
    valueNeeds
  };
}

// 根据人生阶段推断购车需求
function getStageCarNeeds(lifeStage) {
  const map = {
    'unmarried-female': { priority: ['颜值设计', '智能科技', '品牌价值'], concern: '日常通勤和城市代步为主，注重车辆的时尚感和科技配置' },
    'unmarried-male': { priority: ['动力操控', '智能科技', '社交属性'], concern: '追求驾驶乐趣和车辆个性表达，注重科技配置和品牌形象' },
    'married-no-child-female': { priority: ['品质舒适', '安全科技', '空间实用'], concern: '注重生活品质和日常用车的舒适性，安全性是重要考量' },
    'married-no-child-male': { priority: ['空间舒适', '品牌可靠', '商务属性'], concern: '兼顾家庭使用和商务场景，注重品牌口碑和可靠性' },
    'has-children': { priority: ['空间安全', '舒适便利', '儿童友好'], concern: '家庭出行是核心场景，对空间、安全和儿童配置要求高' },
    'children-grown': { priority: ['舒适品质', '智能科技', '健康环保'], concern: '重新关注个人用车需求，注重舒适性和健康配置' },
    'retired': { priority: ['安全舒适', '操作简单', '经济性'], concern: '注重安全性、易用性和经济性，偏好成熟可靠的产品' }
  };
  return map[lifeStage] || map['unmarried-female'];
}

// 根据价值观推断需求特点
function getValueOrientationNeeds(valueOrientation) {
  const map = {
    '保守': { priority: ['可靠性', '安全性', '经济性'], concern: '注重车辆的成熟可靠，偏好经过市场验证的产品和技术' },
    '稳健': { priority: ['均衡性', '品质感', '性价比'], concern: '追求全面均衡的产品体验，注重品牌口碑和长期价值' },
    '前卫': { priority: ['创新性', '智能化', '个性化'], concern: '追求最新科技和独特体验，对创新配置和品牌调性要求高' }
  };
  return map[valueOrientation] || map['稳健'];
}

// 推断能源类型偏好
function inferEnergyType(users, lifeStage, valueOrientation) {
  const base = { '纯电': 0, '插混': 0, '增程': 0, '燃油': 0 };

  // 基于价值观
  if (valueOrientation === '保守') { base['燃油'] += 40; base['插混'] += 30; base['纯电'] += 15; base['增程'] += 15; }
  else if (valueOrientation === '稳健') { base['纯电'] += 35; base['插混'] += 30; base['增程'] += 20; base['燃油'] += 15; }
  else { base['纯电'] += 45; base['增程'] += 25; base['插混'] += 20; base['燃油'] += 10; }

  // 基于人生阶段
  if (lifeStage === 'has-children') { base['纯电'] += 10; base['插混'] += 5; }
  else if (lifeStage === 'retired') { base['燃油'] += 15; base['插混'] += 10; }

  // 基于城市级别
  const hasCityUsers = users.filter(u => u.cityLevel === '一线').length;
  const ratio = users.length ? hasCityUsers / users.length : 0;
  if (ratio > 0.5) { base['纯电'] += 15; base['燃油'] -= 10; }

  // 归一化并排序
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  return Object.entries(base).map(([k, v]) => ({ type: k, score: Math.round((v / total) * 100) })).sort((a, b) => b.score - a.score);
}

// 推断车型类别偏好
function inferBodyType(users, lifeStage, valueOrientation) {
  const base = { 'SUV': 0, '轿车': 0, 'MPV': 0 };

  if (lifeStage === 'has-children') { base['SUV'] += 50; base['MPV'] += 30; base['轿车'] += 20; }
  else if (lifeStage === 'retired') { base['轿车'] += 40; base['SUV'] += 35; base['MPV'] += 25; }
  else if (lifeStage === 'unmarried-female' || lifeStage === 'unmarried-male') { base['轿车'] += 45; base['SUV'] += 40; base['MPV'] += 15; }
  else { base['SUV'] += 45; base['轿车'] += 35; base['MPV'] += 20; }

  if (valueOrientation === '前卫') { base['SUV'] += 10; base['轿车'] -= 5; }

  const total = Object.values(base).reduce((a, b) => a + b, 0);
  return Object.entries(base).map(([k, v]) => ({ type: k, score: Math.round((v / total) * 100) })).sort((a, b) => b.score - a.score);
}

// 推断外观造型偏好
function inferExteriorStyle(lifeStage, valueOrientation) {
  const styles = {
    '保守': '稳重大气、线条简洁流畅，偏好经典耐看的设计语言，注重车辆的商务气质和稳重形象',
    '稳健': '均衡大气、时尚而不失稳重，偏好兼顾家用与商务的设计风格',
    '前卫': '运动个性、科技感十足，偏好前卫大胆的造型设计和独特的视觉冲击力'
  };
  const baseStyle = styles[valueOrientation] || styles['稳健'];

  const stageAdjust = {
    'has-children': '，注重家庭亲和力',
    'retired': '，注重亲和力和易识别性',
    'unmarried-female': '，注重时尚感和精致细节',
    'unmarried-male': '，注重运动感和力量感'
  };
  return baseStyle + (stageAdjust[lifeStage] || '');
}

// 推断内饰风格偏好
function inferInteriorStyle(lifeStage, valueOrientation) {
  const base = {
    '保守': '经典稳重，偏好皮质+木纹的搭配，注重用料质感和做工细节',
    '稳健': '现代简约，偏好高品质软包材质，注重人机工程学和实用性',
    '前卫': '科技未来感，偏好大屏+氛围灯组合，注重数字化体验和个性化定制'
  };
  const style = base[valueOrientation] || base['稳健'];

  const stageAdd = {
    'has-children': '，注重耐脏易清洁和儿童安全配置',
    'retired': '，注重操作便利性和视野开阔性',
    'unmarried-female': '，注重色彩搭配和细节精致度',
    'unmarried-male': '，注重运动感和科技氛围'
  };
  return style + (stageAdd[lifeStage] || '');
}

// 推断性能偏好
function inferPerformance(lifeStage, valueOrientation) {
  const perf = {
    '保守': '够用即可，偏好平顺线性的动力输出，注重燃油经济性和可靠性',
    '稳健': '动力充沛，兼顾日常使用和运动性能，偏好响应灵敏但不过于激进',
    '前卫': '追求强劲动力和极致加速，偏好运动模式和个性化驾驶模式'
  };
  const base = perf[valueOrientation] || perf['稳健'];

  if (lifeStage === 'has-children') return base + '，对制动性能和稳定性要求高';
  if (lifeStage === 'retired') return base + '，对舒适性和安全性要求高';
  return base;
}

// 推断空间布局偏好
function inferSpaceLayout(lifeStage, valueOrientation) {
  const layouts = {
    'has-children': '大五座或七座布局，注重后排空间和后备箱装载能力，儿童安全座椅接口和储物空间是刚需',
    'retired': '舒适宽敞的五座布局，注重上下车便利性和座椅舒适度',
    'unmarried-female': '灵活实用的五座布局，注重日常通勤和购物装载的便利性',
    'unmarried-male': '运动化的五座布局，注重驾驶位包裹感和操控空间'
  };
  return layouts[lifeStage] || '实用舒适的五座布局，兼顾日常通勤和家庭出行';
}

// 推断智能化配置偏好
function inferSmartFeatures(lifeStage, valueOrientation, users) {
  const features = [];

  if (valueOrientation === '前卫') {
    features.push({ name: '高级辅助驾驶', level: '高', desc: '对NOA、城市NGP等高阶智驾功能接受度高，愿意为此付费' });
    features.push({ name: '智能座舱', level: '高', desc: '追求大尺寸中控屏、语音交互、多屏联动等先进座舱体验' });
    features.push({ name: '自动泊车', level: '高', desc: '对自动泊车、遥控泊车等功能需求强烈' });
  } else if (valueOrientation === '稳健') {
    features.push({ name: '辅助驾驶', level: '中', desc: '偏好L2级辅助驾驶，注重实用性和可靠性' });
    features.push({ name: '智能座舱', level: '中', desc: '注重实用功能，如导航、音乐、语音控制等基础智能化' });
    features.push({ name: '自动泊车', level: '中', desc: '对标准自动泊车功能有需求，但不过分依赖' });
  } else {
    features.push({ name: '基础辅助', level: '低', desc: '对高级辅助驾驶保持谨慎态度，偏好基础安全辅助' });
    features.push({ name: '基础车机', level: '低', desc: '对传统按键和基础功能接受度高，对大屏和复杂交互需求低' });
    features.push({ name: '手动泊车', level: '低', desc: '对自身驾驶技术有信心，对自动泊车需求较低' });
  }

  if (lifeStage === 'has-children') {
    features.push({ name: '后排娱乐', level: '中', desc: '对儿童友好的娱乐和交互功能有需求' });
  }

  return features;
}

// 推断舒适配置偏好
function inferComfortFeatures(lifeStage, valueOrientation) {
  const features = [];

  if (lifeStage === 'has-children') {
    features.push('空气净化/新风系统');
    features.push('后排座椅加热/通风');
    features.push('大容量储物空间');
  } else if (lifeStage === 'retired') {
    features.push('座椅按摩/加热');
    features.push('静谧性优化');
    features.push('高坐姿视野');
  } else {
    features.push('座椅加热/通风');
    features.push('自动空调');
    features.push('无钥匙进入');
  }

  if (valueOrientation === '前卫') {
    features.push('氛围灯系统');
    features.push('车载KTV/音响');
  }

  return features;
}

// ===== 群组内需求差异检测 =====
function detectGroupHeterogeneity(users, carNeeds) {
  if (users.length < 5) return { needsSplit: false, reason: '样本量不足，无法进行有效差异分析' };

  const issues = [];

  // 检测年龄差异
  const ages = users.map(u => parseInt(u.age) || 0).filter(a => a > 0);
  if (ages.length > 1) {
    const ageStd = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - (ages.reduce((s, v) => s + v, 0) / ages.length), 2), 0) / ages.length);
    if (ageStd > 8) {
      issues.push({ type: 'age', severity: 'high', desc: `年龄离散度大（标准差${ageStd.toFixed(1)}岁），群内用户年龄跨度从${Math.min(...ages)}岁到${Math.max(...ages)}岁，可能导致用车场景和需求偏好差异显著` });
    } else if (ageStd > 5) {
      issues.push({ type: 'age', severity: 'medium', desc: `年龄离散度中等（标准差${ageStd.toFixed(1)}岁），建议关注不同年龄段用户的细分需求` });
    }
  }

  // 检测收入差异
  const incomeGroups = {};
  users.forEach(u => { incomeGroups[u.income] = (incomeGroups[u.income] || 0) + 1; });
  const incomeCount = Object.keys(incomeGroups).length;
  if (incomeCount >= 3) {
    issues.push({ type: 'income', severity: 'high', desc: `收入水平分布广泛（覆盖${incomeCount}个区间），不同收入层级的购车预算和品质要求差异较大` });
  } else if (incomeCount === 2) {
    const counts = Object.values(incomeGroups);
    const minRatio = Math.min(...counts) / users.length;
    if (minRatio > 0.3) {
      issues.push({ type: 'income', severity: 'medium', desc: '收入呈现明显的两极分化，建议考虑按购买力进一步细分' });
    }
  }

  // 检测城市级别差异
  const cityLevels = {};
  users.forEach(u => { if (u.cityLevel) cityLevels[u.cityLevel] = (cityLevels[u.cityLevel] || 0) + 1; });
  if (Object.keys(cityLevels).length >= 3) {
    issues.push({ type: 'city', severity: 'medium', desc: `用户分布在${Object.keys(cityLevels).length}个不同线级城市，用车环境和基础设施差异可能影响购车决策` });
  }

  // 检测当前拥车情况差异
  const carTypes = {};
  users.forEach(u => { carTypes[u.carOwnership] = (carTypes[u.carOwnership] || 0) + 1; });
  if (Object.keys(carTypes).length >= 3) {
    const top2 = Object.entries(carTypes).sort((a, b) => b[1] - a[1]).slice(0, 2);
    issues.push({ type: 'car', severity: 'medium', desc: `用户拥车背景多样，${top2.map(([k, v]) => `${k}占${((v/users.length)*100).toFixed(0)}%`).join('、')}，首次购车和增换购用户的需求重点不同` });
  }

  const highIssues = issues.filter(i => i.severity === 'high');
  const mediumIssues = issues.filter(i => i.severity === 'medium');

  if (highIssues.length >= 2) {
    return {
      needsSplit: true,
      severity: 'high',
      reason: `该群组存在${highIssues.length}项显著异质性特征，用户画像差异较大，建议进行细分`,
      issues,
      suggestions: generateSplitSuggestions(users, issues)
    };
  } else if (highIssues.length >= 1 || mediumIssues.length >= 2) {
    return {
      needsSplit: true,
      severity: 'medium',
      reason: `该群组存在一定程度的用户异质性，${highIssues.length > 0 ? '部分用户特征差异显著' : '建议关注细分需求差异'}`,
      issues,
      suggestions: generateSplitSuggestions(users, issues)
    };
  }

  return {
    needsSplit: false,
    severity: 'low',
    reason: '该群组内用户特征较为一致，当前划分规则合理',
    issues,
    suggestions: []
  };
}

// 生成分组细分建议
function generateSplitSuggestions(users, issues) {
  const suggestions = [];
  const hasAgeIssue = issues.some(i => i.type === 'age');
  const hasIncomeIssue = issues.some(i => i.type === 'income');
  const hasCityIssue = issues.some(i => i.type === 'city');
  const hasCarIssue = issues.some(i => i.type === 'car');

  if (hasAgeIssue) {
    suggestions.push({ type: 'age', text: '按年龄段细分（如25-35岁、35-45岁），不同年龄层的用车场景和需求优先级差异明显' });
  }
  if (hasIncomeIssue) {
    suggestions.push({ type: 'income', text: '按购买力等级细分（如20-30万、30-50万），不同收入层级的预算范围和配置需求差异较大' });
  }
  if (hasCityIssue) {
    suggestions.push({ type: 'city', text: '按城市线级细分（一线/二线/三线），不同城市的充电设施、路况和用车习惯差异显著' });
  }
  if (hasCarIssue) {
    suggestions.push({ type: 'car', text: '按拥车情况细分（首购/增购/换购），首次购车和增换购用户的关注点和决策因素差异较大' });
  }

  if (suggestions.length === 0) {
    suggestions.push({ type: 'general', text: '建议结合具体业务场景，从年龄、收入、城市等维度交叉分析，找到最适合的细分维度' });
  }

  return suggestions;
}

// 关闭群组详情
function closeGroupDetail() {
  const detailPanel = document.getElementById('insightGroupDetail');
  const matrixContainer = document.getElementById('insightMatrixContainer');

  if (detailPanel) detailPanel.classList.add('hidden');
  if (matrixContainer) matrixContainer.classList.remove('hidden');

  hideInsightSubNav();
}

// 渲染用户洞察二级导航
function renderInsightSubNav(groupName, lifeStage, valueOrientation) {
  const container = document.getElementById('insightSubNavContainer');
  const subNav = document.getElementById('insightSubNav');

  if (!container || !subNav) return;

  subNav.innerHTML = `
    <button class="sub-nav-item active" type="button">
      <span class="sub-nav-item-content">
        <span class="sub-nav-icon">📊</span>
        ${groupName}
      </span>
      <span class="sub-nav-close" onclick="closeGroupDetail()" title="关闭">×</span>
    </button>
  `;

  container.style.display = 'block';
}

function hideInsightSubNav() {
  const container = document.getElementById('insightSubNavContainer');
  if (container) container.style.display = 'none';
}

// 初始化城市筛选器
function initInsightCityFilter() {
  const citySelect = document.getElementById('insightCityFilter');
  if (!citySelect) return;

  const cities = [...new Set(userSamples.map(u => u.city).filter(Boolean))].sort();
  citySelect.innerHTML = '<option value="">全部城市</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
}

// 事件绑定
document.getElementById('clearInsightFiltersBtn')?.addEventListener('click', () => {
  document.getElementById('insightYearFilter').value = '';
  document.getElementById('insightAgeFilter').value = '';
  document.getElementById('insightGenderFilter').value = '';
  document.getElementById('insightMaritalFilter').value = '';
  document.getElementById('insightChildrenFilter').value = '';
  document.getElementById('insightCityLevelFilter').value = '';
  document.getElementById('insightCityFilter').value = '';
  document.getElementById('insightEducationFilter').value = '';
  document.getElementById('insightIncomeFilter').value = '';
  document.getElementById('insightCarFilter').value = '';
  renderInsightMatrix();
});

// 购买力标签切换
document.getElementById('insightPowerTabs')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('power-tab')) {
    document.querySelectorAll('.power-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    renderInsightMatrix();
  }
});

// 筛选器变化时重新渲染
['insightYearFilter', 'insightAgeFilter', 'insightGenderFilter', 'insightMaritalFilter',
 'insightChildrenFilter', 'insightCityLevelFilter', 'insightCityFilter', 'insightEducationFilter',
 'insightIncomeFilter', 'insightCarFilter'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderInsightMatrix);
});

// 全局暴露
window.openGroupDetail = openGroupDetail;
window.closeGroupDetail = closeGroupDetail;

// 初始化用户洞察
enrichUserData();
initInsightCityFilter();
// 恢复上次选择的录像存储目录
restoreStorageDir().catch(function() {});

// 当切换到用户洞察视图时渲染矩阵
const originalSetView = setView;
setView = function(view) {
  originalSetView(view);
  if (view === 'userInsight') {
    renderInsightMatrix();
  }
  if (view === 'userPositioning') {
    initUserPositioning();
  }
};

// ===== 用户定位模块 =====
const VEHICLE_MODULES = [
  {
    key: 'exterior',
    name: '外观设计',
    items: [
      { name: '车身造型风格', type: 'select', options: ['轿车','SUV','MPV','轿跑SUV','跨界车','其他'], value: '' },
      { name: '风阻系数Cd', type: 'number', value: '' },
      { name: '车长mm', type: 'number', value: '' },
      { name: '车宽mm', type: 'number', value: '' },
      { name: '车高mm', type: 'number', value: '' },
      { name: '轴距mm', type: 'number', value: '' },
      { name: '灯光设计', type: 'text', value: '' },
      { name: '车身颜色选项', type: 'text', value: '' },
      { name: '轮毂尺寸inch', type: 'number', value: '' },
      { name: '轮毂设计特点', type: 'text', value: '' }
    ]
  },
  {
    key: 'cockpit',
    name: '智能座舱',
    items: [
      { name: '中控屏尺寸', type: 'text', value: '' },
      { name: '座舱芯片平台', type: 'text', value: '' },
      { name: '语音交互系统', type: 'text', value: '' },
      { name: '座舱操作系统', type: 'text', value: '' },
      { name: '副驾/后排屏幕', type: 'yesno', value: '' },
      { name: '多屏联动方案', type: 'text', value: '' },
      { name: '第三方应用生态', type: 'text', value: '' },
      { name: 'AR-HUD', type: 'yesno', value: '' },
      { name: '手势控制', type: 'yesno', value: '' },
      { name: '面部识别', type: 'yesno', value: '' }
    ]
  },
  {
    key: 'ad',
    name: '辅助驾驶',
    items: [
      { name: '自动驾驶级别', type: 'select', options: ['L2','L2+','L3','其他'], value: '' },
      { name: '前视摄像头数量', type: 'number', value: '' },
      { name: '毫米波雷达数量', type: 'number', value: '' },
      { name: '激光雷达数量', type: 'number', value: '' },
      { name: '算力平台TOPS', type: 'number', value: '' },
      { name: '高速NOA', type: 'yesno', value: '' },
      { name: '城市NOA', type: 'yesno', value: '' },
      { name: '自动泊车', type: 'yesno', value: '' },
      { name: '记忆泊车', type: 'yesno', value: '' },
      { name: '远程召唤', type: 'yesno', value: '' }
    ]
  },
  {
    key: 'interior',
    name: '内饰体验',
    items: [
      { name: '座椅材质', type: 'select', options: ['真皮','仿皮','Nappa','Alcantara','织物','其他'], value: '' },
      { name: '前排座椅加热', type: 'yesno', value: '' },
      { name: '前排座椅通风', type: 'yesno', value: '' },
      { name: '前排座椅按摩', type: 'yesno', value: '' },
      { name: '后排座椅加热', type: 'yesno', value: '' },
      { name: '音响品牌', type: 'text', value: '' },
      { name: '扬声器数量', type: 'number', value: '' },
      { name: '内饰氛围灯', type: 'yesno', value: '' },
      { name: '空调分区数', type: 'select', options: ['单区','双区','三区','四区'], value: '' },
      { name: '空气净化系统', type: 'yesno', value: '' }
    ]
  },
  {
    key: 'convenience',
    name: '空间与便利设施',
    items: [
      { name: '座椅布局', type: 'select', options: ['2座','4座','5座','6座','7座'], value: '' },
      { name: '后备箱容积L', type: 'number', value: '' },
      { name: '后排座椅放倒比例', type: 'text', value: '' },
      { name: '前备箱容积L', type: 'number', value: '' },
      { name: '电动尾门', type: 'yesno', value: '' },
      { name: '感应尾门', type: 'yesno', value: '' },
      { name: '全景天窗', type: 'yesno', value: '' },
      { name: '无钥匙进入', type: 'yesno', value: '' },
      { name: '手机无线充电', type: 'yesno', value: '' },
      { name: '对外放电功率kW', type: 'number', value: '' }
    ]
  },
  {
    key: 'driving',
    name: '动力与驾驶感受',
    items: [
      { name: '驱动形式', type: 'select', options: ['前驱','后驱','四驱'], value: '' },
      { name: '电机类型', type: 'select', options: ['永磁同步','交流异步','双电机','其他'], value: '' },
      { name: '最大功率kW', type: 'number', value: '' },
      { name: '最大扭矩N·m', type: 'number', value: '' },
      { name: '0-100km/h加速s', type: 'number', value: '' },
      { name: '最高车速km/h', type: 'number', value: '' },
      { name: '前悬架类型', type: 'text', value: '' },
      { name: '后悬架类型', type: 'text', value: '' },
      { name: '转向助力', type: 'select', options: ['电动助力','电子液压','机械液压'], value: '' },
      { name: '驾驶模式', type: 'text', value: '' }
    ]
  },
  {
    key: 'range',
    name: '续航与补能',
    items: [
      { name: 'CLTC续航km', type: 'number', value: '' },
      { name: 'WLTP续航km', type: 'number', value: '' },
      { name: '电池类型', type: 'select', options: ['磷酸铁锂','三元锂','半固态','固态','其他'], value: '' },
      { name: '电池容量kWh', type: 'number', value: '' },
      { name: '快充功率kW', type: 'number', value: '' },
      { name: '快充时间30-80% min', type: 'number', value: '' },
      { name: '慢充时间0-100% h', type: 'number', value: '' },
      { name: '电池包质保', type: 'text', value: '' },
      { name: '对外放电V2L', type: 'yesno', value: '' },
      { name: '换电支持', type: 'yesno', value: '' }
    ]
  },
  {
    key: 'safety',
    name: '车辆安全配置',
    items: [
      { name: '气囊数量', type: 'number', value: '' },
      { name: '主动刹车AEB', type: 'yesno', value: '' },
      { name: '车道保持LKA', type: 'yesno', value: '' },
      { name: '盲点监测BSD', type: 'yesno', value: '' },
      { name: '自适应巡航ACC', type: 'yesno', value: '' },
      { name: '车身扭转刚度N·m/deg', type: 'number', value: '' },
      { name: '高强度钢占比%', type: 'number', value: '' },
      { name: '360度全景影像', type: 'yesno', value: '' },
      { name: '透明底盘', type: 'yesno', value: '' },
      { name: '疲劳监测', type: 'yesno', value: '' }
    ]
  }
];

let vehicleModels = [];
let currentPositioningModel = null;

// 子标签切换
document.querySelectorAll('.positioning-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.positioningTab;
    document.querySelectorAll('.positioning-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.positioning-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(targetTab + 'Panel')?.classList.add('active');
    // ★ 切换到"潜在用户群"时，自动检测 SharedDataStore 中是否有虚拟消费者数据
    if (targetTab === 'potentialUsers' && typeof SharedDataStore !== 'undefined') {
      var existingVCs = SharedDataStore.getVirtualConsumers();
      if (existingVCs && existingVCs.length > 0) {
        updatePotentialImportStatus();
      }
    }
  });
});

// 渲染维度输入控件
function renderDimensionInput(item, modKey, idx) {
  const onChange = `updateConfigItem('${modKey}', ${idx}, this.value)`;
  if (item.type === 'select') {
    return `<select onchange="${onChange}">
      <option value="">请选择</option>
      ${item.options.map(opt => `<option value="${opt}" ${item.value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
    </select>`;
  }
  if (item.type === 'yesno') {
    return `<select onchange="${onChange}">
      <option value="">请选择</option>
      <option value="是" ${item.value === '是' ? 'selected' : ''}>是</option>
      <option value="否" ${item.value === '否' ? 'selected' : ''}>否</option>
    </select>`;
  }
  if (item.type === 'number') {
    return `<input type="number" value="${item.value}" placeholder="输入数值" onchange="${onChange}" />`;
  }
  return `<input type="text" value="${item.value}" placeholder="输入内容" onchange="${onChange}" />`;
}

// 车型配置渲染
function renderVehicleConfigGrid() {
  const grid = document.getElementById('vehicleConfigGrid');
  if (!grid) return;
  grid.innerHTML = VEHICLE_MODULES.map(mod => `
    <div class="config-module" data-module="${mod.key}">
      <div class="config-module-header">
        <h4>${mod.name}</h4>
      </div>
      <div class="config-module-items" id="configItems_${mod.key}">
        ${mod.items.map((item, idx) => `
          <div class="config-item">
            <span class="config-item-label" title="${item.name}">${item.name}</span>
            <div class="config-item-input">
              ${renderDimensionInput(item, mod.key, idx)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function updateConfigItem(moduleKey, index, value) {
  const mod = VEHICLE_MODULES.find(m => m.key === moduleKey);
  if (mod && mod.items[index] !== undefined) {
    mod.items[index].value = value;
  }
}

// 车型选择下拉框更新
function updateModelSelects() {
  const selects = ['configModelSelect', 'targetModelSelect', 'potentialModelSelect'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">请选择车型</option>' +
      vehicleModels.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    sel.value = current;
  });
}

// 新增车型
document.getElementById('addModelBtn')?.addEventListener('click', () => {
  const name = prompt('请输入车型名称：');
  if (name && name.trim()) {
    const id = 'M' + Date.now().toString(36).toUpperCase();
    vehicleModels.push({ id, name: name.trim(), config: {} });
    updateModelSelects();
    document.getElementById('configModelSelect').value = id;
  }
});

// 车型选择变化
document.getElementById('configModelSelect')?.addEventListener('change', (e) => {
  currentPositioningModel = e.target.value;
  if (currentPositioningModel) {
    const model = vehicleModels.find(m => m.id === currentPositioningModel);
    if (model && model.config) {
      VEHICLE_MODULES.forEach(mod => {
        if (model.config[mod.key]) {
          mod.items.forEach(item => {
            const saved = model.config[mod.key].find(i => i.name === item.name);
            if (saved) {
              item.value = saved.value;
            }
          });
        }
      });
    }
    renderVehicleConfigGrid();
  }
});

// 保存配置
document.getElementById('saveVehicleConfigBtn')?.addEventListener('click', () => {
  if (!currentPositioningModel) {
    alert('请先选择或新增一个车型');
    return;
  }
  const model = vehicleModels.find(m => m.id === currentPositioningModel);
  if (model) {
    VEHICLE_MODULES.forEach(mod => {
      model.config[mod.key] = mod.items.map(item => ({ ...item }));
    });
    alert('车型配置已保存');
  }
});

// 加载示例数据（长安深蓝S7）
const DEMO_DATA = {
  exterior: ['SUV', '0.258', '4750', '1930', '1625', '2900', '分体式LED', '星耀黑/星云白/极光绿', '21', '低风阻设计'],
  cockpit: ['15.6英寸', '高通骁龙8155', '科大讯飞', 'DeepLink OS', '是', '三联屏联动', '丰富', '是', '是', '是'],
  ad: ['L2+', '5', '5', '1', '200', '是', '否', '是', '否', '否'],
  interior: ['Nappa', '是', '是', '是', '是', '索尼', '14', '是', '三区', '是'],
  convenience: ['5座', '445', '40:60', '52', '是', '是', '是', '是', '是', '3.3'],
  driving: ['后驱', '永磁同步', '190', '320', '7.5', '180', '麦弗逊', '多连杆', '电动助力', '标准/运动/经济'],
  range: ['620', '520', '三元锂', '80', '120', '30', '8', '首任车主终身质保', '是', '否'],
  safety: ['6', '是', '是', '是', '是', '35000', '80', '是', '是', '是']
};

function loadDemoConfig() {
  // 自动创建示例车型（如果不存在）
  const demoName = '长安深蓝S7';
  let model = vehicleModels.find(m => m.name === demoName);
  if (!model) {
    const id = 'M' + Date.now().toString(36).toUpperCase();
    model = { id, name: demoName, config: {} };
    vehicleModels.push(model);
    updateModelSelects();
  }
  currentPositioningModel = model.id;
  document.getElementById('configModelSelect').value = model.id;

  // 填充示例数据
  VEHICLE_MODULES.forEach(mod => {
    const values = DEMO_DATA[mod.key] || [];
    mod.items.forEach((item, idx) => {
      item.value = values[idx] || '';
    });
  });
  renderVehicleConfigGrid();
}

document.getElementById('loadDemoConfigBtn')?.addEventListener('click', loadDemoConfig);

// 导入配置（简化版：从文本解析）
document.getElementById('importVehicleConfigBtn')?.addEventListener('click', () => {
  const text = prompt('请粘贴车型配置文本（每行一个维度，格式：模块名|维度名=值）：\n例如：外观设计|车身造型风格=轿车');
  if (!text) return;
  const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
  lines.forEach(line => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      const modName = parts[0];
      const itemParts = parts[1].split('=').map(p => p.trim());
      const itemName = itemParts[0];
      const itemValue = itemParts[1] || '';
      const mod = VEHICLE_MODULES.find(m => m.name === modName);
      if (mod) {
        const existing = mod.items.find(i => i.name === itemName);
        if (existing) {
          existing.value = itemValue;
        }
      }
    }
  });
  renderVehicleConfigGrid();
});

// 初始化目标用户群场次筛选下拉框
function initTargetSessionFilter() {
  const sessionFilter = document.getElementById('targetSessionFilter');
  if (!sessionFilter) return;
  sessionFilter.innerHTML = '<option value="">全部场次</option>' +
    researchSessions.map(s => `<option value="${s.id}">${s.id} - ${s.product} (${s.type})</option>`).join('');
}

// 车型选择变化时更新场次筛选
function updateTargetSessionFilter(modelId) {
  const sessionFilter = document.getElementById('targetSessionFilter');
  if (!sessionFilter) return;
  if (!modelId) {
    sessionFilter.innerHTML = '<option value="">全部场次</option>';
    return;
  }
  const model = vehicleModels.find(m => m.id === modelId);
  if (!model) return;
  // 获取与该车型名称相关的场次（简单匹配：场次product包含车型名称或反之）
  const modelName = model.name;
  const relatedSessions = researchSessions.filter(s => {
    return s.product.includes(modelName) || modelName.includes(s.product.replace('本品牌', '').replace('车型', '').trim());
  });
  sessionFilter.innerHTML = '<option value="">全部场次</option>' +
    (relatedSessions.length > 0 ? relatedSessions : researchSessions)
      .map(s => `<option value="${s.id}">${s.id} - ${s.product} (${s.type})</option>`).join('');
}

// 目标用户群分析（模拟）
// 存储当前分析结果，供点击查看用户列表使用
let currentTargetAnalysis = null;

// 打开群组用户列表弹窗
function openGroupUsersModal(groupName, groupUsers) {
  const modal = document.getElementById('groupUsersModal');
  const title = document.getElementById('groupUsersModalTitle');
  const list = document.getElementById('groupUsersList');
  if (!modal || !list) return;

  title.textContent = `${groupName} - 用户列表 (${groupUsers.length}人)`;
  list.innerHTML = groupUsers.map(user => {
    const avatarUrl = generateCartoonAvatar(user, 40);
    return `
      <div class="group-user-item" onclick="openUserDetail('${user.id}')">
        <img src="${avatarUrl}" alt="${user.name || '用户'}" />
        <div class="user-info">
          <div class="user-name">${user.name || '未命名用户'}</div>
          <div class="user-meta">${user.age || ''}岁 · ${user.gender || ''} · ${user.city || ''} · ${user.currentCar || '无车'}</div>
        </div>
        <div class="user-score">${Math.floor(Math.random() * 20 + 75)}%</div>
      </div>
    `;
  }).join('');
  modal.classList.remove('hidden');
}

function closeGroupUsersModal() {
  document.getElementById('groupUsersModal')?.classList.add('hidden');
}

document.getElementById('analyzeTargetUsersBtn')?.addEventListener('click', () => {
  const modelId = document.getElementById('targetModelSelect')?.value;
  if (!modelId) {
    alert('请先选择车型');
    return;
  }
  const model = vehicleModels.find(m => m.id === modelId);
  const sessionId = document.getElementById('targetSessionFilter')?.value;

  // 根据场次筛选用户样本
  let filteredUsers = userSamples;
  if (sessionId) {
    filteredUsers = userSamples.filter(u => u.sessionId === sessionId);
  }

  document.getElementById('targetUsersEmpty')?.classList.add('hidden');
  document.getElementById('targetResults')?.classList.remove('hidden');

  // 基于实际筛选出的用户样本生成分析结果
  const userCount = filteredUsers.length;
  const sessionLabel = sessionId ? `（${sessionId}场次，共${userCount}个样本）` : `（全部场次，共${userCount}个样本）`;

  // 定义分析群组及其对应的用户
  const groups = [
    {
      name: '年轻家庭',
      score: 85,
      desc: '该车型的大空间、智能座舱配置非常契合年轻家庭对出行品质的追求，辅助驾驶功能也能缓解育儿家庭的驾驶疲劳。',
      isCore: true,
      users: filteredUsers.filter(u => u.hasChildren && parseInt(u.age) < 40)
    },
    {
      name: '职场精英',
      score: 72,
      desc: '智能座舱和辅助驾驶是吸引点，但续航表现是主要顾虑。建议强化续航优势的传播。',
      isCore: false,
      users: filteredUsers.filter(u => !u.hasChildren && parseInt(u.age) >= 25 && parseInt(u.age) <= 35)
    },
    {
      name: '品质生活家',
      score: 68,
      desc: '内饰体验和外观设计是核心吸引点。动力与驾驶感受也有不错的评价。',
      isCore: false,
      users: filteredUsers.filter(u => parseInt(u.age) >= 35 && (u.income || '').includes('50'))
    }
  ];

  // 确定核心目标人群
  const coreGroups = groups.filter(g => g.isCore);
  const nonCoreGroups = groups.filter(g => !g.isCore);

  // 生成汇总面板
  const summaryPanel = document.getElementById('targetSummaryPanel');
  if (summaryPanel) {
    summaryPanel.classList.remove('hidden');
    document.getElementById('targetSummaryBadge').textContent = `共${userCount}个样本`;
    document.getElementById('targetSummaryContent').innerHTML = `
      <div class="target-summary-item">
        <span>分析车型</span>
        <strong>${model?.name || '未选择'}</strong>
      </div>
      <div class="target-summary-item">
        <span>筛选场次</span>
        <strong>${sessionId || '全部场次'}</strong>
      </div>
      <div class="target-summary-item">
        <span>用户样本</span>
        <strong>${userCount}人</strong>
      </div>
      <div class="target-summary-item">
        <span>识别群组</span>
        <strong>${groups.length}个</strong>
      </div>
      <div class="target-summary-item">
        <span>核心目标人群</span>
        <strong style="color:#34d399;">${coreGroups.length}个${coreGroups.length > 0 ? '（' + coreGroups.map(g => g.name).join('、') + '）' : ''}</strong>
      </div>
      <div class="target-summary-item">
        <span>最高兴趣度</span>
        <strong style="color:#22d3ee;">${Math.max(...groups.map(g => g.score))}%</strong>
      </div>
    `;
  }

  document.getElementById('targetChart').innerHTML = `
    <h4 style="margin:0 0 12px 0;font-size:14px;">目标用户群组兴趣分布 ${sessionLabel}</h4>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${groups.map((g, i) => `
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="width:80px;font-size:13px;">${g.name}</span>
          <div style="flex:1;height:20px;background:rgba(3,10,22,0.5);border-radius:4px;overflow:hidden;">
            <div style="width:${g.score}%;height:100%;background:rgba(34,211,238,0.5);border-radius:4px;"></div>
          </div>
          <span style="width:40px;text-align:right;font-size:13px;color:#22d3ee;font-weight:600;">${g.score}%</span>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('targetAnalysis').innerHTML = `
    <h4 style="margin:0 0 12px 0;font-size:14px;">AI 分析结果 ${sessionLabel}</h4>
    ${groups.map((g, i) => `
      <div class="user-group-card clickable" onclick="openGroupUsersModal('${g.name}', currentTargetAnalysis[${i}].users)">
        <div class="group-card-rank">${i + 1}</div>
        <div class="group-card-info">
          <h4>${g.name}
            ${g.isCore ? '<span class="core-target-badge yes">核心目标人群</span>' : '<span class="core-target-badge no">非核心</span>'}
          </h4>
          <p>${g.desc}</p>
          <p style="font-size:12px;color:var(--muted);margin-top:4px;">
            点击查看该群组${g.users.length}位用户的详细列表
          </p>
        </div>
        <div class="group-card-score">${g.score}%</div>
      </div>
    `).join('')}
  `;

  // 保存分析结果
  currentTargetAnalysis = groups;
});

// 关闭弹窗事件（点击遮罩层）
document.getElementById('groupUsersModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'groupUsersModal') {
    closeGroupUsersModal();
  }
});

// 潜在用户群分析（使用AI评估虚拟消费者兴趣度）
document.getElementById('analyzePotentialUsersBtn')?.addEventListener('click', () => {
  const modelId = document.getElementById('potentialModelSelect')?.value;
  if (!modelId) {
    alert('请先选择车型');
    return;
  }
  document.getElementById('potentialUsersEmpty')?.classList.add('hidden');
  document.getElementById('potentialResults')?.classList.remove('hidden');

  // 检查是否已导入虚拟消费者
  if (typeof SharedDataStore === 'undefined') {
    showImportPlaceholder('共享数据桥接模块未加载');
    return;
  }

  var virtualConsumers = SharedDataStore.getVirtualConsumers();
  if (!virtualConsumers || virtualConsumers.length === 0) {
    showImportPlaceholder('请先点击"导入虚拟消费者"按钮导入数据');
    return;
  }

  // 获取当前车型配置
  var vehicleConfig = getVehicleConfigForAnalysis(modelId);

  // 使用AI评估算法计算兴趣度
  var interestResults = SharedDataStore.evaluateInterest(virtualConsumers, vehicleConfig);

  // 按群组聚合结果
  var groupResults = aggregateByGroup(interestResults);

  // 渲染图表
  renderPotentialChart(groupResults);

  // 渲染AI分析结果
  renderPotentialAnalysis(groupResults, vehicleConfig);

  // 渲染高亮提示
  renderPotentialHighlight(groupResults);
});

// 获取车型配置用于分析
function getVehicleConfigForAnalysis(modelId) {
  var model = vehicleModels.find(function(m) { return m.id === modelId; });
  var config = {
    priceRange: '20-30万',
    features: {
      hasSmartCockpit: true,
      hasLargeSpace: true,
      hasLuxuryConfig: false,
      isValueForMoney: true,
      hasSportDesign: false,
      hasLongRange: true
    },
    techLevel: '高',
    safetyLevel: '高',
    designStyle: '现代简约'
  };
  if (model) {
    config.name = model.name;
    // 从车型配置模块中提取信息
    if (model.modules) {
      for (var i = 0; i < model.modules.length; i++) {
        var mod = model.modules[i];
        if (mod.title === '智能化与座舱') {
          config.features.hasSmartCockpit = true;
          config.techLevel = '高';
        }
        if (mod.title === '空间与舒适') {
          config.features.hasLargeSpace = true;
        }
        if (mod.title === '安全与辅助驾驶') {
          config.safetyLevel = '高';
        }
        if (mod.title === '动力与续航') {
          config.features.hasLongRange = true;
        }
      }
    }
  }
  return config;
}

// 按群组聚合兴趣度结果
function aggregateByGroup(interestResults) {
  var groupMap = {};
  for (var i = 0; i < interestResults.length; i++) {
    var result = interestResults[i];
    var vc = result.consumer;
    var group = vc.group;
    var groupName = group ? group.groupName : '未分类';
    if (!groupMap[groupName]) {
      groupMap[groupName] = {
        groupName: groupName,
        lifeStageLabel: group ? group.lifeStageLabel : '',
        valueOrientation: group ? group.valueOrientation : '',
        keywords: group ? group.keywords : [],
        results: [],
        totalScore: 0,
        avgScore: 0,
        consumerCount: 0
      };
    }
    groupMap[groupName].results.push(result);
    groupMap[groupName].totalScore += result.score;
    groupMap[groupName].consumerCount++;
  }
  // 计算平均分
  var groups = [];
  var keys = Object.keys(groupMap);
  for (var k = 0; k < keys.length; k++) {
    var g = groupMap[keys[k]];
    g.avgScore = g.consumerCount > 0 ? Math.round(g.totalScore / g.consumerCount) : 0;
    groups.push(g);
  }
  // 按平均分降序排列
  groups.sort(function(a, b) { return b.avgScore - a.avgScore; });
  return groups;
}

// 渲染潜在用户兴趣分布图表
function renderPotentialChart(groupResults) {
  var container = document.getElementById('potentialChart');
  if (!container) return;
  var maxScore = 100;
  var html = '<h4 style="margin:0 0 12px 0;font-size:14px;">各群组虚拟消费者对该车型的兴趣度分布</h4>';
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';
  for (var i = 0; i < groupResults.length; i++) {
    var gr = groupResults[i];
    var barWidth = (gr.avgScore / maxScore * 100).toFixed(0);
    var barColor = gr.avgScore >= 80 ? 'rgba(52,211,153,0.5)' : (gr.avgScore >= 60 ? 'rgba(34,211,238,0.5)' : 'rgba(251,77,109,0.5)');
    html += '<div style="display:flex;align-items:center;gap:12px;">';
    html += '<span style="width:100px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + gr.groupName + '">' + gr.groupName + '</span>';
    html += '<span style="font-size:10px;color:#8fa8bd;width:40px;">' + gr.consumerCount + '人</span>';
    html += '<div style="flex:1;height:18px;background:rgba(3,10,22,0.5);border-radius:4px;overflow:hidden;">';
    html += '<div style="width:' + barWidth + '%;height:100%;background:' + barColor + ';border-radius:4px;transition:width 0.5s ease;"></div>';
    html += '</div>';
    html += '<span style="width:40px;text-align:right;font-size:13px;color:#22d3ee;font-weight:600;">' + gr.avgScore + '%</span>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

// 渲染AI分析结果
function renderPotentialAnalysis(groupResults, vehicleConfig) {
  var container = document.getElementById('potentialAnalysis');
  if (!container) return;
  var html = '<h4 style="margin:0 0 12px 0;font-size:14px;">AI 分析结果（基于车型：' + (vehicleConfig.name || '未命名车型') + '）</h4>';
  // 显示前5个群组
  var topGroups = groupResults.slice(0, Math.min(5, groupResults.length));
  for (var i = 0; i < topGroups.length; i++) {
    var gr = topGroups[i];
    var scoreClass = gr.avgScore >= 80 ? 'highlight' : '';
    var interestLevel = gr.avgScore >= 80 ? '🔥 高度感兴趣' : (gr.avgScore >= 60 ? '👍 较感兴趣' : (gr.avgScore >= 40 ? '📊 兴趣一般' : '📉 兴趣较低'));
    html += '<div class="user-group-card ' + scoreClass + ' clickable" onclick="showGroupConsumerDetail(\'' + gr.groupName + '\')">';
    html += '<div class="group-card-rank">' + (i + 1) + '</div>';
    html += '<div class="group-card-info">';
    html += '<h4>' + gr.groupName + ' <span style="font-size:12px;color:#8fa8bd;">（' + gr.lifeStageLabel + ' · ' + gr.valueOrientation + '型）</span></h4>';
    html += '<p>' + generateGroupInterestSummary(gr) + '</p>';
    html += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">';
    for (var kw = 0; kw < gr.keywords.length; kw++) {
      html += '<span style="font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(34,211,238,0.1);color:#67e8f9;">' + gr.keywords[kw] + '</span>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div class="group-card-score">' + interestLevel + '<br/><span style="font-size:16px;">' + gr.avgScore + '%</span></div>';
    html += '</div>';
  }
  container.innerHTML = html;
}

// 生成群组兴趣摘要
function generateGroupInterestSummary(groupResult) {
  var score = groupResult.avgScore;
  var name = groupResult.groupName;
  if (score >= 85) {
    return name + '群体对该车型表现出强烈兴趣，核心配置与其消费理念高度契合。建议优先投放精准营销内容，并提供专属试驾体验。';
  } else if (score >= 70) {
    return name + '群体对该车型有较高兴趣，但存在一些顾虑点。建议通过针对性内容营销消除疑虑，突出差异化优势。';
  } else if (score >= 50) {
    return name + '群体兴趣度中等，部分配置需求与该车型定位有偏差。建议分析其核心诉求，评估产品改进或差异化营销空间。';
  } else {
    return name + '群体目前兴趣度较低，可能不是当前车型的核心目标人群。建议关注其需求变化，待产品迭代后再评估。';
  }
}

// 渲染高亮提示
function renderPotentialHighlight(groupResults) {
  var container = document.getElementById('potentialHighlight');
  if (!container) return;
  if (groupResults.length === 0) return;
  var topGroup = groupResults[0];
  var lowGroup = groupResults[groupResults.length - 1];
  var html = '';
  if (topGroup.avgScore >= 80) {
    html += '<strong style="color:#34d399;">✅ 核心发现：</strong>"' + topGroup.groupName + '"群体兴趣度最高（' + topGroup.avgScore + '%），建议作为潜在用户拓展的重点方向。';
  }
  if (lowGroup.avgScore < 40) {
    html += '<br/><strong style="color:#fb4d6d;">⚠️ 注意：</strong>"' + lowGroup.groupName + '"群体兴趣度较低（' + lowGroup.avgScore + '%），该群体与当前车型定位匹配度不足，暂不建议重点投入。';
  }
  html += '<br/><strong style="color:#22d3ee;">💡 建议：</strong>结合目标用户群分析结果，对比核心目标群与高兴趣潜在群的差异，优化用户定位策略。';
  container.innerHTML = html;
  container.classList.remove('hidden');
}

// 显示导入占位提示
function showImportPlaceholder(msg) {
  document.getElementById('potentialChart').innerHTML = '<div class="empty-state"><p>' + msg + '</p></div>';
  document.getElementById('potentialAnalysis').innerHTML = '';
  document.getElementById('potentialHighlight')?.classList.add('hidden');
}

// 显示群组消费者详情
function showGroupConsumerDetail(groupName) {
  if (typeof SharedDataStore === 'undefined') return;
  var vcs = SharedDataStore.getVirtualConsumers();
  var groupVCs = [];
  for (var i = 0; i < vcs.length; i++) {
    if (vcs[i].group && vcs[i].group.groupName === groupName) {
      groupVCs.push(vcs[i]);
    }
  }
  // 使用现有的弹窗显示群组用户
  var modal = document.getElementById('groupUsersModal');
  var title = document.getElementById('groupUsersModalTitle');
  var list = document.getElementById('groupUsersList');
  if (!modal || !title || !list) return;
  title.textContent = groupName + ' - 虚拟消费者详情（' + groupVCs.length + '人）';
  var html = '';
  for (var i = 0; i < groupVCs.length; i++) {
    var vc = groupVCs[i];
    var isDT = vc.type === 'digital_twin';
    var accVal = isDT ? (vc.accuracy || 0.75) : (vc.confidence || 0.75);
    html += '<div class="group-user-item">';
    html += '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,' + (isDT ? '#34d399,#22d3ee' : '#a78bfa,#3b82f6') + ');display:flex;align-items:center;justify-content:center;font-weight:700;color:#04111d;">' + (vc.avatar || '?') + '</div>';
    html += '<div class="user-info">';
    html += '<div class="user-name">' + vc.name + ' <span style="font-size:11px;color:#8fa8bd;">(' + (isDT ? '数字分身' : '完全虚拟') + ')</span></div>';
    html += '<div class="user-meta">' + (vc.brief || vc.meta || '') + ' | 准确度：' + (accVal * 100).toFixed(0) + '%</div>';
    html += '</div>';
    html += '<div class="user-score" style="font-size:12px;">ID: ' + vc.id + '</div>';
    html += '</div>';
  }
  list.innerHTML = html || '<div class="empty-state"><p>该群组暂无虚拟消费者数据</p></div>';
  modal.classList.remove('hidden');
}

// 导入虚拟消费者（从虚拟消费者平台获取数据）
document.getElementById('importVirtualConsumersBtn')?.addEventListener('click', () => {
  if (typeof SharedDataStore === 'undefined') {
    alert('共享数据桥接模块未加载，请确保 shared-data-bridge.js 已引入');
    return;
  }
  // 从 SharedDataStore 获取虚拟消费者平台同步过来的数据
  var vcs = SharedDataStore.getVirtualConsumers();
  
  if (!vcs || vcs.length === 0) {
    // 虚拟消费者平台尚未同步数据
    showToast('请先在虚拟消费者Agent页面打开一次，平台会自动同步虚拟消费者数据。\n然后回到此页面点击"导入虚拟消费者"即可。', 'warning');
    // 显示提示占位内容
    if (typeof showImportPlaceholder === 'function') {
      showImportPlaceholder('尚未从虚拟消费者平台获取数据。请先打开虚拟消费者Agent页面完成数据同步。');
    }
    return;
  }
  
  // 已有虚拟消费者数据（由虚拟消费者平台同步），直接用于分析
  var dtCount = 0, synCount = 0;
  for (var i = 0; i < vcs.length; i++) {
    if (vcs[i].type === 'digital_twin') dtCount++;
    else synCount++;
  }
  showToast('已从虚拟消费者平台导入 ' + vcs.length + ' 个虚拟消费者（数字分身 ' + dtCount + ' + 完全虚拟 ' + synCount + '）', 'success');
  updatePotentialImportStatus();
});

// 加载演示虚拟消费者数据
function loadDemoVirtualConsumers() {
  // 构建与虚拟消费者平台一致的演示数据
  var demoVCs = [
    // 5个数字分身
    { id: 'DT-U-0001', name: '张明远', avatar: '张', brief: '32岁·互联网产品总监·一线城市', meta: '年收入 65万 | 已婚有1孩 | 每日通勤 50km', type: 'digital_twin', accuracy: 0.88, confidence: 0.90, age: 32, gender: '男', maritalStatus: '已婚', children: '1个孩子', tags: [
      { name: '决策风格', value: '理性分析型', score: 0.82 }, { name: '功能偏好', value: '智能座舱优先', score: 0.85 },
      { name: '价格敏感度', value: '较低', score: 0.28 }, { name: '科技偏好', value: '极高', score: 0.91 },
      { name: '品牌忠诚度', value: '中等', score: 0.45 }, { name: '安全关注度', value: '高', score: 0.76 },
      { name: '外观偏好', value: '科技简约风', score: 0.72 }, { name: '续航焦虑', value: '较低', score: 0.32 }
    ]},
    { id: 'DT-U-0002', name: '李芳华', avatar: '李', brief: '38岁·二孩妈妈·新一线城市', meta: '年收入 42万 | 已婚有2孩 | 周末郊游频繁', type: 'digital_twin', accuracy: 0.91, confidence: 0.93, age: 38, gender: '女', maritalStatus: '已婚', children: '2个孩子', tags: [
      { name: '决策风格', value: '感性直觉型', score: 0.65 }, { name: '功能偏好', value: '空间与安全优先', score: 0.88 },
      { name: '价格敏感度', value: '较高', score: 0.71 }, { name: '科技偏好', value: '中等', score: 0.45 },
      { name: '品牌忠诚度', value: '较高', score: 0.68 }, { name: '安全关注度', value: '极高', score: 0.93 },
      { name: '外观偏好', value: '稳重家用风', score: 0.55 }, { name: '续航焦虑', value: '高', score: 0.78 }
    ]},
    { id: 'DT-U-0003', name: '王浩然', avatar: '王', brief: '26岁·自由摄影师·一线城市', meta: '年收入 28万 | 未婚 | 社交活跃', type: 'digital_twin', accuracy: 0.85, confidence: 0.87, age: 26, gender: '男', maritalStatus: '未婚', children: '无子女', tags: [
      { name: '决策风格', value: '冲动体验型', score: 0.75 }, { name: '功能偏好', value: '外观与性能优先', score: 0.82 },
      { name: '价格敏感度', value: '中等', score: 0.48 }, { name: '科技偏好', value: '高', score: 0.80 },
      { name: '品牌忠诚度', value: '低', score: 0.18 }, { name: '安全关注度', value: '中等', score: 0.52 },
      { name: '外观偏好', value: '运动潮流风', score: 0.89 }, { name: '续航焦虑', value: '较低', score: 0.35 }
    ]},
    { id: 'DT-U-0004', name: '陈建国', avatar: '陈', brief: '45岁·企业高管·一线城市', meta: '年收入 120万 | 已婚有2孩 | 商务出行', type: 'digital_twin', accuracy: 0.94, confidence: 0.95, age: 45, gender: '男', maritalStatus: '已婚', children: '2个孩子', tags: [
      { name: '决策风格', value: '品质导向型', score: 0.88 }, { name: '功能偏好', value: '豪华舒适优先', score: 0.90 },
      { name: '价格敏感度', value: '极低', score: 0.10 }, { name: '科技偏好', value: '高', score: 0.75 },
      { name: '品牌忠诚度', value: '极高', score: 0.92 }, { name: '安全关注度', value: '高', score: 0.82 },
      { name: '外观偏好', value: '豪华商务风', score: 0.85 }, { name: '续航焦虑', value: '中等', score: 0.50 }
    ]},
    { id: 'DT-U-0005', name: '赵小雪', avatar: '赵', brief: '29岁·新手宝妈·二线城市', meta: '年收入 18万 | 已婚有1婴 | 精打细算', type: 'digital_twin', accuracy: 0.87, confidence: 0.89, age: 29, gender: '女', maritalStatus: '已婚', children: '1个孩子', tags: [
      { name: '决策风格', value: '谨慎比价型', score: 0.78 }, { name: '功能偏好', value: '性价比优先', score: 0.86 },
      { name: '价格敏感度', value: '极高', score: 0.88 }, { name: '科技偏好', value: '较低', score: 0.25 },
      { name: '品牌忠诚度', value: '中等', score: 0.42 }, { name: '安全关注度', value: '高', score: 0.85 },
      { name: '外观偏好', value: '简约实用风', score: 0.40 }, { name: '续航焦虑', value: '高', score: 0.82 }
    ]},
    // 3个完全虚拟消费者
    { id: 'SYN-001', name: '年轻科技先锋', brief: '28岁·一线城市·科技从业者', type: 'synthetic', confidence: 0.82, age: 28, gender: '男', maritalStatus: '未婚', children: '无子女', tags: [
      { name: '决策风格', value: '理性分析型', score: 0.78 }, { name: '功能偏好', value: '智能座舱优先', score: 0.86 },
      { name: '价格敏感度', value: '较低', score: 0.32 }, { name: '科技偏好', value: '极高', score: 0.93 },
      { name: '品牌忠诚度', value: '中等', score: 0.48 }, { name: '安全关注度', value: '高', score: 0.72 },
      { name: '外观偏好', value: '科技简约风', score: 0.76 }, { name: '续航焦虑', value: '较低', score: 0.30 }
    ]},
    { id: 'SYN-002', name: '家庭实用主义者', brief: '35岁·新一线·二孩家庭', type: 'synthetic', confidence: 0.79, age: 35, gender: '女', maritalStatus: '已婚', children: '2个孩子', tags: [
      { name: '决策风格', value: '感性直觉型', score: 0.62 }, { name: '功能偏好', value: '空间与安全优先', score: 0.85 },
      { name: '价格敏感度', value: '较高', score: 0.68 }, { name: '科技偏好', value: '中等', score: 0.42 },
      { name: '品牌忠诚度', value: '较高', score: 0.65 }, { name: '安全关注度', value: '极高', score: 0.91 },
      { name: '外观偏好', value: '稳重家用风', score: 0.52 }, { name: '续航焦虑', value: '高', score: 0.76 }
    ]},
    { id: 'SYN-003', name: '潮流体验达人', brief: '25岁·一线城市·追求个性', type: 'synthetic', confidence: 0.76, age: 25, gender: '男', maritalStatus: '未婚', children: '无子女', tags: [
      { name: '决策风格', value: '冲动体验型', score: 0.72 }, { name: '功能偏好', value: '外观与性能优先', score: 0.80 },
      { name: '价格敏感度', value: '中等', score: 0.50 }, { name: '科技偏好', value: '高', score: 0.78 },
      { name: '品牌忠诚度', value: '低', score: 0.22 }, { name: '安全关注度', value: '中等', score: 0.48 },
      { name: '外观偏好', value: '运动潮流风', score: 0.87 }, { name: '续航焦虑', value: '较低', score: 0.38 }
    ]}
  ];

  // 为演示数据添加群组信息
  for (var i = 0; i < demoVCs.length; i++) {
    var vc = demoVCs[i];
    if (typeof getUserGroup === 'function') {
      vc.group = getUserGroup({
        id: vc.id,
        name: vc.name,
        age: vc.age || 30,
        gender: vc.gender || '男',
        maritalStatus: vc.maritalStatus || '未婚',
        children: vc.children || '无子女'
      });
    }
  }

  SharedDataStore.setVirtualConsumers(demoVCs);
  showToast('已导入 ' + demoVCs.length + ' 个虚拟消费者（含数字分身和完全虚拟消费者）', 'success');
}

// 更新导入状态提示
function updatePotentialImportStatus() {
  var vcs = SharedDataStore ? SharedDataStore.getVirtualConsumers() : [];
  var container = document.getElementById('potentialUsersContent');
  if (!container) return;
  if (vcs.length > 0) {
    var dtCount = 0, synCount = 0;
    for (var i = 0; i < vcs.length; i++) {
      if (vcs[i].type === 'digital_twin') dtCount++;
      else synCount++;
    }
    // 更新导入按钮文案
    var importBtn = document.getElementById('importVirtualConsumersBtn');
    if (importBtn) importBtn.textContent = '已导入 ' + vcs.length + ' 个虚拟消费者（数字分身 ' + dtCount + ' + 完全虚拟 ' + synCount + '）';
  }
}

// 初始化用户定位
function initUserPositioning() {
  renderVehicleConfigGrid();
  updateModelSelects();
  initTargetSessionFilter();
}

// 目标车型选择变化时更新场次筛选
document.getElementById('targetModelSelect')?.addEventListener('change', (e) => {
  updateTargetSessionFilter(e.target.value);
});

// 暴露全局函数
window.updateConfigItem = updateConfigItem;
window.initUserPositioning = initUserPositioning;

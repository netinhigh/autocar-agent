/* ================================================================
   虚拟消费者平台 — Virtual Consumer OS v2.0
   app.js — 两页面架构：虚拟人格构建 + 智能问答交互
   已集成共享数据桥接模块 (shared-data-bridge.js)
   ================================================================ */

// ========== 群组信息（与用户洞察Agent保持一致） ==========
var GROUP_CLASSIFICATION = {
  lifeStages: (typeof UNIFIED_LIFE_STAGES !== 'undefined') ? UNIFIED_LIFE_STAGES : [],
  valueOrientations: (typeof UNIFIED_VALUE_ORIENTATIONS !== 'undefined') ? UNIFIED_VALUE_ORIENTATIONS : ['保守', '稳健', '前卫'],
  groupNameMap: (typeof GROUP_NAME_MAP !== 'undefined') ? GROUP_NAME_MAP : {}
};

// 为每个虚拟消费者补充群组信息
function assignGroupToVC(vc) {
  if (vc.group) return; // 已有群组信息
  // 基于用户特征推断群组
  var userInfo = {
    id: vc.id,
    name: vc.name,
    age: vc.age || 30,
    gender: vc.gender || (vc.brief && vc.brief.indexOf('女') >= 0 ? '女' : '男'),
    maritalStatus: vc.maritalStatus || (vc.brief && (vc.brief.indexOf('已婚') >= 0 || vc.brief.indexOf('孩') >= 0 || vc.brief.indexOf('宝') >= 0) ? '已婚' : '未婚'),
    children: vc.children || (vc.brief && vc.brief.indexOf('孩') >= 0 ? '1个孩子' : '无子女')
  };
  if (typeof getUserGroup === 'function') {
    vc.group = getUserGroup(userInfo);
  }
}

// ========== 模拟数据 ==========

// 5个真实用户基础数据（作为数字分身的"现实依托"）
// ============================================================
//  ID 编码体系说明
// ============================================================
// 真实用户（来自用户洞察平台的用户样本库）： U-001, U-002, ... U-036
// 数字分身（DT = Digital Twin）：           DT-U-001, DT-U-002, ... DT-U-036
//                                           ID主体 = 对应真实用户ID，加 DT- 前缀
// 完全虚拟消费者（VC = Virtual Consumer）： VC-001, VC-002, ... VC-007
//                                           与真实用户ID和数字分身ID均不冲突
// ============================================================

// 数字分身数据（来自用户洞察平台的用户样本，通过 SharedDataStore.syncToDigitalTwins() 生成）
// 初始为空，页面加载后用户点击"从用户洞察平台同步"时填充
var digitalTwins = [];

// 完全虚拟消费者（基于规则+统计生成，ID 格式 VC-XXX，与数字分身/真实用户编码区分）
// ===== 完全虚拟消费者数据（已清空）=====
// 用户登录后可自行创建和维护虚拟消费者
var syntheticPersonas = [];


// ===== 原虚构消费者属性赋值已清空 =====


// 准确度收敛历史（按数字分身 realUserId 索引，动态生成）
var accuracyConvergenceData = {};

// 访谈导入历史（DT ID 格式：DT-{userSample.id}）
var interviewHistory = [];

// 问答对话历史
var qaConversation = [];

// ========== 全局状态 ==========
var currentView = 'personaDashboard';
var currentQATarget = null;
var currentQATargetType = 'single';
var synthCounter = 8;  // 下一个完全虚拟消费者的序号（当前最大 VC-007）

// ★ 自动同步状态追踪
var autoSyncState = {
  lastDataVersion: 0,     // 上次同步时的用户样本版本号
  lastDtVersion: 0,       // 上次同步时的数字分身版本号
  isFirstLoad: true,      // 是否首次加载
  pollingTimer: null,     // 轮询定时器
  storageListener: null   // storage事件监听器引用
};

// ========== 工具函数 ==========
function showToast(msg, type) {
  type = type || 'info';
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}

function getAccClass(v) {
  if (v >= 0.90) return 'high';
  if (v >= 0.80) return 'mid';
  return 'low';
}

function getTagValue(tags, name) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].name === name) return tags[i].value;
  }
  return '—';
}

function getTagScore(tags, name) {
  for (var i = 0; i < tags.length; i++) {
    if (tags[i].name === name) return tags[i].score;
  }
  return 0.5;
}

function getAllVirtualConsumers() {
  return digitalTwins.concat(syntheticPersonas);
}

function getVCById(id) {
  var all = getAllVirtualConsumers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return null;
}

// ========== 核心：视图切换 ==========
function setView(view) {
  currentView = view;
  var allPanels = document.querySelectorAll('.work-panel.view');
  for (var i = 0; i < allPanels.length; i++) {
    allPanels[i].classList.remove('active');
    allPanels[i].style.display = 'none';
  }
  var allNavItems = document.querySelectorAll('.nav-item');
  for (var j = 0; j < allNavItems.length; j++) {
    allNavItems[j].classList.remove('active');
  }
  var panel = document.getElementById(view);
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'block';
  }
  var navBtn = document.querySelector('.nav-item[data-view="' + view + '"]');
  if (navBtn) navBtn.classList.add('active');
  if (view === 'personaDashboard') renderDashboard();
  else if (view === 'qaExchange') renderQAPage();
  if (panel) {
    try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) {}
  }
}

// ================================================================
//   页面1：虚拟人格构建仪表盘
// ================================================================
function renderDashboard() {
  updateMetrics();
  updateCalibrationTargetSelect();
  renderDigitalTwinsList();
  renderSyntheticPersonasList();
  renderInterviewHistory();
  renderAccuracyConvergenceChart();
  renderGroupDistribution();
  renderVCDatabaseTable();
  updateGroupFilterOptions();
}

// 动态更新"目标数字分身"下拉框
function updateCalibrationTargetSelect() {
  var select = document.getElementById('calibrationTargetUser');
  if (!select) return;
  if (digitalTwins.length === 0) {
    select.innerHTML = '<option value="">— 等待用户洞察平台数据同步 —</option>';
    return;
  }
  var html = '<option value="">— 选择数字分身 —</option>';
  for (var i = 0; i < digitalTwins.length; i++) {
    var dt = digitalTwins[i];
    var accLabel = '准确度 ' + (dt.accuracy * 100).toFixed(0) + '%';
    var roundsLabel = dt.interviewRounds + '轮访谈';
    html += '<option value="' + dt.id + '">' + dt.name + ' — ' + dt.brief + ' | ' + roundsLabel + ' | ' + accLabel + '</option>';
  }
  select.innerHTML = html;
}

function updateMetrics() {
  // 数字分身（来自用户洞察平台）+ 完全虚拟消费者（平台自建）
  var total = digitalTwins.length + syntheticPersonas.length;
  var elTotal = document.getElementById('totalVCMetric');
  if (elTotal) elTotal.textContent = total;
  var elDT = document.getElementById('digitalTwinMetric');
  if (elDT) elDT.textContent = digitalTwins.length;
  var elSyn = document.getElementById('pureVirtualMetric');
  if (elSyn) elSyn.textContent = syntheticPersonas.length;
  var sumAcc = 0, count = 0;
  for (var j = 0; j < digitalTwins.length; j++) {
    sumAcc += digitalTwins[j].accuracy; count++;
  }
  for (var k = 0; k < syntheticPersonas.length; k++) { sumAcc += syntheticPersonas[k].confidence; count++; }
  var overallAcc = count > 0 ? (sumAcc / count * 100).toFixed(1) : '89.8';
  var elAcc = document.getElementById('overallAccuracyMetric');
  if (elAcc) elAcc.textContent = overallAcc + '%';
}

function renderDigitalTwinsList() {
  var container = document.getElementById('digitalTwinsList');
  if (!container) return;
  var html = '';
  for (var i = 0; i < digitalTwins.length; i++) {
    var dt = digitalTwins[i];
    var hasAutoCal = dt.calibrationLog && dt.calibrationLog.length > 0;
    var lastCal = hasAutoCal ? dt.calibrationLog[dt.calibrationLog.length - 1] : null;
    
    html += '<div class="digital-twin-card' + (hasAutoCal ? ' auto-calibrated' : '') + '">';
    html += '<div class="dt-avatar">' + dt.avatar + '</div>';
    html += '<div class="dt-info">';
    html += '<strong>' + dt.name + '</strong>';
    html += '<span class="dt-brief">' + dt.brief + ' | ' + dt.meta + '</span>';
    
    // 显示人格特征摘要
    if (dt.personality && dt.personality.lifePhilosophy) {
      var philosophy = dt.personality.lifePhilosophy;
      // 截取前20个字
      var shortPhilo = philosophy.length > 24 ? philosophy.substring(0, 24) + '...' : philosophy;
      html += '<span class="dt-personality-tip" title="' + philosophy.replace(/"/g, '&quot;') + '">💭 ' + shortPhilo + '</span>';
    }
    
    html += '<div class="dt-meta">';
    html += '<span>决策：' + getTagValue(dt.tags, '决策风格') + '</span>';
    html += '<span>功能：' + getTagValue(dt.tags, '功能偏好') + '</span>';
    html += '<span>价格：' + getTagValue(dt.tags, '价格敏感度') + '</span>';
    html += '</div></div>';
    html += '<div class="dt-stats">';
    html += '<span class="dt-accuracy">' + (dt.accuracy * 100).toFixed(1) + '%</span>';
    html += '<span class="dt-rounds">' + dt.interviewRounds + ' 轮访谈</span>';
    if (hasAutoCal) {
      html += '<span class="dt-auto-cal-badge" title="最近校准：' + (lastCal ? lastCal.summary || '' : '') + '">🔄 已自动校准</span>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function renderSyntheticPersonasList() {
  var container = document.getElementById('syntheticPersonasList');
  if (!container) return;
  var html = '';
  for (var i = 0; i < syntheticPersonas.length; i++) {
    var sp = syntheticPersonas[i];
    html += '<div class="synthetic-card">';
    html += '<div class="syn-icon">&#129302;</div>';
    html += '<div class="syn-info">';
    html += '<strong>' + sp.name + '</strong>';
    html += '<span class="syn-brief">' + sp.brief + '</span>';
    html += '<div class="syn-meta">';
    html += '<span>决策：' + getTagValue(sp.tags, '决策风格') + '</span>';
    html += '<span>功能：' + getTagValue(sp.tags, '功能偏好') + '</span>';
    html += '<span>生成规则：' + sp.rule + '</span>';
    html += '</div></div>';
    html += '<div class="syn-stats">';
    html += '<span class="syn-confidence">' + (sp.confidence * 100).toFixed(1) + '%</span>';
    html += '<span class="syn-rule">置信度</span>';
    html += '</div></div>';
  }
  container.innerHTML = html;
}

function renderInterviewHistory() {
  var container = document.getElementById('interviewHistory');
  if (!container) return;
  var html = '';
  for (var i = 0; i < interviewHistory.length; i++) {
    var h = interviewHistory[i];
    var delta = h.accuracyAfter - h.accuracyBefore;
    var deltaStr = delta > 0 ? '+ ' + (delta * 100).toFixed(1) + '%' : (delta * 100).toFixed(1) + '%';
    var cls = delta > 0 ? 'up' : 'down';
    var isAuto = h.isAutoCalibration;
    var isNew = h.isNewTwin;
    html += '<div class="interview-entry' + (isAuto ? ' auto-cal' : '') + (isNew ? ' new-twin' : '') + '">';
    html += '<span class="ie-round">' + (isAuto ? '🔄 ' : (isNew ? '✨ ' : '')) + '第' + h.round + '轮</span>';
    html += '<div class="ie-info">';
    html += '<strong>' + h.userName + '</strong> — ' + h.topic;
    if (isAuto && h.calibrationSummary) {
      html += '<br/><span class="cal-summary-text">' + h.calibrationSummary + '</span>';
    }
    if (isNew) {
      html += '<br/><span class="cal-summary-text">基于真实用户调研数据首次构建数字分身</span>';
    }
    html += '<br/><span class="muted-text">' + h.timestamp + ' | 质量：' + (h.quality === 'high' ? '高' : (h.quality === 'mid' ? '中' : '低')) + (isAuto ? ' | 自动校准' : (isNew ? ' | 首次同步' : '')) + '</span>';
    html += '</div>';
    html += '<span class="ie-impact ' + cls + '">' + deltaStr + '</span>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function renderAccuracyConvergenceChart() {
  var container = document.getElementById('accuracyConvergenceChart');
  if (!container) return;
  var colors = ['#a78bfa', '#fb4d6d', '#22d3ee', '#f59e0b', '#34d399'];
  var maxRounds = 0;
  var allData = [];
  for (var i = 0; i < digitalTwins.length; i++) {
    var dt = digitalTwins[i];
    var data = dt.accuracyHistory || [];
    allData.push(data);
    if (data.length > maxRounds) maxRounds = data.length;
  }
  var svgW = 100, svgH = 160, padL = 18, padR = 10, padT = 10, padB = 20;
  var plotW = svgW - padL - padR;
  var plotH = svgH - padT - padB;
  var yMin = 0.60, yMax = 1.0;
  var html = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg">';
  for (var g = 0; g <= 4; g++) {
    var gy = padT + (g / 4) * plotH;
    var gVal = yMax - (g / 4) * (yMax - yMin);
    html += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (svgW - padR) + '" y2="' + gy + '" stroke="rgba(167,139,250,0.08)" stroke-width="0.3"/>';
    html += '<text x="' + (padL - 2) + '" y="' + (gy + 3) + '" fill="#8fa8bd" font-size="4" text-anchor="end">' + (gVal * 100).toFixed(0) + '%</text>';
  }
  for (var u = 0; u < allData.length; u++) {
    var d = allData[u];
    if (d.length < 2) continue;
    var points = '';
    for (var p = 0; p < d.length; p++) {
      var x = padL + (p / (maxRounds - 1)) * plotW;
      var y = padT + plotH - ((d[p].accuracy - yMin) / (yMax - yMin)) * plotH;
      points += (p > 0 ? ' ' : '') + x.toFixed(2) + ',' + y.toFixed(2);
    }
    html += '<polyline points="' + points + '" fill="none" stroke="' + colors[u] + '" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>';
    var lastD = d[d.length - 1];
    var lx = padL + ((d.length - 1) / (maxRounds - 1)) * plotW;
    var ly = padT + plotH - ((lastD.accuracy - yMin) / (yMax - yMin)) * plotH;
    html += '<circle cx="' + lx.toFixed(2) + '" cy="' + ly.toFixed(2) + '" r="1.2" fill="' + colors[u] + '"/>';
    html += '<text x="' + (lx + 1.5).toFixed(2) + '" y="' + (ly + 2).toFixed(2) + '" fill="' + colors[u] + '" font-size="3.5">' + (lastD.accuracy * 100).toFixed(0) + '%</text>';
  }
  for (var xl = 1; xl <= maxRounds; xl++) {
    var xx = padL + ((xl - 1) / (maxRounds - 1)) * plotW;
    html += '<text x="' + xx.toFixed(2) + '" y="' + (svgH - 3) + '" fill="#8fa8bd" font-size="3.5" text-anchor="middle">R' + xl + '</text>';
  }
  html += '</svg>';
  container.innerHTML = html;
}

function renderVCDatabaseTable() {
  var tbody = document.getElementById('vcDatabaseBody');
  if (!tbody) return;
  var filterType = document.getElementById('vcFilterType');
  var filter = filterType ? filterType.value : 'all';
  var filterGroup = document.getElementById('vcFilterGroup');
  var groupFilter = filterGroup ? filterGroup.value : 'all';
  var allVCs = getAllVirtualConsumers();
  var html = '';
  for (var i = 0; i < allVCs.length; i++) {
    var vc = allVCs[i];
    if (filter !== 'all' && vc.type !== filter) continue;
    // 群组筛选
    if (groupFilter !== 'all') {
      var vcGroupName = vc.group ? vc.group.groupName : '';
      if (vcGroupName !== groupFilter) continue;
    }
    var isDT = vc.type === 'digital_twin';
    var accVal = isDT ? vc.accuracy : vc.confidence;
    var groupName = vc.group ? vc.group.groupName : '未分类';
    var valueOrientation = vc.group ? vc.group.valueOrientation : '';
    html += '<tr>';
    html += '<td><span class="vc-type-badge ' + vc.type + '">' + (isDT ? '数字分身' : '完全虚拟') + '</span></td>';
    html += '<td><strong>' + vc.name + '</strong><br/><span class="muted-text" style="font-size:11px;">' + vc.id + '</span></td>';
    html += '<td>' + (isDT ? '真实用户 ' + vc.realUserId : vc.rule + ' 规则生成') + '</td>';
    html += '<td>' + (isDT ? vc.interviewRounds + ' 轮' : '—') + '</td>';
    html += '<td><span class="vc-accuracy ' + getAccClass(accVal) + '">' + (accVal * 100).toFixed(1) + '%</span></td>';
    html += '<td><span class="vc-accuracy ' + getAccClass(vc.confidence) + '">' + (vc.confidence * 100).toFixed(1) + '%</span></td>';
    html += '<td>' + getTagValue(vc.tags, '决策风格') + '</td>';
    html += '<td>' + getTagValue(vc.tags, '价格敏感度') + '</td>';
    html += '<td><span class="group-tag-cell">' + groupName + '</span><br/><span class="muted-text" style="font-size:10px;">' + valueOrientation + '</span></td>';
    html += '<td><button class="ghost-btn sm" onclick="viewVCDetail(\'' + vc.id + '\')">查看</button></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

// ========== 群组分布渲染 ==========
function renderGroupDistribution() {
  var container = document.getElementById('groupDistributionGrid');
  if (!container) return;
  var allVCs = getAllVirtualConsumers();
  // 按群组聚合
  var groupMap = {};
  for (var i = 0; i < allVCs.length; i++) {
    var vc = allVCs[i];
    var g = vc.group;
    if (!g) continue;
    var key = g.groupName || (g.lifeStageId + '-' + g.valueOrientation);
    if (!groupMap[key]) {
      groupMap[key] = {
        groupName: key,
        lifeStageLabel: g.lifeStageLabel || '',
        valueOrientation: g.valueOrientation || '',
        keywords: g.keywords || [],
        digitalTwins: [],
        synthetic: []
      };
    }
    if (vc.type === 'digital_twin') {
      groupMap[key].digitalTwins.push(vc);
    } else {
      groupMap[key].synthetic.push(vc);
    }
  }
  var groupKeys = Object.keys(groupMap).sort();
  var html = '';
  for (var k = 0; k < groupKeys.length; k++) {
    var group = groupMap[groupKeys[k]];
    var totalCount = group.digitalTwins.length + group.synthetic.length;
    var dtCount = group.digitalTwins.length;
    var synCount = group.synthetic.length;
    var valueCls = '';
    if (group.valueOrientation === '前卫') valueCls = 'value-avant';
    else if (group.valueOrientation === '稳健') valueCls = 'value-stable';
    else valueCls = 'value-conservative';
    html += '<div class="group-dist-card ' + valueCls + '">';
    html += '<div class="group-dist-header">';
    html += '<strong>' + group.groupName + '</strong>';
    html += '<span class="group-dist-count">' + totalCount + '人</span>';
    html += '</div>';
    html += '<div class="group-dist-meta">';
    html += '<span class="group-life-stage">' + group.lifeStageLabel + '</span>';
    html += '<span class="group-value-tag">' + group.valueOrientation + '型</span>';
    html += '</div>';
    html += '<div class="group-dist-keywords">';
    for (var kw = 0; kw < group.keywords.length; kw++) {
      html += '<span>' + group.keywords[kw] + '</span>';
    }
    html += '</div>';
    html += '<div class="group-dist-stats">';
    html += '<span>数字分身：' + dtCount + '</span>';
    html += '<span>完全虚拟：' + synCount + '</span>';
    html += '</div>';
    html += '</div>';
  }
  container.innerHTML = html || '<span class="muted-text">暂无群组数据</span>';
}

// 更新群组筛选下拉
function updateGroupFilterOptions() {
  var select = document.getElementById('vcFilterGroup');
  if (!select) return;
  var allVCs = getAllVirtualConsumers();
  var groupSet = {};
  for (var i = 0; i < allVCs.length; i++) {
    var vc = allVCs[i];
    if (vc.group && vc.group.groupName) {
      groupSet[vc.group.groupName] = true;
    }
  }
  var options = '<option value="all">全部群组</option>';
  var keys = Object.keys(groupSet).sort();
  for (var k = 0; k < keys.length; k++) {
    options += '<option value="' + keys[k] + '">' + keys[k] + '</option>';
  }
  select.innerHTML = options;
}

// ========== 自动同步机制：检测用户洞察平台数据变更 ==========

// ★ 核心：自动从用户洞察平台同步数据（无需用户手动点击）
function autoSyncFromUserInsight() {
  if (typeof SharedDataStore === 'undefined') {
    console.log('[自动同步] SharedDataStore 未加载，跳过');
    return;
  }
  
  var versionInfo = SharedDataStore.getDataVersion();
  var currentDataVersion = versionInfo.dataVersion || 0;
  var currentDtVersion = versionInfo.dtVersion || 0;
  var userSamples = SharedDataStore.getUserSamples();
  var samplesCount = userSamples ? userSamples.length : 0;
  
  // ★ 策略1：本地数字分身为空 + 共享存储有用户样本 → 首次同步
  if (digitalTwins.length === 0 && samplesCount > 0) {
    console.log('[自动同步] 本地数字分身为空，共享存储有 ' + samplesCount + ' 个用户样本，自动同步...');
    performSync(userSamples, currentDataVersion, currentDtVersion);
    autoSyncState.isFirstLoad = false;
    return;
  }
  
  // ★ 策略2：共享存储有数据但本地数量不一致（可能被清空或部分丢失）
  if (samplesCount > 0 && digitalTwins.length !== samplesCount) {
    console.log('[自动同步] 数据不一致：共享存储 ' + samplesCount + ' 个样本 vs 本地 ' + digitalTwins.length + ' 个数字分身，重新同步...');
    performSync(userSamples, currentDataVersion, currentDtVersion);
    autoSyncState.isFirstLoad = false;
    return;
  }
  
  // ★ 策略3：版本号检测——数字分身版本变化（用户洞察平台推送了新数据）
  if (currentDtVersion > 0 && currentDtVersion !== autoSyncState.lastDtVersion) {
    console.log('[自动同步] 检测到数字分身更新 (v' + autoSyncState.lastDtVersion + ' → v' + currentDtVersion + ')，自动同步...');
    performSync(userSamples, currentDataVersion, currentDtVersion);
    autoSyncState.isFirstLoad = false;
    return;
  }
  
  // ★ 策略4：首次加载标记——如果还未完成过任何同步，继续等待
  // 不将 isFirstLoad 设为 false，保留后续检测能力
  if (autoSyncState.isFirstLoad) {
    // 首次加载但还没有数据，保持 isFirstLoad=true 继续轮询等待
    // 只在控制台输出一条调试日志（避免刷屏）
    if (!autoSyncState._firstLoadLogged) {
      console.log('[自动同步] 等待用户洞察平台推送数据... (共享存储当前有 ' + samplesCount + ' 个样本)');
      autoSyncState._firstLoadLogged = true;
    }
  }
}

// ★ 执行同步操作
function performSync(userSamples, dataVersion, dtVersion) {
  // ★ 全量替换：先清除本地旧的数字分身列表
  digitalTwins = [];
  
  processSync(userSamples);
  
  // ★ 更新追踪状态（同步后重新获取版本号，因为 processSync 内部会再次递增 dtVersion）
  var latestVersion = SharedDataStore.getDataVersion();
  autoSyncState.lastDataVersion = latestVersion.dataVersion || dataVersion;
  autoSyncState.lastDtVersion = latestVersion.dtVersion || dtVersion;
  autoSyncState.isFirstLoad = false;
  
  console.log('[自动同步] 同步完成，追踪版本: data=v' + autoSyncState.lastDataVersion + ', dt=v' + autoSyncState.lastDtVersion);
  updateAutoSyncStatusIndicator();
}

// ★ 启动自动检测机制（轮询 + storage 事件双重保障）
function startAutoSyncWatcher() {
  // 方式1：通过 localStorage storage 事件监听跨标签页变更
  autoSyncState.storageListener = function(e) {
    if (e.key === 'vc_ui_data_version' || e.key === 'vc_ui_shared_data') {
      console.log('[自动同步] 检测到 SharedDataStore 跨页面变更，触发自动同步');
      // 延迟一点确保数据已完全写入
      setTimeout(function() {
        autoSyncFromUserInsight();
      }, 200);
    }
  };
  window.addEventListener('storage', autoSyncState.storageListener);
  
  // 方式2：定时轮询作为兜底（同一页面内的变更也能检测到）
  autoSyncState.pollingTimer = setInterval(function() {
    autoSyncFromUserInsight();
  }, 2000); // 每2秒检测一次
  
  console.log('[自动同步] 自动检测机制已启动 (轮询间隔 2s + storage事件监听)');
  
  // 首次立即检测
  setTimeout(function() {
    autoSyncFromUserInsight();
  }, 500);
}

// ★ 停止自动检测
function stopAutoSyncWatcher() {
  if (autoSyncState.pollingTimer) {
    clearInterval(autoSyncState.pollingTimer);
    autoSyncState.pollingTimer = null;
  }
  if (autoSyncState.storageListener) {
    window.removeEventListener('storage', autoSyncState.storageListener);
    autoSyncState.storageListener = null;
  }
}

// ★ 手动强制同步（用户点击触发）
function manualForceSync() {
  console.log('[手动同步] === 诊断信息 ===');
  console.log('[手动同步] SharedDataStore 存在:', typeof SharedDataStore !== 'undefined');
  console.log('[手动同步] digitalTwins 当前数量:', digitalTwins.length);
  
  if (typeof SharedDataStore === 'undefined') {
    console.log('[手动同步] SharedDataStore 未加载，使用内嵌数据兜底');
    loadEmbeddedUserSamplesDirectly();
    renderDashboard();
    return;
  }
  
  var userSamples = SharedDataStore.getUserSamples();
  var versionInfo = SharedDataStore.getDataVersion();
  
  console.log('[手动同步] getUserSamples 返回值:', userSamples);
  console.log('[手动同步] 用户样本数量:', userSamples ? userSamples.length : 'null');
  console.log('[手动同步] 版本信息:', versionInfo);
  console.log('[手动同步] autoSyncState:', JSON.stringify(autoSyncState));
  
  if (!userSamples || userSamples.length === 0) {
    showToast('SharedDataStore 中没有用户样本数据，正在加载内置数据...', 'info');
    console.log('[手动同步] SharedDataStore 为空，启动兜底方案...');
    loadUserSamplesFallback();
    return;
  }
  
  performSync(userSamples, versionInfo.dataVersion, versionInfo.dtVersion);
  showToast('已从 SharedDataStore 同步 ' + userSamples.length + ' 个用户样本，生成 ' + digitalTwins.length + ' 个数字分身', 'success');
  renderDashboard();
}

// ★ 终极兜底：直接从 localStorage 读取，或内嵌24个用户数据
function loadUserSamplesFallback() {
  // 尝试直接从 localStorage 读取 SharedDataStore 原始数据
  try {
    var rawData = localStorage.getItem('vc_ui_shared_data');
    console.log('[兜底] localStorage vc_ui_shared_data:', rawData ? ('存在 (' + rawData.length + ' 字符)') : '不存在');
    
    if (rawData) {
      var parsed = JSON.parse(rawData);
      console.log('[兜底] 解析结果 - userSamples:', parsed.userSamples ? parsed.userSamples.length : 0);
      console.log('[兜底] 解析结果 - dtVersion:', parsed.dtVersion);
      console.log('[兜底] 解析结果 - dataVersion:', parsed.dataVersion);
      
      if (parsed.userSamples && parsed.userSamples.length > 0) {
        // ★ 过滤掉未完成调研的用户（用内嵌样本作为白名单）
        var embeddedSamples = getEmbeddedSamples();
        if (embeddedSamples.length === 0) {
          // 内嵌样本已清空，残留数据全部清除
          console.log('[兜底] 内嵌样本已清空，清除 ' + parsed.userSamples.length + ' 个残留用户样本');
          SharedDataStore.clear();
        } else {
          var validIds = {};
          for (var i = 0; i < embeddedSamples.length; i++) {
            validIds[embeddedSamples[i].id] = true;
          }
          var filteredSamples = [];
          var removedCount = 0;
          for (var i = 0; i < parsed.userSamples.length; i++) {
            if (validIds[parsed.userSamples[i].id]) {
              filteredSamples.push(parsed.userSamples[i]);
            } else {
              removedCount++;
            }
          }
          if (removedCount > 0) {
            console.log('[兜底] 过滤掉 ' + removedCount + ' 个未完成调研的用户（残留数据）');
          }
          
          if (filteredSamples.length > 0) {
            // 直接手动注入到 SharedDataStore（全量替换）
            SharedDataStore.pushUserSamples(filteredSamples);
            var samples = SharedDataStore.getUserSamples();
            if (samples && samples.length > 0) {
              var ver = SharedDataStore.getDataVersion();
              performSync(samples, ver.dataVersion, ver.dtVersion);
              showToast('已从 localStorage 恢复 ' + samples.length + ' 个用户样本！', 'success');
              renderDashboard();
              return;
            }
          }
        }
      }
    }
  } catch(e) {
    console.error('[兜底] 读取 localStorage 失败:', e);
  }
  
  // 终极兜底：使用内嵌的24个用户数据
  console.log('[兜底] 使用内嵌用户数据...');
  loadEmbeddedUserSamples();
}

// ★ 内嵌24个真实用户样本数据（从用户洞察平台同步）
function loadEmbeddedUserSamples() {
  var embeddedSamples = getEmbeddedSamples();
  
  console.log('[兜底] 内嵌 ' + embeddedSamples.length + ' 个用户样本');
  
  if (typeof SharedDataStore === 'undefined') {
    console.log('[兜底] SharedDataStore 不可用，直接构建数字分身');
    loadEmbeddedUserSamplesDirectly();
    return;
  }
  
  if (embeddedSamples.length === 0) {
    // 内嵌样本已清空，强制清除残留数据
    console.log('[兜底] 内嵌样本已清空，清除 SharedDataStore 残留数据');
    SharedDataStore.clear();
    digitalTwins = [];
    renderDashboard();
    return;
  }
  
  // 直接推入 SharedDataStore
  var result = SharedDataStore.pushUserSamples(embeddedSamples);
  console.log('[兜底] pushUserSamples 结果:', result);
  
  var userSamples = SharedDataStore.getUserSamples();
  console.log('[兜底] 推送后 SharedDataStore 有 ' + userSamples.length + ' 个样本');
  
  if (userSamples.length > 0) {
    var ver = SharedDataStore.getDataVersion();
    performSync(userSamples, ver.dataVersion, ver.dtVersion);
    showToast('已加载 ' + userSamples.length + ' 个内嵌用户样本，生成 ' + digitalTwins.length + ' 个数字分身！', 'success');
    renderDashboard();
  } else {
    showToast('加载失败！请检查浏览器控制台 (F12)', 'error');
  }
}

// 处理同步逻辑
function processSync(userSamples) {
  var newTwins = SharedDataStore.syncToDigitalTwins();
  
  // ★ 全量替换：清除旧的访谈历史中与数字分身相关的条目
  interviewHistory = [];
  
  var addedCount = 0;
  var updatedCount = 0;
  var autoCalibratedCount = 0;
  
  // 构建本次同步的用户ID映射（用于检测同一用户的多条样本——回访调研场景）
  var seenSourceIds = {};
  
  for (var j = 0; j < newTwins.length; j++) {
    var nt = newTwins[j];
    // 转换为虚拟消费者Agent使用的标签格式
    var convertedTags = [];
    if (nt.consumerTags) {
      for (var t = 0; t < nt.consumerTags.length; t++) {
        var ct = nt.consumerTags[t];
        convertedTags.push({
          name: ct.name,
          value: ct.value,
          score: ct.score,
          confidence: ct.confidence || 0.85,
          pendingValueShift: ct.pendingValueShift || null
        });
      }
    }
    nt.tags = convertedTags;
    
    // 检测是否为已校准的数字分身（同一真实用户的多轮调研）
    var hasAutoCalibration = nt.calibrationLog && nt.calibrationLog.length > 0;
    var latestCalibration = hasAutoCalibration ? nt.calibrationLog[nt.calibrationLog.length - 1] : null;
    
    // 查找 digitalTwins 中是否已有该来源用户的数字分身
    var existingIdx = -1;
    for (var k = 0; k < digitalTwins.length; k++) {
      if (digitalTwins[k].realUserId === nt.sourceUserId) {
        existingIdx = k;
        break;
      }
    }
    
    if (existingIdx >= 0) {
      // ====== 更新已有数字分身（真实用户再次调研 → 自动校准） ======
      var oldDT = digitalTwins[existingIdx];
      var oldAccuracy = oldDT.accuracy;
      
      // 全面更新数字分身数据
      digitalTwins[existingIdx] = nt;
      digitalTwins[existingIdx].tags = convertedTags;
      digitalTwins[existingIdx].accuracyHistory = nt.accuracyHistory || oldDT.accuracyHistory || [];
      digitalTwins[existingIdx].calibrationLog = nt.calibrationLog || oldDT.calibrationLog || [];
      digitalTwins[existingIdx].personality = nt.personality || oldDT.personality;
      
      // 记录到访谈历史（自动校准）
      if (latestCalibration) {
        interviewHistory.unshift({
          id: 'IH-' + String(interviewHistory.length + 1).padStart(3, '0'),
          userId: nt.id,
          userName: nt.name,
          round: nt.interviewRounds,
          topic: latestCalibration.researchType || '回访调研',
          quality: 'high',
          accuracyBefore: latestCalibration.accuracyBefore || oldAccuracy,
          accuracyAfter: latestCalibration.accuracyAfter || nt.accuracy,
          timestamp: new Date().toLocaleString(),
          isAutoCalibration: true,
          calibrationSummary: latestCalibration.summary || ''
        });
      }
      
      autoCalibratedCount++;
      updatedCount++;
    } else {
      // ====== 新增数字分身（首次同步） ======
      digitalTwins.push(nt);
      addedCount++;
      
      // 首次同步也记录到访谈历史
      if (nt.accuracyHistory && nt.accuracyHistory.length > 0) {
        var lastHistory = nt.accuracyHistory[nt.accuracyHistory.length - 1];
        interviewHistory.unshift({
          id: 'IH-' + String(interviewHistory.length + 1).padStart(3, '0'),
          userId: nt.id,
          userName: nt.name,
          round: nt.interviewRounds,
          topic: nt.source ? nt.source.researchType : '首次调研',
          quality: 'high',
          accuracyBefore: 0.72,
          accuracyAfter: nt.accuracy,
          timestamp: new Date().toLocaleString(),
          isNewTwin: true
        });
      }
    }
  }
  
  renderDashboard();
  updateMetrics();
  // ★ 同步后立即将最新数据推送到 SharedDataStore，供用户洞察平台导入
  syncLocalVCsToSharedStore();
  
  // ★ 自动同步时静默处理，只在控制台输出日志
  var msg = '已自动同步用户样本库：新增 ' + addedCount + ' 个数字分身';
  if (updatedCount > 0) msg += '，更新 ' + updatedCount + ' 个';
  if (autoCalibratedCount > 0) {
    msg += '（其中 ' + autoCalibratedCount + ' 个已完成自动校准）';
  }
  console.log('[自动同步] ' + msg);
  
  // 只在有实质变更时显示轻量提示
  if (addedCount > 0 || updatedCount > 0) {
    showToast('已自动同步用户样本库：' + digitalTwins.length + ' 个数字分身已就绪', 'info');
  }
}

// ========== 数据导入与校准 ==========
function submitInterview() {
  var targetSelect = document.getElementById('calibrationTargetUser');
  var roundInput = document.getElementById('interviewRound');
  var topicSelect = document.getElementById('interviewTopic');
  var qualitySelect = document.getElementById('dataQuality');
  if (!targetSelect || !roundInput) return;
  var selectedId = targetSelect.value;  // 下拉框的 value 是数字分身 ID（如 "DT-U-001"）
  if (!selectedId) { showToast('请先选择目标数字分身', 'warning'); return; }
  var round = parseInt(roundInput.value) || 1;
  var topic = topicSelect ? topicSelect.value : '购车决策偏好';
  var quality = qualitySelect ? qualitySelect.value : 'mid';
  var targetDT = null;
  for (var i = 0; i < digitalTwins.length; i++) {
    if (digitalTwins[i].id === selectedId || digitalTwins[i].realUserId === selectedId) {
      targetDT = digitalTwins[i]; break;
    }
  }
  if (!targetDT) { showToast('未找到目标数字分身: ' + selectedId, 'error'); return; }
  var userName = targetDT.name;
  var qualityFactor = quality === 'high' ? 0.03 : (quality === 'mid' ? 0.02 : 0.01);
  var oldAccuracy = targetDT.accuracy;
  var newAccuracy = Math.min(0.98, oldAccuracy + qualityFactor + (Math.random() * 0.01));
  targetDT.accuracy = parseFloat(newAccuracy.toFixed(3));
  targetDT.interviewRounds += 1;
  // 记录到访谈历史
  interviewHistory.unshift({
    id: 'IH-' + String(interviewHistory.length + 1).padStart(3, '0'),
    userId: targetDT.id, userName: userName,
    round: targetDT.interviewRounds, topic: topic, quality: quality,
    accuracyBefore: parseFloat(oldAccuracy.toFixed(3)),
    accuracyAfter: parseFloat(newAccuracy.toFixed(3)),
    timestamp: new Date().toLocaleString()
  });
  // 将准确度变化追加到该数字分身自己的历史记录中
  if (!targetDT.accuracyHistory) targetDT.accuracyHistory = [];
  targetDT.accuracyHistory.push({
    round: targetDT.interviewRounds,
    accuracy: parseFloat(newAccuracy.toFixed(3)),
    topic: topic
  });
  // 根据访谈质量调整标签评分（向"真实偏好"收敛）
  var noiseRange = quality === 'high' ? 0.03 : 0.05;
  for (var k = 0; k < targetDT.tags.length; k++) {
    var oldScore = targetDT.tags[k].score;
    var realScore = oldScore + (Math.random() - 0.5) * noiseRange;
    var newScore = oldScore + (realScore - oldScore) * (0.1 + qualityFactor * 2);
    targetDT.tags[k].score = parseFloat(Math.max(0.02, Math.min(0.98, newScore)).toFixed(2));
    targetDT.tags[k].confidence = parseFloat(Math.min(0.98, (targetDT.tags[k].confidence || 0.85) + 0.01).toFixed(2));
  }
  renderDashboard();
  updateMetrics();
  showToast('已提交「' + userName + '」第' + targetDT.interviewRounds + '轮访谈数据，准确度：' + (oldAccuracy * 100).toFixed(1) + '% → ' + (newAccuracy * 100).toFixed(1) + '%', 'success');
}

function calibrateAll() {
  for (var i = 0; i < digitalTwins.length; i++) {
    var dt = digitalTwins[i];
    var boost = 0.005 + Math.random() * 0.01;
    dt.accuracy = parseFloat(Math.min(0.98, dt.accuracy + boost).toFixed(3));
  }
  renderDashboard();
  updateMetrics();
  showToast('所有数字分身已完成批量校准', 'success');
}

function generateNewSynthetic() {
  var names = ['都市白领精英', '越野户外爱好者', '智能科技发烧友', '退休银发族', 'Z世代首购族'];
  var rules = ['weighted_sum', 'threshold_and', 'priority_sort'];
  var name = names[Math.floor(Math.random() * names.length)];
  var rule = rules[Math.floor(Math.random() * rules.length)];
  var ruleLabel = rule === 'weighted_sum' ? '加权求和' : (rule === 'threshold_and' ? '阈值AND' : '优先级排序');
  var decisionStyles = ['理性分析型','感性直觉型','从众跟随型','自主探索型'];
  var funcPrefs = ['智能座舱优先','续航优先','空间优先','性能优先','安全优先'];
  var priceLabels = ['较低','中等','较高','极高','极低'];
  var techLabels = ['极高','高','中等','较低'];
  var brandLabels = ['极高','较高','中等','较低','低'];
  var safetyLabels = ['极高','高','中等','较低'];
  var appearLabels = ['科技简约风','运动潮流风','豪华商务风','简约实用风'];
  var rangeLabels = ['较低','中等','高'];
  var newSynth = {
    id: 'VC-' + String(synthCounter).padStart(3, '0'),
    name: name, brief: '自动生成·基于用户标签统计分布',
    type: 'synthetic', rule: ruleLabel,
    confidence: parseFloat((0.68 + Math.random() * 0.18).toFixed(2)),
    tags: [
      { name: '决策风格', value: decisionStyles[Math.floor(Math.random()*4)], score: parseFloat((0.3 + Math.random() * 0.6).toFixed(2)) },
      { name: '功能偏好', value: funcPrefs[Math.floor(Math.random()*5)], score: parseFloat((0.3 + Math.random() * 0.6).toFixed(2)) },
      { name: '价格敏感度', value: priceLabels[Math.floor(Math.random()*5)], score: parseFloat((0.05 + Math.random() * 0.9).toFixed(2)) },
      { name: '科技偏好', value: techLabels[Math.floor(Math.random()*4)], score: parseFloat((0.05 + Math.random() * 0.9).toFixed(2)) },
      { name: '品牌忠诚度', value: brandLabels[Math.floor(Math.random()*5)], score: parseFloat((0.05 + Math.random() * 0.9).toFixed(2)) },
      { name: '安全关注度', value: safetyLabels[Math.floor(Math.random()*4)], score: parseFloat((0.1 + Math.random() * 0.85).toFixed(2)) },
      { name: '外观偏好', value: appearLabels[Math.floor(Math.random()*4)], score: parseFloat((0.1 + Math.random() * 0.8).toFixed(2)) },
      { name: '续航焦虑', value: rangeLabels[Math.floor(Math.random()*3)], score: parseFloat((0.1 + Math.random() * 0.8).toFixed(2)) }
    ]
  };
  syntheticPersonas.push(newSynth);
  synthCounter++;
  renderDashboard();
  updateMetrics();
  showToast('已生成新的虚拟消费者：' + name, 'success');
}

function viewVCDetail(id) {
  var vc = getVCById(id);
  if (!vc) return;
  var isDT = vc.type === 'digital_twin';
  var info = vc.name + ' (' + vc.id + ')\n';
  info += '━━━━━━━━━━━━━━━━━━\n';
  info += '类型：' + (isDT ? '数字分身（基于真实用户数据）' : '完全虚拟消费者') + '\n';
  info += '准确度/置信度：' + ((isDT ? vc.accuracy : vc.confidence) * 100).toFixed(1) + '%\n';
  if (isDT) {
    info += '访谈轮次：' + vc.interviewRounds + ' 轮\n';
    info += '真实用户ID：' + vc.realUserId + '\n';
  }
  info += '\n【消费者标签】\n';
  info += '决策风格：' + getTagValue(vc.tags, '决策风格') + '\n';
  info += '功能偏好：' + getTagValue(vc.tags, '功能偏好') + '\n';
  info += '价格敏感度：' + getTagValue(vc.tags, '价格敏感度') + '\n';
  info += '科技偏好：' + getTagValue(vc.tags, '科技偏好') + '\n';
  info += '品牌忠诚度：' + getTagValue(vc.tags, '品牌忠诚度') + '\n';
  info += '安全关注度：' + getTagValue(vc.tags, '安全关注度') + '\n';
  
  if (isDT && vc.personality) {
    info += '\n【人格特征】\n';
    info += '生活理念：' + (vc.personality.lifePhilosophy || '—') + '\n';
    info += '说话方式：' + (vc.personality.speechStyle || '—') + '\n';
    info += '行为逻辑：' + (vc.personality.behaviorLogic || '—') + '\n';
    info += '消费心理：' + (vc.personality.consumerPsychology || '—') + '\n';
  }
  
  if (isDT) {
    info += '\n【人口统计】\n';
    info += '年龄：' + (vc.age || '—') + '岁 | 性别：' + (vc.gender || '—') + '\n';
    info += '城市：' + (vc.city || '—') + ' | ' + (vc.cityLevel || '') + '城市\n';
    info += '学历：' + (vc.education || '—') + ' | 收入：' + (vc.income || '—') + '\n';
    info += '婚姻：' + (vc.maritalStatus || '—') + ' | 子女：' + (vc.children || '—') + '\n';
    info += '现有车辆：' + (vc.currentCar || '无') + ' | 拥车情况：' + (vc.carOwnership || '—') + '\n';
    
    if (vc.calibrationLog && vc.calibrationLog.length > 0) {
      info += '\n【自动校准记录】\n';
      var lastCal = vc.calibrationLog[vc.calibrationLog.length - 1];
      info += '最近校准：' + (lastCal.summary || '无') + '\n';
      info += '校准次数：' + vc.calibrationLog.length + ' 次\n';
    }
  }
  
  alert(info);
}

// ================================================================
//   页面2：智能问答交互
// ================================================================
function renderQAPage() {
  renderQATargetSelector();
  renderVCQuickList();
  renderQAMessages();
}

function renderQATargetSelector() {
  var container = document.getElementById('qaTargetSelector');
  if (!container) return;
  var targetType = document.querySelector('input[name="qaTargetType"]:checked');
  currentQATargetType = targetType ? targetType.value : 'single';
  var html = '';
  if (currentQATargetType === 'single') {
    html += '<select id="qaSingleSelect" onchange="onQATargetChange()">';
    html += '<option value="">— 选择一位虚拟消费者 —</option>';
    html += '<optgroup label="数字分身（有现实数据）">';
    for (var i = 0; i < digitalTwins.length; i++) {
      var dt = digitalTwins[i];
      var sel = (currentQATarget && currentQATarget.id === dt.id) ? ' selected' : '';
      html += '<option value="' + dt.id + '"' + sel + '>' + dt.name + ' — ' + dt.brief + ' (准确度 ' + (dt.accuracy * 100).toFixed(0) + '%)</option>';
    }
    html += '</optgroup>';
    html += '<optgroup label="完全虚拟消费者">';
    for (var j = 0; j < syntheticPersonas.length; j++) {
      var sp = syntheticPersonas[j];
      var sel2 = (currentQATarget && currentQATarget.id === sp.id) ? ' selected' : '';
      html += '<option value="' + sp.id + '"' + sel2 + '>' + sp.name + ' — ' + sp.brief + ' (置信度 ' + (sp.confidence * 100).toFixed(0) + '%)</option>';
    }
    html += '</optgroup></select>';
  } else {
    html += '<select id="qaGroupSelect" onchange="onQAGroupChange()">';
    html += '<option value="">— 选择消费者群体 —</option>';
    html += '<option value="digital_twins">全部数字分身（' + digitalTwins.length + '人）</option>';
    html += '<option value="synthetic">全部完全虚拟消费者（' + syntheticPersonas.length + '人）</option>';
    html += '<option value="all">全部虚拟消费者（' + (digitalTwins.length + syntheticPersonas.length) + '人）</option>';
    html += '<option value="tech_lovers">科技偏好型群体</option>';
    html += '<option value="price_sensitive">价格敏感型群体</option>';
    html += '<option value="family_oriented">家庭实用型群体</option>';
    html += '</select>';
  }
  container.innerHTML = html;
  if (!currentQATarget && digitalTwins.length > 0) {
    currentQATarget = digitalTwins[0];
    updateQARespondentLabel();
  }
}

function onQATargetChange() {
  var select = document.getElementById('qaSingleSelect');
  if (!select) return;
  currentQATarget = select.value ? getVCById(select.value) : null;
  updateQARespondentLabel();
  renderVCQuickList();
}

function onQAGroupChange() {
  currentQATarget = null;
  updateQARespondentLabel();
}

function updateQARespondentLabel() {
  var label = document.getElementById('qaRespondentLabel');
  if (!label) return;
  if (currentQATarget) {
    var isDT = currentQATarget.type === 'digital_twin';
    label.textContent = '对话对象：' + currentQATarget.name + '（' + (isDT ? '数字分身' : '完全虚拟') + '）';
  } else {
    var groupSelect = document.getElementById('qaGroupSelect');
    var groupLabels = { digital_twins: '全部数字分身', synthetic: '全部完全虚拟消费者', all: '全部虚拟消费者', tech_lovers: '科技偏好型群体', price_sensitive: '价格敏感型群体', family_oriented: '家庭实用型群体' };
    if (groupSelect && groupSelect.value) {
      label.textContent = '对话对象：' + (groupLabels[groupSelect.value] || '消费者群体');
    } else {
      label.textContent = '请选择对话对象';
    }
  }
}

function renderVCQuickList() {
  var container = document.getElementById('vcQuickList');
  if (!container) return;
  var searchInput = document.getElementById('vcSearchInput');
  var query = searchInput ? searchInput.value.toLowerCase() : '';
  var allVCs = getAllVirtualConsumers();
  var html = '';
  for (var i = 0; i < allVCs.length; i++) {
    var vc = allVCs[i];
    if (query && vc.name.toLowerCase().indexOf(query) < 0 && vc.id.toLowerCase().indexOf(query) < 0) continue;
    var isDT = vc.type === 'digital_twin';
    var isSelected = currentQATarget && currentQATarget.id === vc.id;
    html += '<div class="vc-quick-item' + (isSelected ? ' selected' : '') + '" onclick="quickSelectVC(\'' + vc.id + '\')">';
    html += '<div class="vc-quick-avatar ' + vc.type + '">' + (isDT ? vc.avatar : '🤖') + '</div>';
    html += '<div class="vc-quick-info">';
    html += '<strong>' + vc.name + '</strong>';
    html += '<span>' + (isDT ? '数字分身 · ' + (vc.accuracy * 100).toFixed(0) + '%' : '完全虚拟 · ' + (vc.confidence * 100).toFixed(0) + '%') + '</span>';
    html += '</div></div>';
  }
  container.innerHTML = html || '<span class="muted-text" style="padding:8px;">无匹配结果</span>';
}

function quickSelectVC(id) {
  var singleRadio = document.querySelector('input[name="qaTargetType"][value="single"]');
  if (singleRadio) singleRadio.checked = true;
  currentQATargetType = 'single';
  currentQATarget = getVCById(id);
  renderQATargetSelector();
  updateQARespondentLabel();
  renderVCQuickList();
}

// ========== 问答引擎 ==========
function sendQA() {
  var input = document.getElementById('qaInput');
  if (!input || !input.value.trim()) return;
  var question = input.value.trim();
  input.value = '';
  var targetLabel = '';
  if (currentQATargetType === 'single') {
    if (!currentQATarget) { showToast('请先选择一位虚拟消费者', 'warning'); return; }
    targetLabel = currentQATarget.name + '（' + (currentQATarget.type === 'digital_twin' ? '数字分身' : '完全虚拟') + '）';
  } else {
    var groupSelect = document.getElementById('qaGroupSelect');
    if (!groupSelect || !groupSelect.value) { showToast('请先选择消费者群体', 'warning'); return; }
    var groupLabels = { digital_twins: '全部数字分身', synthetic: '全部完全虚拟消费者', all: '全部虚拟消费者', tech_lovers: '科技偏好型群体', price_sensitive: '价格敏感型群体', family_oriented: '家庭实用型群体' };
    targetLabel = groupLabels[groupSelect.value] || '消费者群体';
  }
  qaConversation.push({ role: 'user', content: question, target: targetLabel, time: new Date().toLocaleTimeString() });
  var answer;
  if (currentQATargetType === 'single') {
    answer = generateSingleAnswer(currentQATarget, question);
  } else {
    answer = generateGroupAnswer(question);
  }
  qaConversation.push({ role: 'assistant', content: answer, target: targetLabel, time: new Date().toLocaleTimeString() });
  renderQAMessages();
  showToast('已回复', 'success');
}

function generateSingleAnswer(vc, question) {
  var isDT = vc.type === 'digital_twin';
  var decision = getTagValue(vc.tags, '决策风格');
  var funcPref = getTagValue(vc.tags, '功能偏好');
  var priceSense = getTagValue(vc.tags, '价格敏感度');
  var techPref = getTagValue(vc.tags, '科技偏好');
  var priceScore = getTagScore(vc.tags, '价格敏感度');
  var techScore = getTagScore(vc.tags, '科技偏好');
  var safetyScore = getTagScore(vc.tags, '安全关注度');
  var brandScore = getTagScore(vc.tags, '品牌忠诚度');
  var appearance = getTagValue(vc.tags, '外观偏好');
  var rangeAnxiety = getTagValue(vc.tags, '续航焦虑');
  
  // 使用人格特征调整回答语气
  var personality = vc.personality || {};
  var speechIntro = '';
  if (isDT && personality.speechStyle) {
    speechIntro = '（' + (vc.gender === '女' ? '她' : '他') + '的说话风格：' + personality.speechStyle.split('；')[0] + '）\n\n';
  }
  
  var answer = '【' + vc.name + '的视角】\n\n';
  if (speechIntro) answer += speechIntro;
  var isPriceQ = question.indexOf('价格') >= 0 || question.indexOf('定价') >= 0 || question.indexOf('价位') >= 0 || question.indexOf('贵') >= 0 || question.indexOf('便宜') >= 0 || question.indexOf('值不值') >= 0;
  var isConfigQ = question.indexOf('配置') >= 0 || question.indexOf('功能') >= 0 || question.indexOf('智能') >= 0 || question.indexOf('座舱') >= 0;
  var isCompareQ = question.indexOf('竞品') >= 0 || question.indexOf('对比') >= 0 || question.indexOf('竞争') >= 0;
  var isRecommendQ = question.indexOf('推荐') >= 0 || question.indexOf('朋友') >= 0 || question.indexOf('建议') >= 0;
  var isScenarioQ = question.indexOf('场景') >= 0 || question.indexOf('用车') >= 0;
  var isGeneralQ = question.indexOf('怎么样') >= 0 || question.indexOf('觉得') >= 0 || question.indexOf('评价') >= 0;

  if (isGeneralQ) {
    answer += '作为一个' + decision + '的消费者，我对这款车的整体评价是：\n\n';
    answer += '💰 **价格**：';
    if (priceScore > 0.7) {
      if (question.indexOf('25万') >= 0) answer += '25万的定价对我来说偏高，我的心理价位在20万左右。';
      else answer += '价格是我最关心的因素，会仔细对比同价位车型的性价比。';
    } else if (priceScore < 0.3) {
      answer += '价格不是首要考量，我更看重品质和体验。';
    } else {
      answer += '价格适中，但需要看配置是否匹配这个价位。';
    }
    answer += '\n\n⚙️ **功能配置**：我的功能偏好是「' + funcPref + '」。';
    if (techScore > 0.7) answer += '智能座舱、辅助驾驶等高科技配置对我吸引力很大，是核心决策因素。';
    if (safetyScore > 0.7) answer += '\n\n🛡️ **安全**：安全配置是选车的硬性指标，必须达标才会考虑。';
    answer += '\n\n🎨 **外观**：外观风格偏好「' + appearance + '」，设计感是重要加分项。';
    if (rangeAnxiety.indexOf('高') >= 0) answer += '\n\n🔋 **续航**：续航焦虑较高，600km续航基本够用但仍有顾虑，需要看实际续航达成率。';
  } else if (isPriceQ) {
    if (priceScore > 0.7) answer += '我对价格非常敏感。定价需要谨慎，如果超出心理预算太多（20%以上），基本不会考虑。更倾向于等优惠或选择入门配置。';
    else if (priceScore < 0.3) answer += '价格不是主要障碍。我更关注产品力是否匹配价格。只要产品到位，定价高一些也可接受。';
    else answer += '价格方面持平衡态度。关键看配置和品牌价值是否匹配定价，性价比合理就会认真考虑。';
  } else if (isConfigQ) {
    answer += '根据我的偏好「' + funcPref + '」，对配置的看法：\n\n';
    if (techScore > 0.7) answer += '✅ 智能座舱、大屏交互、OTA升级 — 核心需求\n✅ 辅助驾驶功能 — 非常看重\n';
    if (safetyScore > 0.7) answer += '✅ 主动安全配置（AEB、盲区监测等）— 必须配备\n';
    answer += '❌ 多余的功能：过于花哨的氛围灯、不必要的豪华装饰';
  } else if (isCompareQ) {
    answer += '从我的决策风格（' + decision + '）来看，竞品对比关键维度：\n\n';
    answer += '1. ' + (priceScore > 0.5 ? '价格竞争力 — 权重最高' : '产品力 — 权重最高') + '\n';
    answer += '2. 功能配置的实用性和差异化\n';
    answer += '3. ' + (brandScore > 0.5 ? '品牌口碑和保值率' : '实际体验和用户评价') + '\n';
    answer += '\n建议：不要只看参数表，实际试驾体验很重要。';
  } else if (isRecommendQ) {
    if (priceScore > 0.7 && techScore < 0.4) answer += '如果朋友需求类似（实用主义、价格敏感），推荐的前提是：价格有竞争力，基础配置扎实。不会为花哨功能多花钱。';
    else if (techScore > 0.7 && priceScore < 0.3) answer += '会向追求科技感和品质的朋友推荐！智能配置是核心亮点，值得体验。';
    else answer += '会根据朋友的具体需求决定是否推荐。车是好车，但要看是否匹配个人用车场景和预算。';
  } else if (isScenarioQ) {
    answer += '从用车场景出发：\n\n';
    answer += '🚗 日常通勤：' + (rangeAnxiety.indexOf('高') >= 0 ? '需要关注充电便利性' : '纯电完全满足需求') + '\n';
    answer += '👨‍👩‍👧 家庭出行：' + (safetyScore > 0.7 ? '空间和安全是核心考量' : '基本能满足') + '\n';
    answer += '🏕️ 周末出游：' + (rangeAnxiety.indexOf('高') >= 0 ? '需提前规划充电' : '续航充足，无焦虑') + '\n';
  } else {
    answer += '感谢你的提问。从消费者画像来看：\n\n';
    answer += '• 决策特点：' + decision + '\n• 功能偏好：' + funcPref + '\n• 价格敏感度：' + priceSense + '\n• 科技接受度：' + techPref + '\n\n';
    answer += '核心诉求：在匹配' + funcPref + '的基础上，兼顾价格合理性和品牌信赖感。';
  }
  answer += '\n\n---\n📌 以上回答基于「' + vc.name + '」';
  answer += isDT ? '（数字分身）的人格数据生成，准确度 ' + (vc.accuracy * 100).toFixed(1) + '%' : '（完全虚拟消费者）的人格数据生成，置信度 ' + (vc.confidence * 100).toFixed(1) + '%';
  return answer;
}

function generateGroupAnswer(question) {
  var groupSelect = document.getElementById('qaGroupSelect');
  var groupValue = groupSelect ? groupSelect.value : 'all';
  var groupVCs = [];
  if (groupValue === 'digital_twins') groupVCs = digitalTwins.slice();
  else if (groupValue === 'synthetic') groupVCs = syntheticPersonas.slice();
  else if (groupValue === 'all') groupVCs = getAllVirtualConsumers();
  else if (groupValue === 'tech_lovers') {
    var all = getAllVirtualConsumers();
    for (var a = 0; a < all.length; a++) { if (getTagScore(all[a].tags, '科技偏好') > 0.6) groupVCs.push(all[a]); }
  } else if (groupValue === 'price_sensitive') {
    var all2 = getAllVirtualConsumers();
    for (var b = 0; b < all2.length; b++) { if (getTagScore(all2[b].tags, '价格敏感度') > 0.6) groupVCs.push(all2[b]); }
  } else if (groupValue === 'family_oriented') {
    var all3 = getAllVirtualConsumers();
    for (var c = 0; c < all3.length; c++) { if (getTagScore(all3[c].tags, '安全关注度') > 0.7 && getTagScore(all3[c].tags, '功能偏好') > 0.6) groupVCs.push(all3[c]); }
  }
  if (groupVCs.length === 0) return '未找到匹配的消费者群体，请调整筛选条件。';
  var avgPrice = 0, avgTech = 0, avgSafety = 0, avgBrand = 0;
  var highPrice = 0, lowPrice = 0;
  for (var i = 0; i < groupVCs.length; i++) {
    var ps = getTagScore(groupVCs[i].tags, '价格敏感度');
    var ts = getTagScore(groupVCs[i].tags, '科技偏好');
    var ss = getTagScore(groupVCs[i].tags, '安全关注度');
    var bs = getTagScore(groupVCs[i].tags, '品牌忠诚度');
    avgPrice += ps; avgTech += ts; avgSafety += ss; avgBrand += bs;
    if (ps > 0.6) highPrice++;
    if (ps < 0.4) lowPrice++;
  }
  avgPrice /= groupVCs.length; avgTech /= groupVCs.length; avgSafety /= groupVCs.length; avgBrand /= groupVCs.length;
  var answer = '【群体分析报告】\n\n📊 分析对象：共 ' + groupVCs.length + ' 位虚拟消费者\n\n**群体画像概览：**\n';
  answer += '• 平均价格敏感度：' + (avgPrice * 100).toFixed(0) + '/100 ' + (avgPrice > 0.6 ? '(偏高)' : (avgPrice < 0.4 ? '(偏低)' : '(适中)')) + '\n';
  answer += '• 平均科技偏好：' + (avgTech * 100).toFixed(0) + '/100 ' + (avgTech > 0.6 ? '(偏高)' : '(适中)') + '\n';
  answer += '• 平均安全关注：' + (avgSafety * 100).toFixed(0) + '/100\n';
  answer += '• 平均品牌忠诚度：' + (avgBrand * 100).toFixed(0) + '/100\n';
  answer += '• 价格敏感型占比：' + (highPrice / groupVCs.length * 100).toFixed(0) + '% | 价格不敏感型：' + (lowPrice / groupVCs.length * 100).toFixed(0) + '%\n\n';
  var isPriceQ = question.indexOf('价格') >= 0 || question.indexOf('定价') >= 0 || question.indexOf('贵') >= 0;
  var isConfigQ = question.indexOf('配置') >= 0 || question.indexOf('功能') >= 0;
  if (isPriceQ) {
    if (avgPrice > 0.6) answer += '💰 **定价建议**：该群体价格敏感度偏高，建议定价策略偏保守，提供灵活金融方案和入门配置选项。';
    else if (avgPrice < 0.4) answer += '💰 **定价建议**：该群体价格不敏感，可考虑中高配置定位，重点突出产品力和品质感。';
    else answer += '💰 **定价建议**：价格敏感度适中，建议提供多配置梯度选择，覆盖不同预算需求。';
  } else if (isConfigQ) {
    answer += '⚙️ **配置偏好**：平均科技偏好为' + (avgTech * 100).toFixed(0) + '/100，';
    answer += avgTech > 0.6 ? '对智能座舱和辅助驾驶有较强需求，建议重点宣传科技配置。' : '对基础实用功能更关注，建议强调空间、安全等实用配置。';
  } else {
    answer += '💡 **综合分析**：该群体对这款车的接受度预期：';
    if (avgPrice < 0.5 && avgTech > 0.6) answer += '较高 — 科技偏好强且价格不敏感，是核心目标客群。';
    else if (avgPrice > 0.7) answer += '中等偏低 — 价格敏感度高，需通过性价比策略打动。';
    else answer += '中等 — 产品力与价格需平衡匹配。';
  }
  answer += '\n\n---\n📌 以上为群体综合分析，基于 ' + groupVCs.length + ' 位虚拟消费者数据。如需个体深度分析，请切换至"单一虚拟消费者"模式。';
  return answer;
}

function renderQAMessages() {
  var container = document.getElementById('qaMessages');
  if (!container) return;
  if (qaConversation.length === 0) {
    container.innerHTML = '<div class="qa-welcome"><div class="qa-welcome-icon">💬</div><p>选择左侧的虚拟消费者，输入你的问题<br/>系统将基于该消费者的<strong>人格数据</strong>进行智能回答</p><p class="muted-text">示例："我有一款20-30万的纯电SUV，你觉得怎么样？"</p></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < qaConversation.length; i++) {
    var msg = qaConversation[i];
    var isUser = msg.role === 'user';
    html += '<div class="qa-message ' + msg.role + '">';
    html += '<div class="qa-msg-avatar">' + (isUser ? '🧑' : '🤖') + '</div>';
    html += '<div>';
    html += '<div class="qa-msg-bubble">' + msg.content.replace(/\n/g, '<br/>') + '</div>';
    html += '<div class="qa-msg-meta">' + (isUser ? '你' : msg.target) + ' · ' + msg.time + '</div>';
    html += '</div></div>';
  }
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function clearQA() {
  qaConversation = [];
  renderQAMessages();
  showToast('对话已清空', 'info');
}

// ========== 全局事件绑定 ==========
function bindAllEvents() {
  var navItems = document.querySelectorAll('.nav-item');
  for (var i = 0; i < navItems.length; i++) {
    (function(nav) {
      nav.addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        setView(view);
      });
    })(navItems[i]);
  }
  var importBtn = document.getElementById('importDataBtn');
  if (importBtn) importBtn.addEventListener('click', function() { showToast('请在下方面板中填写访谈数据', 'info'); });
  var submitBtn = document.getElementById('submitInterviewBtn');
  if (submitBtn) submitBtn.addEventListener('click', submitInterview);
  var calibrateBtn = document.getElementById('calibrateAllBtn');
  if (calibrateBtn) calibrateBtn.addEventListener('click', calibrateAll);
  var genSynthBtn = document.getElementById('generateSyntheticBtn');
  if (genSynthBtn) genSynthBtn.addEventListener('click', generateNewSynthetic);
  var filterSelect = document.getElementById('vcFilterType');
  if (filterSelect) filterSelect.addEventListener('change', renderVCDatabaseTable);
  var filterGroupSelect = document.getElementById('vcFilterGroup');
  if (filterGroupSelect) filterGroupSelect.addEventListener('change', renderVCDatabaseTable);
  var sendBtn = document.getElementById('sendQABtn');
  if (sendBtn) sendBtn.addEventListener('click', sendQA);
  var clearBtn = document.getElementById('clearQABtn');
  if (clearBtn) clearBtn.addEventListener('click', clearQA);
  var exportQABtn = document.getElementById('exportQABtn');
  if (exportQABtn) exportQABtn.addEventListener('click', function() { showToast('分析报告已导出（演示）', 'success'); });
  var qaInput = document.getElementById('qaInput');
  if (qaInput) {
    qaInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQA(); }
    });
  }
  var quickQButtons = document.querySelectorAll('.quick-q-btn');
  for (var q = 0; q < quickQButtons.length; q++) {
    quickQButtons[q].addEventListener('click', function() {
      var qText = this.getAttribute('data-q');
      var input = document.getElementById('qaInput');
      if (input) { input.value = qText; input.focus(); }
    });
  }
  var targetTypeRadios = document.querySelectorAll('input[name="qaTargetType"]');
  for (var r = 0; r < targetTypeRadios.length; r++) {
    targetTypeRadios[r].addEventListener('change', function() {
      currentQATarget = null;
      renderQATargetSelector();
      updateQARespondentLabel();
    });
  }
  var searchInput = document.getElementById('vcSearchInput');
  if (searchInput) searchInput.addEventListener('input', renderVCQuickList);
  var resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      qaConversation = [];
      currentQATarget = digitalTwins.length > 0 ? digitalTwins[0] : null;
      currentQATargetType = 'single';
      renderDashboard();
      renderQAPage();
      updateQARespondentLabel();
      showToast('演示数据已重置', 'info');
    });
  }
  var exportReportBtn = document.getElementById('exportReportBtn');
  if (exportReportBtn) {
    exportReportBtn.addEventListener('click', function() { showToast('平台报告导出功能（演示）', 'info'); });
  }
  
  // ★ 手动同步按钮：点击状态指示器触发强制同步
  var syncStatusIndicator = document.getElementById('autoSyncStatus');
  if (syncStatusIndicator) {
    syncStatusIndicator.addEventListener('click', function() {
      manualForceSync();
    });
  }
  
  // ★ 手动强制同步按钮（在数据导入面板中）
  var manualSyncBtn = document.getElementById('manualForceSyncBtn');
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', function() {
      manualForceSync();
    });
  }
  
  // ★ 诊断面板按钮
  var debugPanelBtn = document.getElementById('debugPanelBtn');
  if (debugPanelBtn) {
    debugPanelBtn.addEventListener('click', function() {
      showDebugInfo();
    });
  }
  var closeDebugBtn = document.getElementById('closeDebugBtn');
  if (closeDebugBtn) {
    closeDebugBtn.addEventListener('click', function() {
      var panel = document.getElementById('debugPanel');
      if (panel) panel.style.display = 'none';
    });
  }
}

// ★ 诊断面板：显示 SharedDataStore 实时状态
function showDebugInfo() {
  var panel = document.getElementById('debugPanel');
  var content = document.getElementById('debugContent');
  if (!panel || !content) {
    console.error('[诊断] debugPanel 或 debugContent 元素未找到！');
    alert('诊断面板元素未找到，请查看控制台 (F12)');
    return;
  }
  
  var lines = [];
  lines.push('=== 诊断时间: ' + new Date().toLocaleTimeString() + ' ===');
  lines.push('');
  
  // 1. SharedDataStore 状态
  lines.push('[SharedDataStore]');
  lines.push('  存在: ' + (typeof SharedDataStore !== 'undefined'));
  if (typeof SharedDataStore !== 'undefined') {
    try {
      var ver = SharedDataStore.getDataVersion();
      var samples = SharedDataStore.getUserSamples();
      lines.push('  dataVersion: ' + (ver.dataVersion || 0));
      lines.push('  dtVersion: ' + (ver.dtVersion || 0));
      lines.push('  userSamples数量: ' + (samples ? samples.length : 0));
      if (samples && samples.length > 0) {
        for (var i = 0; i < Math.min(samples.length, 5); i++) {
          lines.push('    [' + i + '] ' + samples[i].name + ' (' + samples[i].id + ')');
        }
        if (samples.length > 5) lines.push('    ... 还有 ' + (samples.length - 5) + ' 个');
      }
    } catch(e) {
      lines.push('  调用失败: ' + e.message);
    }
  }
  lines.push('');
  
  // 2. localStorage 原始数据
  lines.push('[localStorage]');
  try {
    var raw = localStorage.getItem('vc_ui_shared_data');
    if (raw) {
      lines.push('  vc_ui_shared_data: 存在 (' + raw.length + ' 字符)');
      try {
        var parsed = JSON.parse(raw);
        lines.push('    解析成功');
        lines.push('    userSamples: ' + (parsed.userSamples ? parsed.userSamples.length : 0));
        lines.push('    syncedDigitalTwins: ' + (parsed.syncedDigitalTwins ? parsed.syncedDigitalTwins.length : 0));
        lines.push('    dataVersion: ' + (parsed.dataVersion || 0));
        lines.push('    dtVersion: ' + (parsed.dtVersion || 0));
      } catch(e) {
        lines.push('    解析失败: ' + e.message);
      }
    } else {
      lines.push('  vc_ui_shared_data: 不存在 (未同步过)');
    }
    
    var verRaw = localStorage.getItem('vc_ui_data_version');
    lines.push('  vc_ui_data_version: ' + (verRaw || '不存在'));
  } catch(e) {
    lines.push('  读取失败: ' + e.message);
  }
  lines.push('');
  
  // 3. 本地数字分身状态
  lines.push('[本地状态]');
  lines.push('  digitalTwins: ' + digitalTwins.length + ' 个');
  if (digitalTwins.length > 0) {
    for (var di = 0; di < Math.min(digitalTwins.length, 3); di++) {
      lines.push('    [' + di + '] ' + digitalTwins[di].name + ' (' + digitalTwins[di].id + ') 准确度:' + (digitalTwins[di].accuracy * 100).toFixed(0) + '%');
    }
  }
  lines.push('  syntheticPersonas: ' + syntheticPersonas.length + ' 个');
  lines.push('  autoSyncState.isFirstLoad: ' + autoSyncState.isFirstLoad);
  lines.push('  autoSyncState.lastDtVersion: ' + autoSyncState.lastDtVersion);
  lines.push('  autoSyncState.lastDataVersion: ' + autoSyncState.lastDataVersion);
  lines.push('  autoSyncState.pollingTimer: ' + (autoSyncState.pollingTimer ? '运行中' : '未启动'));
  lines.push('');
  
  // 4. 操作建议
  lines.push('[操作建议]');
  if (digitalTwins.length === 0) {
    lines.push('  ❌ 数字分身为空');
    lines.push('  1. 点击上方 "从用户洞察平台同步数据" 按钮');
    lines.push('  2. 如果仍为空，请打开用户洞察平台页面 (同浏览器)');
    lines.push('  3. 然后再次点击同步按钮');
    lines.push('  4. 查看浏览器控制台(F12)获取详细日志');
  } else {
    lines.push('  ✅ 已有 ' + digitalTwins.length + ' 个数字分身');
  }
  
  content.innerHTML = lines.join('<br>');
  panel.style.display = 'block';
  console.log('[诊断] 面板已打开，' + lines.length + ' 行信息');
}

// ========== 初始化 ==========
function init() {
  var allPanels = document.querySelectorAll('.work-panel.view');
  for (var i = 0; i < allPanels.length; i++) {
    if (!allPanels[i].classList.contains('active')) allPanels[i].style.display = 'none';
  }
  bindAllEvents();
  
  // ★★★ 初始化时主动尝试从 SharedDataStore 加载已有数据 ★★★
  // 解决场景：用户之前打开过用户洞察平台，SharedDataStore 已持久化到 localStorage
  // 但本轮虚拟消费者平台是首次打开，轮询还没来得及检测
  initLoadFromSharedStore();
  
  renderDashboard();
  renderQAPage();
  if (digitalTwins.length > 0) currentQATarget = digitalTwins[0];
  updateQARespondentLabel();
  var panel1 = document.getElementById('personaDashboard');
  if (panel1) panel1.style.display = 'block';
  
  // ★ 启动自动同步检测机制（替代原来的手动同步按钮）
  startAutoSyncWatcher();

  // ★ 仅在已有数字分身时将数据同步到 SharedDataStore，供用户洞察平台导入
  if (digitalTwins.length > 0) {
    syncLocalVCsToSharedStore();
  }
  
  // ★ 更新同步状态指示器
  updateAutoSyncStatusIndicator();
}

// ★★★ 初始化时主动从 SharedDataStore 加载已有数据 ★★★
function initLoadFromSharedStore() {
  if (typeof SharedDataStore === 'undefined') {
    console.log('[初始化] SharedDataStore 未加载，使用内嵌数据兜底');
    loadEmbeddedUserSamplesDirectly();
    return;
  }
  
  var userSamples = SharedDataStore.getUserSamples();
  if (!userSamples || userSamples.length === 0) {
    console.log('[初始化] SharedDataStore 中没有用户样本数据，使用内嵌数据兜底');
    loadEmbeddedUserSamplesDirectly();
    return;
  }
  
  // ★ 用内嵌样本作为白名单，过滤掉可能残留在 localStorage 中的旧数据
  // 注意：当内嵌样本已清空（getEmbeddedSamples() 返回 []）时，说明所有数据应由用户自行创建，
  // 残留的旧数据应全部清除。
  var embeddedSamples = getEmbeddedSamples();
  if (embeddedSamples.length === 0) {
    // 内嵌样本已清空，强制清除 localStorage 中的残留数据
    console.log('[初始化] 内嵌样本已清空，清除 ' + userSamples.length + ' 个残留用户样本');
    SharedDataStore.clear();
    userSamples = [];
  } else {
    var validIds = {};
    for (var i = 0; i < embeddedSamples.length; i++) {
      validIds[embeddedSamples[i].id] = true;
    }
    var filteredSamples = [];
    var removedCount = 0;
    for (var i = 0; i < userSamples.length; i++) {
      if (validIds[userSamples[i].id]) {
        filteredSamples.push(userSamples[i]);
      } else {
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log('[初始化] 过滤掉 ' + removedCount + ' 个未完成调研的用户（残留数据），剩余 ' + filteredSamples.length + ' 个');
      SharedDataStore.pushUserSamples(filteredSamples);
      userSamples = filteredSamples;
    }
  }
  
  if (userSamples.length > 0) {
    console.log('[初始化] SharedDataStore 中有 ' + userSamples.length + ' 个用户样本，直接加载...');
    var versionInfo = SharedDataStore.getDataVersion();
    performSync(userSamples, versionInfo.dataVersion, versionInfo.dtVersion);
    autoSyncState.lastDataVersion = versionInfo.dataVersion;
    autoSyncState.lastDtVersion = versionInfo.dtVersion;
  } else {
    console.log('[初始化] 用户样本为空，跳过同步');
    digitalTwins = [];
    autoSyncState.lastDataVersion = 0;
    autoSyncState.lastDtVersion = 0;
  }
  
  // 标记已完成首次同步
  autoSyncState.isFirstLoad = false;
}

// ★ 不依赖 SharedDataStore 的纯兜底加载（SharedDataStore 未定义时也能工作）
function loadEmbeddedUserSamplesDirectly() {
  // 如果 SharedDataStore 可用，走正常流程
  if (typeof SharedDataStore !== 'undefined') {
    loadEmbeddedUserSamples();
    return;
  }
  
  // SharedDataStore 不可用，直接用内嵌数据生成数字分身
  console.log('[兜底] SharedDataStore 不可用，直接从内嵌数据构建数字分身...');
  var embeddedSamples = getEmbeddedSamples();
  
  // 手动模拟 syncToDigitalTwins 的核心逻辑
  digitalTwins = [];
  for (var i = 0; i < embeddedSamples.length; i++) {
    var us = embeddedSamples[i];
    var vcBase = convertUserSampleToVCBase(us);
    if (!vcBase) continue;
    
    var inferredRounds = inferInterviewRounds(us);
    var inferredAccuracy = inferInitialAccuracy(inferredRounds, us);
    var inferredHistory = buildInitialAccuracyHistory(inferredRounds, inferredAccuracy);
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
      tags: convertConsumerTags(vcBase.consumerTags),
      vehiclePreference: vcBase.vehiclePreference,
      group: vcBase.group,
      source: vcBase.source,
      accuracyHistory: inferredHistory,
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
      personality: personality,
      researchNotes: us.notes || '',
      researchType: us.researchType || '',
      researchDate: us.researchDate || '',
      calibrationLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    digitalTwins.push(newTwin);
  }
  
  console.log('[兜底] 直接从内嵌数据生成了 ' + digitalTwins.length + ' 个数字分身');
  showToast('已加载 ' + digitalTwins.length + ' 个内嵌用户样本！', 'success');
}

// 将 consumerTags 转换为 app.js 使用的 tags 格式
function convertConsumerTags(consumerTags) {
  if (!consumerTags) return [];
  var result = [];
  for (var i = 0; i < consumerTags.length; i++) {
    var ct = consumerTags[i];
    result.push({
      name: ct.name,
      value: ct.value,
      score: ct.score,
      confidence: ct.confidence || 0.85
    });
  }
  return result;
}

// 提取内嵌样本数据（供 loadEmbeddedUserSamplesDirectly 使用）
function getEmbeddedSamples() {
  // 用户样本库中的24个真实用户数据（仅已完成调研场次：S-001/S-003/S-004/S-006）
  // S-002(焦点小组-进行中)和S-005(概念测试-待开始)的12个用户暂未进入样本库
  // 虚拟消费者平台的数字分身与这24个样本库用户一一对应
  return [];
}

// ★ 更新自动同步状态指示器
function updateAutoSyncStatusIndicator() {
  var indicator = document.getElementById('autoSyncStatus');
  if (!indicator) return;
  if (digitalTwins.length > 0) {
    indicator.textContent = '✅ 已同步 ' + digitalTwins.length + ' 个数字分身';
    indicator.className = 'pill done';
  } else {
    indicator.textContent = '⏳ 等待用户洞察平台数据...';
    indicator.className = 'pill pending';
  }
}

// ★ 将本地数字分身推送到 SharedDataStore，供用户洞察平台导入
//    只写入数字分身（DT-XXX）：来自用户洞察平台的真实用户样本
//    完全虚拟消费者（VC-XXX）是平台自建的合成消费者，不写入共享存储
function syncLocalVCsToSharedStore() {
  if (typeof SharedDataStore === 'undefined') return;
  var normalizedVCs = [];
  var dtCount = 0;
  for (var i = 0; i < digitalTwins.length; i++) {
    var vc = digitalTwins[i];
    if (vc.type !== 'digital_twin') continue;
    var normalized = {
      id: vc.id,
      name: vc.name,
      avatar: vc.avatar || vc.name.charAt(0),
      brief: vc.brief || '',
      meta: vc.meta || '',
      type: vc.type,
      accuracy: vc.accuracy || 0,
      confidence: vc.confidence || 0,
      age: vc.age || 30,
      gender: vc.gender || '未知',
      maritalStatus: vc.maritalStatus || '未知',
      children: vc.children || '未知',
      city: vc.city || '',
      cityLevel: vc.cityLevel || '',
      education: vc.education || '',
      income: vc.income || '',
      carOwnership: vc.carOwnership || '',
      currentCar: vc.currentCar || '',
      occupation: vc.occupation || '',
      personality: vc.personality || null,
      tags: vc.tags || [],
      group: vc.group || null,
      interviewRounds: vc.interviewRounds || 0,
      calibrationLog: vc.calibrationLog || []
    };
    dtCount++;
    // 如果 tags 里每项有 confidence 但没有 score，做 fallback
    if (normalized.tags && normalized.tags.length > 0) {
      for (var j = 0; j < normalized.tags.length; j++) {
        if (normalized.tags[j].score === undefined && normalized.tags[j].confidence !== undefined) {
          normalized.tags[j].score = normalized.tags[j].confidence;
        }
        if (normalized.tags[j].confidence === undefined && normalized.tags[j].score !== undefined) {
          normalized.tags[j].confidence = normalized.tags[j].score;
        }
      }
    }
    normalizedVCs.push(normalized);
  }
  SharedDataStore.setVirtualConsumers(normalizedVCs);
  console.log('[虚拟消费者Agent] 已同步 ' + normalizedVCs.length + ' 个数字分身到 SharedDataStore');
}

document.addEventListener('DOMContentLoaded', init);

window.setView = setView;
window.submitInterview = submitInterview;
window.calibrateAll = calibrateAll;
window.generateNewSynthetic = generateNewSynthetic;
window.viewVCDetail = viewVCDetail;
window.onQATargetChange = onQATargetChange;
window.onQAGroupChange = onQAGroupChange;
window.quickSelectVC = quickSelectVC;
window.sendQA = sendQA;
window.clearQA = clearQA;
window.renderVCQuickList = renderVCQuickList;

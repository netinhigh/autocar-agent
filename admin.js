// ============================================================
// 管理后台逻辑
// ============================================================

var currentTab = 'users';

// ===== 初始化 =====
(async function init() {
  if (!window.SUPABASE_READY) {
    alert('Supabase 尚未配置，无法使用管理后台');
    window.location.href = 'index.html';
    return;
  }

  initSupabase();

  // 检查登录和管理员权限
  try {
    var result = await AuthGuard.protect(true);
    if (!result.authenticated) return;

    var profile = await window.Auth.getUserProfile();
    if (profile) {
      document.getElementById('adminInfo').textContent = 
        '管理员: ' + (profile.name || profile.email);
    }

    // 加载数据
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('adminHeader').style.display = 'flex';
    document.getElementById('adminBody').style.display = 'block';

    await loadStats();
    await loadUsers();
    await loadUserSelect();

  } catch (e) {
    console.error('[Admin] 初始化失败:', e);
    document.getElementById('loadingOverlay').innerHTML = 
      '<p style="color:#ff7875;">初始化失败: ' + e.message + '</p>' +
      '<a href="login.html" style="color:#4facfe;margin-top:16px;">返回登录</a>';
  }
})();

// ===== 退出登录 =====
async function handleLogout() {
  if (confirm('确定要退出管理后台吗？')) {
    await window.Auth.logout();
  }
}

// ===== Tab 切换 =====
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(function(c) {
    c.classList.toggle('active', c.id === 'tab-' + tabName);
  });

  if (tabName === 'logs') loadLogs();
  if (tabName === 'data') loadUserSelect();
}

// ===== 加载统计 =====
async function loadStats() {
  try {
    var stats = await window.Auth.adminGetStats();
    document.getElementById('statTotalUsers').textContent = stats.totalUsers;
    document.getElementById('statActiveUsers').textContent = stats.activeUsers;
    document.getElementById('statTodayActive').textContent = stats.todayActiveUsers;
    document.getElementById('statTotalActions').textContent = stats.totalActions;
  } catch (e) {
    console.error('[Admin] 加载统计失败:', e);
  }
}

// ===== 加载用户列表 =====
async function loadUsers() {
  var tbody = document.getElementById('usersTableBody');
  try {
    var users = await window.Auth.adminGetAllUsers();
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">暂无用户数据</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(function(u) {
      var statusLabel = u.account_status === 'active' ? '正常' : '已禁用';
      var statusClass = u.account_status === 'active' ? 'active' : 'disabled';
      var roleLabel = u.role === 'admin' ? '管理员' : '用户';
      var roleClass = u.role === 'admin' ? 'admin' : 'user';
      var lastLogin = u.last_login_at ? formatTime(u.last_login_at) : '从未登录';
      var createdAt = u.created_at ? formatTime(u.created_at) : '--';
      var toggleBtn = u.role === 'admin' ? '' : 
        (u.account_status === 'active' 
          ? '<button class="btn-sm btn-toggle" onclick="toggleUserStatus(\'' + u.id + '\', \'disabled\')">禁用</button>'
          : '<button class="btn-sm btn-toggle enable" onclick="toggleUserStatus(\'' + u.id + '\', \'active\')">启用</button>');

      return '<tr>' +
        '<td>' + escapeHtml(u.name || '--') + '</td>' +
        '<td>' + escapeHtml(u.email || '--') + '</td>' +
        '<td><span class="role-badge ' + roleClass + '">' + roleLabel + '</span></td>' +
        '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td>' + lastLogin + '</td>' +
        '<td>' + createdAt + '</td>' +
        '<td>' + toggleBtn + '</td>' +
        '</tr>';
    }).join('');

  } catch (e) {
    console.error('[Admin] 加载用户列表失败:', e);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell" style="color:#ff7875;">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

// ===== 切换用户状态 =====
async function toggleUserStatus(userId, newStatus) {
  var label = newStatus === 'disabled' ? '禁用' : '启用';
  if (!confirm('确定要' + label + '该用户账号吗？')) return;
  
  try {
    await window.Auth.adminToggleUserStatus(userId, newStatus);
    showToast('用户已' + label, 'success');
    await loadUsers();
    await loadStats();
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error');
  }
}

// ===== 加载使用日志 =====
async function loadLogs() {
  var tbody = document.getElementById('logsTableBody');
  try {
    var logs = await window.Auth.adminGetUsageLogs(100);
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">暂无日志</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(function(log) {
      var profile = log.profiles || {};
      var actionLabel = getActionLabel(log.action);
      var details = log.details ? JSON.stringify(log.details) : '--';

      return '<tr>' +
        '<td>' + escapeHtml(profile.name || profile.email || '--') + '</td>' +
        '<td>' + actionLabel + '</td>' +
        '<td>' + escapeHtml(log.page || '--') + '</td>' +
        '<td>' + formatTime(log.created_at) + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="' + escapeHtml(details) + '">' + escapeHtml(details) + '</td>' +
        '</tr>';
    }).join('');

  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell" style="color:#ff7875;">加载失败: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

// ===== 加载用户下拉框 =====
async function loadUserSelect() {
  var select = document.getElementById('dataUserSelect');
  try {
    var users = await window.Auth.adminGetAllUsers();
    if (!users || users.length === 0) {
      select.innerHTML = '<option value="">-- 无用户 --</option>';
      return;
    }

    var options = users.map(function(u) {
      return '<option value="' + u.id + '">' + 
        escapeHtml(u.name || u.email || '未知用户') + 
        (u.role === 'admin' ? ' [管理员]' : '') +
        '</option>';
    }).join('');

    select.innerHTML = '<option value="">-- 选择用户 --</option>' + options;
  } catch (e) {
    select.innerHTML = '<option value="">-- 加载失败 --</option>';
  }
}

// ===== 加载用户详细数据 =====
async function loadUserDataDetail() {
  var userId = document.getElementById('dataUserSelect').value;
  var container = document.getElementById('dataDetailContainer');
  
  if (!userId) {
    container.innerHTML = '<p class="empty-hint">请选择用户查看其存储的数据</p>';
    return;
  }

  container.innerHTML = '<p class="empty-hint">加载中...</p>';

  try {
    var data = await window.Auth.adminGetUserData(userId);
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-hint">该用户暂无存储数据</p>';
      return;
    }

    var html = '';
    data.forEach(function(row) {
      var value = row.data_value;
      var displayValue;
      if (value && value.userSamples) {
        displayValue = '用户样本库: ' + value.userSamples.length + ' 条记录\n' +
          '数字分身: ' + (value.syncedDigitalTwins ? value.syncedDigitalTwins.length : 0) + ' 个\n' +
          '虚拟消费者: ' + (value.virtualConsumers ? value.virtualConsumers.length : 0) + ' 个\n' +
          '数据版本: v' + (value.dataVersion || 0) + ', DT版本: v' + (value.dtVersion || 0);
      } else {
        displayValue = JSON.stringify(value, null, 2);
      }

      html += '<div class="data-section">' +
        '<h4>📦 ' + escapeHtml(row.data_key) + ' <span style="color:#556677;font-weight:400;font-size:12px;">更新于 ' + formatTime(row.updated_at) + '</span></h4>' +
        '<pre class="data-json">' + escapeHtml(displayValue) + '</pre>' +
        '</div>';
    });

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="empty-hint" style="color:#ff7875;">加载失败: ' + escapeHtml(e.message) + '</p>';
  }
}

// ===== 工具函数 =====
function formatTime(isoStr) {
  if (!isoStr) return '--';
  try {
    var d = new Date(isoStr);
    return d.getFullYear() + '-' +
      pad(d.getMonth() + 1) + '-' +
      pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' +
      pad(d.getMinutes());
  } catch(e) {
    return isoStr;
  }
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActionLabel(action) {
  var map = {
    'login': '🔑 登录',
    'logout': '🚪 登出',
    'page_view': '📄 页面访问',
    'report_generate': '📊 生成报告',
    'data_upload': '📤 数据上传',
    'data_download': '📥 数据下载',
    'sync': '🔄 数据同步'
  };
  return map[action] || action;
}

function showToast(message, type) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + (type || '');
  toast.style.display = 'block';
  setTimeout(function() {
    toast.style.display = 'none';
  }, 3000);
}

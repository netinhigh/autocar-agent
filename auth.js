// ============================================================
// 认证模块 - 基于 Supabase Auth
// 提供登录、登出、会话管理、权限检查等功能
// ============================================================

// ========== Supabase 客户端初始化 ==========
var supabaseClient = null;

function initSupabase() {
  if (!window.SUPABASE_READY) {
    console.error('[Auth] Supabase 未配置，请先设置 supabase-config.js');
    return null;
  }
  
  if (supabaseClient) return supabaseClient;
  
  try {
    // 使用 Supabase JS SDK v2 (CDN加载)
    var config = window.SUPABASE_CONFIG;
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    console.log('[Auth] Supabase 客户端已初始化');
    return supabaseClient;
  } catch (e) {
    console.error('[Auth] Supabase 初始化失败:', e.message);
    return null;
  }
}

// ========== 全局 Auth API ==========
window.Auth = {
  // 获取 Supabase 客户端
  getClient: function() {
    if (!supabaseClient) return initSupabase();
    return supabaseClient;
  },

  // 登录
  login: async function(account, password) {
    var client = this.getClient();
    if (!client) throw new Error('认证服务未就绪');
    
    // 账号自动补全邮箱格式（如 user001 → user001@trial.automarket.cn）
    var email = account.includes('@') ? account : (account + '@trial.automarket.cn');
    
    var result = await client.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (result.error) throw result.error;
    
    // 更新最后登录时间
    await this._updateLastLogin(result.data.user.id);
    
    // 记录登录日志
    await this._logAction(result.data.user.id, 'login', 'login', { account: account });
    
    return result.data;
  },

  // 登出
  logout: async function() {
    var client = this.getClient();
    if (!client) return;
    
    var user = await this.getCurrentUser();
    if (user) {
      await this._logAction(user.id, 'logout', 'login', {});
    }
    
    // 清除本地数据
    if (window.SharedDataStore) {
      window.SharedDataStore.clear();
    }
    
    await client.auth.signOut();
    window.location.href = 'login.html';
  },

  // 获取当前登录用户
  getCurrentUser: async function() {
    var client = this.getClient();
    if (!client) return null;
    
    var result = await client.auth.getUser();
    if (result.error || !result.data.user) return null;
    return result.data.user;
  },

  // 获取当前 session
  getSession: async function() {
    var client = this.getClient();
    if (!client) return null;
    
    var result = await client.auth.getSession();
    if (result.error || !result.data.session) return null;
    return result.data.session;
  },

  // 检查是否已登录
  isLoggedIn: async function() {
    var session = await this.getSession();
    return session !== null;
  },

  // 获取用户角色信息
  getUserProfile: async function() {
    var user = await this.getCurrentUser();
    if (!user) return null;
    
    var client = this.getClient();
    var result = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (result.error) return { id: user.id, email: user.email, role: 'user', name: '未知用户', account_status: 'active' };
    return result.data;
  },

  // 判断是否为管理员
  isAdmin: async function() {
    var profile = await this.getUserProfile();
    return profile && profile.role === 'admin';
  },

  // 检查账号是否被禁用
  isAccountDisabled: async function() {
    var profile = await this.getUserProfile();
    return profile && profile.account_status === 'disabled';
  },

  // 保存用户数据到 Supabase
  saveUserData: async function(dataKey, dataValue) {
    var user = await this.getCurrentUser();
    if (!user) return;
    
    var client = this.getClient();
    
    // upsert 操作
    var result = await client
      .from('user_data')
      .upsert({
        user_id: user.id,
        data_key: dataKey,
        data_value: dataValue,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, data_key'
      });
    
    if (result.error) {
      console.error('[Auth] 保存数据失败:', result.error.message);
    }
  },

  // 从 Supabase 加载用户数据
  loadUserData: async function(dataKey) {
    var user = await this.getCurrentUser();
    if (!user) return null;
    
    var client = this.getClient();
    var result = await client
      .from('user_data')
      .select('data_value')
      .eq('user_id', user.id)
      .eq('data_key', dataKey)
      .maybeSingle();
    
    if (result.error || !result.data) return null;
    return result.data.data_value;
  },

  // 加载用户所有数据
  loadAllUserData: async function() {
    var user = await this.getCurrentUser();
    if (!user) return {};
    
    var client = this.getClient();
    var result = await client
      .from('user_data')
      .select('data_key, data_value')
      .eq('user_id', user.id);
    
    if (result.error || !result.data) return {};
    
    var data = {};
    result.data.forEach(function(row) {
      data[row.data_key] = row.data_value;
    });
    return data;
  },

  // 记录操作日志
  _logAction: async function(userId, action, page, details) {
    var client = this.getClient();
    if (!client) return;
    
    await client.from('usage_logs').insert({
      user_id: userId,
      action: action,
      page: page,
      details: details || {},
      created_at: new Date().toISOString()
    });
  },

  // 更新最后登录时间
  _updateLastLogin: async function(userId) {
    var client = this.getClient();
    if (!client) return;
    
    await client.from('profiles').upsert({
      id: userId,
      last_login_at: new Date().toISOString()
    }, {
      onConflict: 'id',
      ignoreDuplicates: false 
    });
  },

  // 管理员功能：获取所有用户列表
  adminGetAllUsers: async function() {
    var profile = await this.getUserProfile();
    if (!profile || profile.role !== 'admin') throw new Error('无权限访问');
    
    var client = this.getClient();
    var result = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (result.error) throw result.error;
    return result.data;
  },

  // 管理员功能：获取所有使用日志
  adminGetUsageLogs: async function(limit) {
    var profile = await this.getUserProfile();
    if (!profile || profile.role !== 'admin') throw new Error('无权限访问');
    
    var client = this.getClient();
    var query = client
      .from('usage_logs')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    
    if (limit) query = query.limit(limit);
    
    var result = await query;
    if (result.error) throw result.error;
    return result.data;
  },

  // 管理员功能：获取某用户的详细使用数据
  adminGetUserData: async function(targetUserId) {
    var profile = await this.getUserProfile();
    if (!profile || profile.role !== 'admin') throw new Error('无权限访问');
    
    var client = this.getClient();
    var result = await client
      .from('user_data')
      .select('*')
      .eq('user_id', targetUserId);
    
    if (result.error) throw result.error;
    return result.data;
  },

  // 管理员功能：获取使用统计
  adminGetStats: async function() {
    var profile = await this.getUserProfile();
    if (!profile || profile.role !== 'admin') throw new Error('无权限访问');
    
    var client = this.getClient();
    
    // 总用户数
    var usersResult = await client.from('profiles').select('*', { count: 'exact', head: true });
    var totalUsers = usersResult.count || 0;
    
    // 活跃用户数
    var activeResult = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'active');
    var activeUsers = activeResult.count || 0;
    
    // 今日活跃用户
    var today = new Date().toISOString().split('T')[0];
    var todayLogins = await client
      .from('usage_logs')
      .select('user_id', { count: 'exact', head: true })
      .eq('action', 'login')
      .gte('created_at', today);
    
    // 总操作数
    var totalLogs = await client.from('usage_logs').select('*', { count: 'exact', head: true });
    
    return {
      totalUsers: totalUsers,
      activeUsers: activeUsers,
      todayActiveUsers: todayLogins.count || 0,
      totalActions: totalLogs.count || 0
    };
  },

  // 管理员：禁用/启用用户账号
  adminToggleUserStatus: async function(userId, newStatus) {
    var profile = await this.getUserProfile();
    if (!profile || profile.role !== 'admin') throw new Error('无权限访问');
    
    var client = this.getClient();
    var result = await client
      .from('profiles')
      .update({ account_status: newStatus })
      .eq('id', userId);
    
    if (result.error) throw result.error;
    return true;
  }
};

// ========== 登录守卫 ==========
window.AuthGuard = {
  // 页面加载时检查登录状态，未登录则跳转到登录页
  protect: async function(requireAdmin) {
    var supabaseReady = window.SUPABASE_READY;
    if (!supabaseReady) {
      console.warn('[AuthGuard] Supabase 未配置，跳过登录验证（开发模式）');
      return { authenticated: false, devMode: true };
    }
    
    try {
      var isLoggedIn = await window.Auth.isLoggedIn();
      if (!isLoggedIn) {
        // 从 login.html 到功能页之间可能有路径跳转，统一处理
        var loginPath = this._getLoginPath();
        window.location.href = loginPath;
        return { authenticated: false };
      }

      // 如需管理员权限
      if (requireAdmin) {
        var isAdmin = await window.Auth.isAdmin();
        if (!isAdmin) {
          alert('您没有管理员权限');
          window.location.href = '../index.html';
          return { authenticated: false };
        }
      }

      // 检查账号是否被禁用
      var isDisabled = await window.Auth.isAccountDisabled();
      if (isDisabled) {
        alert('您的账号已被管理员禁用，请联系管理员');
        await window.Auth.logout();
        return { authenticated: false };
      }

      return { authenticated: true };
    } catch (e) {
      console.error('[AuthGuard] 验证失败:', e.message);
      return { authenticated: false, error: e.message };
    }
  },

  // 获取登录页路径（处理不同目录层级）
  _getLoginPath: function() {
    var path = window.location.pathname;
    if (path.includes('/用户洞察Agent/') || path.includes('/虚拟消费者Agent/')) {
      return '../login.html';
    } else if (path.includes('/admin.html')) {
      return 'login.html';
    } else {
      return 'login.html';
    }
  }
};

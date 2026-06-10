// ============================================================
// Supabase 配置文件
// 请在 Supabase 项目设置中获取以下信息:
//   https://app.supabase.com → 你的项目 → Settings → API
// ============================================================

window.SUPABASE_CONFIG = {
  url: 'https://iztwighmyesdkojqomra.supabase.co',
  anonKey: 'sb_publishable_7ZJ9Ttt-kFtSi3ZqfgFNUA_fYaNLiBz',
  
  // ★ 管理员专用 service_role key（仅用于后端操作，如需使用请在此填入）
  serviceRoleKey: ''
};

// 检查是否已配置
(function checkConfig() {
  if (window.SUPABASE_CONFIG.url.includes('YOUR-PROJECT-ID')) {
    console.warn('⚠️ [Supabase] 请先在 supabase-config.js 中配置你的 Supabase 项目 URL 和 anonKey');
    console.warn('   1. 访问 https://app.supabase.com 创建项目');
    console.warn('   2. 进入 Settings → API 获取 Project URL 和 anon key');
    console.warn('   3. 将值填入 supabase-config.js');
    window.SUPABASE_READY = false;
  } else {
    window.SUPABASE_READY = true;
  }
})();

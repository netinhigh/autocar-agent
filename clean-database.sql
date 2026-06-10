-- ============================================================
-- 数据库清理脚本：删除所有演示/测试数据
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================================

-- 1. 清空操作日志表（保留表结构）
DELETE FROM usage_logs;
SELECT 'usage_logs 已清空，剩余 ' || COUNT(*) || ' 条' AS result FROM usage_logs;

-- 2. 清空用户数据表（保留表结构）
DELETE FROM user_data;
SELECT 'user_data 已清空，剩余 ' || COUNT(*) || ' 条' AS result FROM user_data;

-- 3. 删除测试用户账号（如果有的话）
-- 注意：这也会删除对应的 profiles 记录（因为 CASCADE）
-- 如果你的 admin/billpeng 是正式账号，请跳过此步！
-- DELETE FROM auth.users WHERE email LIKE '%trial.automarket.cn';
-- 如果只想删除特定测试用户：
-- DELETE FROM auth.users WHERE email IN ('user001@trial.automarket.cn', 'admin@trial.automarket.cn');

-- 4. 查看清理后的状态
SELECT 
  (SELECT COUNT(*) FROM auth.users) AS total_auth_users,
  (SELECT COUNT(*) FROM profiles) AS total_profiles,
  (SELECT COUNT(*) FROM user_data) AS total_user_data,
  (SELECT COUNT(*) FROM usage_logs) AS total_usage_logs;

-- ============================================================
-- 清理完成！
-- 用户登录后将自动创建 profile，所有数据从空白开始
-- ============================================================

-- ============================================================
-- Supabase 数据库建表脚本
-- 请在 Supabase Dashboard → SQL Editor 中运行此脚本
-- ============================================================

-- 1. 创建 profiles 表（扩展 auth.users）
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- 2. 创建 user_data 表（用户数据存储）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,
  data_value JSONB DEFAULT '{}'::jsonb,
  data_size_bytes BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_key)
);

-- 迁移：已有数据库补充 data_size_bytes 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_data' AND column_name = 'data_size_bytes'
  ) THEN
    ALTER TABLE user_data ADD COLUMN data_size_bytes BIGINT DEFAULT 0;
    -- 回填已有数据的字节数
    UPDATE user_data SET data_size_bytes = octet_length(data_value::text) WHERE data_size_bytes = 0;
  END IF;
END $$;

-- 3. 创建 usage_logs 表（操作日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  page TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_key ON user_data(data_key);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 5. 启用 RLS（行级安全策略）
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS 策略 - profiles
-- ============================================================
-- 所有人可以查看自己的 profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 管理员可以查看所有 profile
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 管理员可以更新 profile
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 管理员可以插入 profile
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 7. RLS 策略 - user_data
-- ============================================================
-- 用户只能读写自己的数据
CREATE POLICY "Users can manage own data"
  ON user_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 管理员可以查看所有用户数据
CREATE POLICY "Admins can view all user data"
  ON user_data FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 8. RLS 策略 - usage_logs
-- ============================================================
-- 用户只能查看自己的日志
CREATE POLICY "Users can view own logs"
  ON usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以插入自己的日志
CREATE POLICY "Users can insert own logs"
  ON usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 管理员可以查看所有日志
CREATE POLICY "Admins can view all logs"
  ON usage_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 9. 触发器：新用户注册时自动创建 profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'user',
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. 所有用户详情的视图（管理员用）
-- ============================================================
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT 
  p.id,
  p.name,
  p.email,
  p.role,
  p.account_status,
  p.last_login_at,
  p.created_at,
  COUNT(DISTINCT ud.data_key) AS data_keys_count,
  COALESCE(SUM(ud.data_size_bytes), 0) AS total_storage_bytes,
  COUNT(DISTINCT ul.id) AS total_actions
FROM profiles p
LEFT JOIN user_data ud ON p.id = ud.user_id
LEFT JOIN usage_logs ul ON p.id = ul.user_id
GROUP BY p.id, p.name, p.email, p.role, p.account_status, p.last_login_at, p.created_at;

-- 11. 用户云端存储用量详情视图
-- ============================================================
CREATE OR REPLACE VIEW user_storage_detail AS
SELECT
  p.id AS user_id,
  p.name,
  p.email,
  ud.data_key,
  ud.data_size_bytes,
  ud.updated_at,
  ROUND(ud.data_size_bytes::numeric / 1048576, 3) AS size_mb
FROM profiles p
JOIN user_data ud ON p.id = ud.user_id
ORDER BY p.id, ud.data_size_bytes DESC;

-- ============================================================
-- 11. 账户管理说明
-- ============================================================
-- 以下是几种创建用户账号的方法：

-- 方法 A：通过 Supabase Dashboard 创建
--   Authentication → Users → Add User
--   输入邮箱和密码即可，系统自动发送确认邮件

-- 方法 B：通过 SQL 直接创建（自动确认，无需邮件验证）
--   注意：把以下内容中的邮箱和密码替换为实际值

/*
-- 创建新用户（账号: user001@trial.automarket.cn, 密码: 123456）
SELECT supabase_admin.create_user(
  '{"email": "user001@trial.automarket.cn", "password": "123456", "email_confirm": true, "user_metadata": {"name": "测试用户001"}}'
);

-- 创建管理员账号
SELECT supabase_admin.create_user(
  '{"email": "admin@trial.automarket.cn", "password": "Admin123!", "email_confirm": true, "user_metadata": {"name": "系统管理员"}}'
);

-- 将指定用户设为管理员
UPDATE profiles SET role = 'admin' WHERE email = 'admin@trial.automarket.cn';
*/

-- ============================================================
-- 13. 禁用邮件确认（可选，适合内测试用场景）
-- ============================================================
-- 如果不想让用户收确认邮件，在 Authentication → Settings 中：
--   关闭 "Confirm email" 开关
-- 或者在 SQL 中执行：
--   ALTER ROLE authenticator SET pgrst.jwt_claims TO 'role: "authenticated"';

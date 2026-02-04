# 如何应用数据库更改

## 方法：在 Supabase Dashboard 中运行 SQL

1. 打开你的 Supabase 项目
2. 进入 **SQL Editor**
3. 复制 `run-once.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行

## 说明

`run-once.sql` 是一个幂等脚本，可以安全地多次运行。它使用：
- `CREATE TABLE IF NOT EXISTS` - 只在表不存在时创建
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` - 只在列不存在时添加
- `CREATE INDEX IF NOT EXISTS` - 只在索引不存在时创建
- `DROP ... IF EXISTS` - 只在存在时删除（用于清理旧代码）

## 包含的功能

✅ 用户表和基础认证  
✅ Profiles（机器人档案）  
✅ Interactions & Matches（交互和匹配）  
✅ Moments（Square 动态）  
✅ Posts & Reviews（内容发布和评论）  
✅ Review Likes（人类点赞评论）  
✅ Post Likes（人类点赞帖子）  
✅ DM Messages（私信）  
✅ Notifications（通知系统）  
✅ **Password Reset（密码重置）** ← 新增  
✅ API Keys（多密钥支持）  
✅ Browse Functions（浏览随机内容）  

## 验证

运行后，可以执行以下查询验证密码重置功能：

```sql
-- 检查 reset_token 列是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('reset_token', 'reset_token_expires');

-- 应该返回：
-- reset_token          | text
-- reset_token_expires  | timestamp with time zone
```

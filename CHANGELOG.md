# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循语义化。

## [2.1.0] - 2026-10-31

适配 ZCode 2026-10-29 重新打包的 `zcode.cjs`（15,405,921 bytes）：

### 修复
- 补丁 1（CLI Prefix）：身份文案改为 `"You are ZCode, an interactive agent"` 并挪到模块级变量 `uBa` —— 锚点泛化为正则 `VAR="You are ZCode, an interactive [^"]*"`，文案再微调也能命中
- 补丁 2（customSystemPrompt）：代码形态变为 `X=this.config.customSystemPrompt,Y=!!X?.trim(),` —— 正则同时兼容新旧两种形态
- 补丁 3（Agent Identity）：外层函数变为 `function wDn(e,t=!0)` 带默认参数 —— `Get-EnclosingFunction` 形参匹配放宽为 `[^()]*`

### 修复（verify-patch.cjs）
- 同步以上三处锚点修复
- 目标文件解析改为 `argv[2]` → `ZCODE_DIR` → `zcode-dir.txt` 缓存 → 旧默认值，不再写死 `D:\app\zcode`
- 第 5/6 步剥离执行改用 `with`+Proxy 兜底作用域，不再写死 `FVs`/`jVs` 等旧变量名

## [2.0.0] - 2026-09-19

适配 ZCode 2026-09-19 重新打包的 `zcode.cjs`，重写自 v1：

### 变更
- 锚点从压缩变量名（`Djo`/`Eut`/`fre`…）改为语义字面量定位
- 任一补丁未命中即中止且不写入，不再静默无效；新增 `-AllowPartial` 强制选项
- 写入前用 `node --check` 做语法校验
- 备份策略修复：ZCode 更新后自动刷新 `.bak` 为新版原版，还原不再降级
- 安装目录检测补齐常见位置 + 扫盘 + 结果缓存（修复 `Get-PSDrive` 参数错误）

## [1.0.0]

初版（上游 [zzooymc-source/ZCode-Deploy](https://github.com/zzooymc-source/ZCode-Deploy)）。

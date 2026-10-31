# ZCode-Deploy

> 一键把本地 [ZCode](https://zcode.dev) 的 system 层换成你自己的"人格文件"——改一个 txt，开新对话即生效。

这是 [zzooymc-source/ZCode-Deploy](https://github.com/zzooymc-source/ZCode-Deploy) 的修改版（MIT），当前版本 **v2.1**，适配 ZCode **2026-10-29** 重新打包的 `zcode.cjs`。

---

## 它做什么

ZCode 每次启动都会在 system prompt 里注入产品身份声明、日期提醒、Skills 列表等固定内容。本工具通过给本地安装的 `zcode.cjs` 打 6 个语义锚点补丁，把这些替换为外部文件 `人格.txt`：

```
部署前 system 层:
  "You are ZCode, an interactive ..." + 身份/日期/Skills/User Context …

部署后 system 层:
  人格.txt 全文（其余产品注入全部清空或置 null）
```

**日常换人格不需要重新部署**：编辑 `人格.txt` → 保存 → 开新对话即生效（路径已写入补丁，热读取）。

### 特性

- 一键部署 / 一键还原，全自动检测 ZCode 安装目录（支持 `D:\ZCode` 等任意位置）
- 锚点按语义字面量/正则定位，不依赖压缩后的变量名，ZCode 小幅更新通常无需改脚本
- 6 个补丁任一未命中即**中止且不写入**（可 ` -AllowPartial` 强制），绝不静默无效
- 写入前用 `node --check` 做语法校验，校验不过不落盘
- 备份策略：ZCode 更新后自动把 `.bak` 刷新为新版原版，**还原永远不会把应用降级回旧版**
- 自带功能验证器：把补丁后的函数真正抽出来执行，而不是只对字符串

## 环境要求

| 依赖 | 说明 |
|---|---|
| Windows 10/11 | PowerShell 5.1+（系统自带即可） |
| ZCode 桌面版 | 本工具修改的是 `resources\glm\zcode.cjs` |
| Node.js | 可选但强烈建议：用于写入前语法校验和功能验证；没有也能部署（跳过校验） |

## 快速开始

```
1. 双击 部署.bat        ← 自动备份、打补丁、校验、重启 ZCode
2. 编辑 人格.txt        ← 写入你想要的人格设定
3. 开新对话             ← 生效
```

### 四个 bat

| 文件 | 作用 |
|---|---|
| `部署.bat` | 备份原版 → 打 6 补丁 → 语法校验 → 写入 → 自检 → 重启 ZCode |
| `恢复.bat` | 还原 ZCode 原版（保留 `人格.txt`） |
| `查看状态.bat` | 当前部署状态 + 6 项补丁校验 |
| `验证.bat` | 注入点诊断 + 功能验证（实际执行补丁后的函数） |

### 命令行用法

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1 install    # 部署
powershell -ExecutionPolicy Bypass -File deploy.ps1 restore    # 还原
powershell -ExecutionPolicy Bypass -File deploy.ps1 status     # 状态
powershell -ExecutionPolicy Bypass -File deploy.ps1 diag       # 列出全部注入片段（排查用）
powershell -ExecutionPolicy Bypass -File deploy.ps1 install -NoRestart   # 部署但不重启 ZCode
powershell -ExecutionPolicy Bypass -File deploy.ps1 install -AllowPartial # 有补丁未命中也强行部署（不推荐）
```

> 部署/还原会重启 ZCode。如果正在 ZCode 里跑别的事情，加 `-NoRestart`，之后手动重启一次即可。

## 六个补丁

| # | 目标 | 方式 |
|---|------|------|
| 1 | CLI Prefix 身份声明（`"You are ZCode, an interactive …"`） | 变量置空 |
| 2 | `customSystemPrompt` | 改为 `readFileSync(人格.txt)` —— **唯一 system 内容来源** |
| 3 | Agent Identity | 同步改读人格文件（保留原逻辑兜底，双保险） |
| 4 | Current Date 日期提醒 | 函数开头插 `return null;` |
| 5 | Skills 列表 | 同上 |
| 6 | Request User Context | 同上 |

v2.1 起补丁 1/2/3 的锚点做了泛化（正则匹配、兼容两种代码形态、支持带默认参数的函数），ZCode 文案或变量名微调一般不再导致失效；结构真变了会明确报错并打印诊断。历次适配细节见 [修改记录.md](修改记录.md)。

## ZCode 目录检测顺序

1. 环境变量 `ZCODE_DIR`（手动指定最可靠：`set ZCODE_DIR=D:\ZCode`）
2. 运行中的 ZCode 进程路径
3. `zcode-dir.txt` 缓存（上次检测结果）
4. 常见安装位置 → 各盘符根目录 → 兜底扫盘（深度 3）

检测结果会写入 `zcode-dir.txt`，`verify-patch.cjs` 也复用这个缓存。

## 文件结构

```
ZCode-Deploy\
├── 部署.bat / 恢复.bat / 查看状态.bat / 验证.bat
├── deploy.ps1            主脚本（v2.1）
├── verify-patch.cjs      功能验证器（真正执行补丁后的函数，9 项检查）
├── 人格.txt              人格文件 —— 唯一的日常编辑入口（个人内容，不入库；clone 后自建一份，纯文本即可）
├── 修改记录.md           架构原理、历次锚点适配、排查手册
├── backups\              原版归档（自动保留最近 6 份，已被 .gitignore 排除）
└── zcode-dir.txt         ZCode 目录缓存（机器相关，已被 .gitignore 排除）
```

## 常见问题

<details>
<summary><b>ZCode 更新后部署失效了</b></summary>

重跑 `部署.bat`。脚本会识别新版原版、刷新备份、重新打补丁。如果注入点结构真的变了，会**明确报"补丁未命中"并打印诊断、不写入**——把 `diag` 输出和报错对照 [修改记录.md](修改记录.md) 第 9 节的锚点表更新正则即可。
</details>

<details>
<summary><b>移动了本工具的文件夹</b></summary>

人格文件的绝对路径在部署时被写进 `zcode.cjs`，移动文件夹后必须重跑 `部署.bat`，否则读文件失败会静默回退原版行为。
</details>

<details>
<summary><b>怎么确认真的生效了</b></summary>

双击 `验证.bat`。另外可以直接看模型请求日志：`%USERPROFILE%\.zcode\cli\rollout\model-io-*.jsonl`，system 层应为 `人格.txt` 全文。
</details>

<details>
<summary><b>编辑 deploy.ps1 后报一堆语法错</b></summary>

中文 UTF-8 文件无 BOM 时，Windows PowerShell 5.1 会按 GBK 解析。用编辑器把 `deploy.ps1` 另存为 **UTF-8 with BOM**。
</details>

<details>
<summary><b>workflowActor 与 customSystemPrompt 互斥报错</b></summary>

ZCode 原生限制：`workflowActor` 配置了值时 `customSystemPrompt` 必须为空。补丁 2 强制让 `customSystemPrompt` 有值，若你同时启用了 workflow actor 会抛 `ContextBuilder: ... mutually exclusive`。日常使用（不配 workflow actor）不受影响。
</details>

<details>
<summary><b>模型不完全听人格的话</b></summary>

补丁只负责把 system 层换掉；模型自身的安全策略与训练偏好无法在补丁层改变，属预期现象。
</details>

## 免责声明

- 本工具**修改你本机已安装的 ZCode 程序文件**，仅供个人学习与自定义使用，请自行承担使用风险
- 与 ZCode 官方无关，也不是官方功能；应用更新可能随时使锚点失效
- 部署前自动备份原版，`恢复.bat` 可完整还原；`backups\` 内的归档请勿再分发
- 请勿将补丁产物（修改后的 `zcode.cjs` 或其备份）用于二次分发

## 致谢

- 原项目：[zzooymc-source/ZCode-Deploy](https://github.com/zzooymc-source/ZCode-Deploy)（MIT），本仓库的修改部分同样以 MIT 发布，详见 [LICENSE](LICENSE)

# Rent Lens

Rent Lens 是一个本地运行的租房信息整理工具。它适合把 Facebook 上零散的房源帖子整理成可搜索、可分类、可跟进的本地笔记。

它主要解决这些问题：

- 房源帖子常见匈牙利语 / 英语，阅读成本高。
- Facebook 信息分散，沟通过后容易忘。
- 租金、押金、地址、联系方式、图片和备注混在一起。
- 多个帖子需要像待办一样分类和跟进。

## 功能

- 保存 Facebook 房源链接、正文和图片。
- 保留原文，并用一个小切换器查看原文 / 翻译。
- 提取租金、押金、其他费用、城市、地址、户型、入住时间、联系方式和重要信息。
- 按参考货币展示金额换算。
- 展示地图位置、Google Maps 入口，以及到目标地址的通勤参考。
- 支持分类、城市筛选、联系状态和个人备注。
- 支持多个 AI 供应商，前一个失败会自动尝试下一个。
- 支持中英文界面切换，但不会改动已保存的帖子内容。
- 支持浏览器插件从当前 Facebook 页面采集可见帖子。
- 支持按链接和正文相似度清理重复帖子。

## 数据和隐私

这是本地优先项目。你的帖子、备注、API Key 默认保存在本机：

```txt
data/store.json
```

这个文件不会提交到 GitHub。仓库里只保留 `data/.gitkeep`，用来保留目录结构。

不会提交的内容包括：

```txt
data/store.json
node_modules/
dist/
.env
release/
```

第一次启动时，如果没有 `data/store.json`，项目会自动创建一个空配置：

- 默认界面语言：英文
- 默认翻译语言：英文
- 默认参考货币：CNY
- AI 供应商：空，需要用户自己在设置里添加
- 房源数据：空

所以 GitHub 上只会有项目结构和源码，不会带你的个人数据。

## 最简单启动方式

### macOS 用户

1. 安装 Node.js 20 或更新版本：<https://nodejs.org/>
2. 双击项目里的这个文件：

   ```txt
   start-mac.command
   ```

脚本会自动安装依赖，然后打开：

```txt
http://127.0.0.1:5173/
```

如果系统阻止打开脚本，可以在终端里运行：

```bash
cd /path/to/rent-lens
chmod +x start-mac.command
./start-mac.command
```

### Windows 用户

1. 安装 Node.js 20 或更新版本：<https://nodejs.org/>
2. 双击项目里的这个文件：

   ```txt
   start-windows.cmd
   ```

脚本会自动安装依赖，然后打开：

```txt
http://127.0.0.1:5173/
```

如果 Windows 安全提示拦截，选择允许运行，或在终端里进入项目目录后执行：

```bat
start-windows.cmd
```

### 通用启动方式

```bash
npm install
npm run dev
```

打开：

```txt
http://127.0.0.1:5173/
```

本地 API 地址是：

```txt
http://127.0.0.1:8787/
```

## 浏览器插件

插件目录：

```txt
extension/
```

安装方式：

1. 先启动 Rent Lens。
2. 打开 Chrome 或 Edge。
3. 进入：

   ```txt
   chrome://extensions
   ```

4. 开启 Developer mode / 开发者模式。
5. 点击 Load unpacked / 加载已解压的扩展程序。
6. 选择本项目的 `extension/` 文件夹。

使用方式：

1. 正常登录 Facebook。
2. 打开一个房源帖子，最好点开帖子弹窗。
3. 点击浏览器工具栏里的 Rent Lens Capture。
4. 可以先预览识别结果，再保存。
5. 回到 `http://127.0.0.1:5173/` 查看结果。

插件只读取你浏览器里已经显示出来的内容，不绕过 Facebook 权限。插件会把数据发送到本机 API：`http://127.0.0.1:8787`。

更多插件说明见：[extension/README.zh-CN.md](extension/README.zh-CN.md)

## AI 配置

不配置 AI 也可以保存帖子，但只能做基础处理。要启用翻译和结构化分析，需要在设置里添加 AI 供应商。

内置供应商包括：

- OpenAI
- Gemini
- Claude
- DeepSeek
- Kimi
- Qwen / 通义千问
- GLM / 智谱
- NVIDIA AI
- MiniMax
- 自定义 OpenAI 兼容接口

API Key 只保存在本地 `data/store.json`，不会提交到 GitHub。

## 常用命令

```bash
npm run dev      # 启动前端和本地 API
npm run start    # 同 npm run dev
npm run build    # 构建检查
npm run check    # 构建 + npm 安全检查
npm run preview  # 预览构建结果
```

## 项目结构

```txt
extension/       Chrome / Edge 采集插件
server/          本地 API、AI 调用、地图、去重、本地存储
src/             React 页面、样式、i18n、AI 供应商预设、类型
data/            本地运行数据目录，GitHub 只保留空目录
```

## 发布和下载

推荐方式：

1. 把项目推到 GitHub。
2. 在 GitHub 创建 Release。
3. 上传本地生成的 `release/rent-lens-v0.1.0-source.zip`。

GitHub 也会自动提供 Source code zip，但手动上传的 zip 文件名更清楚，适合发给朋友。

使用者下载 zip 后，解压，安装 Node.js 20+，然后双击对应启动脚本即可。

## 发布到 GitHub 前

建议先运行：

```bash
npm run check
```

然后确认不要提交这些文件：

```txt
data/store.json
node_modules/
dist/
.env
release/
```

如果要公开给别人复用，建议补一个 License，例如 MIT。

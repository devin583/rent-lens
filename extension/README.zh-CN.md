# Rent Lens Capture Extension

这是 Rent Lens 的 Chrome / Edge 本地采集插件。

它不会绕过 Facebook 权限，只读取当前浏览器里已经显示出来的帖子内容，然后发送到本机 Rent Lens API。

## 前提

先启动主项目：

```bash
npm run dev
```

本地 API 需要运行在：

```txt
http://127.0.0.1:8787
```

## 安装

1. 打开 Chrome 或 Edge。
2. 进入：

   ```txt
   chrome://extensions
   ```

3. 开启 Developer mode / 开发者模式。
4. 点击 Load unpacked / 加载已解压的扩展程序。
5. 选择本项目里的 `extension/` 文件夹。

## 使用

1. 正常登录 Facebook。
2. 打开房源帖子，最好点开帖子弹窗。
3. 点击浏览器工具栏里的 Rent Lens Capture。
4. 点击 Preview capture 可以先预览识别内容。
5. 点击 Save current post 会保存到本地 Rent Lens。
6. 回到 `http://127.0.0.1:5173/` 查看分析结果。

## 识别策略

- 优先读取当前 Facebook 弹窗。
- 没有弹窗时，读取页面中心附近的帖子。
- 如果识别不准，可以先手动选中帖子正文，再点击插件。
- 图片会尽量保留帖子大图，过滤头像和小图标。

## 联动说明

插件固定连接本地地址：

```txt
http://127.0.0.1:8787
```

所以使用插件时，主项目必须正在运行。这样做的好处是 API Key、帖子数据和备注都留在用户自己的电脑上。

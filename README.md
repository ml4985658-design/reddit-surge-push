# reddit-surge-push

这是一个给 iPhone Surge 使用的 Reddit 热门帖本地通知项目。

现在不再让 Surge 直接请求 Reddit。原因是 iPhone Surge 直接访问 Reddit RSS/JSON 时容易遇到 `403`、`429` 或网络限制，模块会运行但抓不到内容。

新的流程是：

1. GitHub Actions 每天定时抓取 Reddit RSS。
2. GitHub Actions 把结果写入仓库里的 `reddit-hot.json`。
3. iPhone Surge 只读取 GitHub Raw 上的 `reddit-hot.json`。
4. Surge 用本地通知推送新帖子。

这个项目不使用 Reddit API、不使用 Bark、不需要服务器、不生成 IPA。

## 文件说明

- `.github/workflows/update-reddit.yml`：GitHub Actions 定时任务，每天自动运行。
- `fetch-reddit.js`：运行在 GitHub Actions 的 Node.js 脚本，负责抓 Reddit RSS 并生成 `reddit-hot.json`。
- `reddit-hot.json`：静态数据文件，Surge 会读取它。
- `surge-push.js`：运行在 Surge Script 的脚本，只读取 GitHub Raw JSON 并发送本地通知。
- `RedditHotSurge.sgmodule`：Surge 模块文件。
- `README.md`：这份教程。

## GitHub Actions 做什么

GitHub Actions 会请求这些 Reddit RSS：

```text
https://www.reddit.com/r/technology/hot/.rss?limit=5
https://www.reddit.com/r/programming/hot/.rss?limit=5
https://www.reddit.com/r/ChatGPT/hot/.rss?limit=5
```

如果 `www.reddit.com` 失败，会自动尝试 `old.reddit.com`。

抓取成功后，它会更新：

```text
reddit-hot.json
```

如果 `reddit-hot.json` 有变化，GitHub Actions 会自动 commit 回仓库。

## 手动运行 GitHub Actions

1. 打开你的 GitHub 仓库。
2. 进入 `Actions` 页面。
3. 左侧选择 `Update Reddit Hot Posts`。
4. 点击 `Run workflow`。
5. 再点一次绿色的 `Run workflow` 确认。
6. 等运行结束后，回到仓库检查 `reddit-hot.json` 是否更新。

## 在 Surge 重新安装模块

iPhone Surge 里使用这个模块 Raw 链接：

```text
https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/RedditHotSurge.sgmodule
```

操作步骤：

1. 打开 iPhone Surge。
2. 进入模块管理。
3. 删除旧的 `Reddit Hot Daily` 模块。
4. 选择通过 URL 安装模块。
5. 粘贴上面的 Raw 链接。
6. 安装并启用模块。

新版 Surge 脚本只会请求 GitHub Raw，不会请求 `reddit.com`。

## 没有推送怎么办

先检查仓库里的 `reddit-hot.json` 是否已经更新。

如果 `reddit-hot.json` 没更新，说明 GitHub Actions 还没成功抓到 Reddit 数据。可以去 Actions 页面手动运行一次 workflow。

如果 GitHub Actions 抓取失败，常见原因是 Reddit 临时限流或网络问题。等下一次自动运行即可。

如果 `reddit-hot.json` 已经更新，但 Surge 没有通知，请检查：

- Surge 模块是否启用。
- iPhone 是否允许 Surge 发送通知。
- Surge 脚本日志里是否显示“当前没有新帖子”。

脚本会用 `$persistentStore` 记录已经推送过的帖子，避免重复推送。

# reddit-surge-push

这是一个适合 iPhone Surge 使用的 Reddit 热门帖定时推送模块。

它会定时抓取你指定 subreddit 的 Reddit hot 热门帖，合并后按分数排序，然后用 Surge 本地通知推送到 iPhone。

这个项目不需要 Reddit API、不需要 Bark、不需要服务器、不需要生成 IPA。GitHub 只用来存放脚本和模块文件，方便 iPhone Surge 通过 URL 安装和更新。

## 文件说明

- `reddit-hot-surge.js`：Surge Script 脚本，负责抓取 Reddit public JSON、过滤重复帖子、排序、发送本地通知。
- `RedditHotSurge.sgmodule`：Surge 模块文件，负责配置定时任务、参数和远程脚本 Raw 链接。
- `README.md`：当前这份 iPhone Surge 使用教程。

## 上传到 GitHub

1. 在 GitHub 创建一个仓库，例如：

```text
reddit-surge-push
```

2. 仓库必须设为 `Public`，否则 iPhone Surge 可能无法直接读取 Raw 链接。

3. 上传这 3 个文件到仓库根目录：

```text
reddit-hot-surge.js
RedditHotSurge.sgmodule
README.md
```

4. 当前模块里默认使用的脚本地址是：

```text
https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/reddit-hot-surge.js
```

如果你以后换成其他 GitHub 账号，请把链接里的 `ml4985658-design` 替换成你自己的 GitHub 用户名。

例如你的 GitHub 用户名是 `myname`，就改成：

```text
https://raw.githubusercontent.com/myname/reddit-surge-push/main/reddit-hot-surge.js
```

## 获取模块 Raw 链接

1. 打开 GitHub 仓库里的 `RedditHotSurge.sgmodule`。
2. 点击 `Raw`。
3. 复制浏览器地址栏里的链接。

链接格式大概是：

```text
https://raw.githubusercontent.com/你的用户名/reddit-surge-push/main/RedditHotSurge.sgmodule
```

## 在 iPhone Surge 里安装模块

1. 打开 iPhone 上的 Surge。
2. 进入模块管理。
3. 选择通过 URL 安装模块。
4. 粘贴 `RedditHotSurge.sgmodule` 的 Raw 链接。
5. 安装并启用模块 `Reddit Hot Daily`。

当前模块保留了测试用定时配置：

```text
cronexp="* * * * *"
```

这表示每分钟运行一次，方便你导入 iPhone Surge 后马上测试。

测试成功后，请把它改回每天早上 9 点运行：

```text
cronexp="0 9 * * *"
```

改完后记得重新上传 `RedditHotSurge.sgmodule` 到 GitHub，或者在 Surge 里刷新模块。

## 参数说明

模块默认参数是：

```text
SUBS=technology|programming|ChatGPT
LIMIT=10
TOP_N=5
MIN_SCORE=50
```

- `SUBS`：要抓的 subreddit，用 `|` 分隔。
- `LIMIT`：每个 subreddit 抓多少条 hot 帖。
- `TOP_N`：最终推送几条。
- `MIN_SCORE`：最低分数过滤，分数低于它的帖子不会推送。

想修改 subreddit，可以改成：

```text
SUBS=technology|programming|ChatGPT|OpenAI
```

## 常见问题

### 没通知

检查 iPhone 通知权限，确认 Surge 允许发送通知。

### 没运行

检查 Surge 模块是否已经启用，并确认当前 cron 是测试用的：

```text
cronexp="* * * * *"
```

### 找不到脚本

检查 `RedditHotSurge.sgmodule` 里的 `script-path` 是否是可访问的 GitHub Raw 链接。

默认是：

```text
script-path=https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/reddit-hot-surge.js
```

如果你以后换成其他 GitHub 账号，请把 `ml4985658-design` 换成你自己的 GitHub 用户名。

### HTTP 403 或 429

这通常是 Reddit 限流或当前网络访问 Reddit 不稳定导致的。

可以稍后再试，或者减少 `SUBS` 和 `LIMIT`。

### 重复推送

这说明 `$persistentStore` 没保存成功，或者你测试时清过 Surge 的脚本数据。

脚本最多保留 300 条已推送帖子 id，避免重复推送和无限增长。

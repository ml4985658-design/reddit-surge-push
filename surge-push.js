var JSON_URL = "https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/reddit-hot.json";
var STORE_KEY = "reddit_hot_surge_last_updated_at";
var TOP_N = 5;

$httpClient.get({
  url: JSON_URL,
  headers: {
    "Accept": "application/json,text/plain,*/*",
    "Cache-Control": "no-cache"
  }
}, function (error, response, data) {
  if (error) {
    console.log("[RedditHotSurge] 请求 reddit-hot.json 失败：" + error);
    $notification.post("Reddit Hot Daily 抓取失败", "无法读取 GitHub Raw JSON", String(error));
    $done();
    return;
  }

  var status = response && (response.status || response.statusCode);
  if (status && (status < 200 || status >= 300)) {
    console.log("[RedditHotSurge] reddit-hot.json HTTP " + status);
    $notification.post("Reddit Hot Daily 抓取失败", "GitHub Raw 返回 HTTP " + status, JSON_URL);
    $done();
    return;
  }

  try {
    var payload = JSON.parse(data);
    pushTopPosts(payload);
  } catch (parseError) {
    console.log("[RedditHotSurge] JSON 解析失败：" + parseError);
    $notification.post("Reddit Hot Daily 抓取失败", "reddit-hot.json 解析失败", String(parseError));
    $done();
  }
});

function pushTopPosts(payload) {
  payload = payload || {};
  var updatedAt = String(payload.updatedAt || "");
  var posts = Array.isArray(payload.posts) ? payload.posts : [];
  var topPosts = [];

  for (var i = 0; i < posts.length; i++) {
    var post = normalizePost(posts[i]);
    topPosts.push(post);
    if (topPosts.length >= TOP_N) {
      break;
    }
  }

  if (topPosts.length === 0) {
    console.log("[RedditHotSurge] reddit-hot.json 里 posts 为空，未推送。");
    $done();
    return;
  }

  if (updatedAt) {
    var lastUpdatedAt = $persistentStore.read(STORE_KEY);
    if (lastUpdatedAt === updatedAt) {
      console.log("[RedditHotSurge] updatedAt 未变化，今天这批帖子已推送过：" + updatedAt);
      $done();
      return;
    }
  }

  sendNotification(topPosts);
  saveLastUpdatedAt(updatedAt);
  $done();
}

function normalizePost(post) {
  post = post || {};
  return {
    subreddit: String(post.subreddit || "reddit"),
    title: String(post.title || "(无标题)"),
    url: String(post.url || JSON_URL)
  };
}

function saveLastUpdatedAt(updatedAt) {
  if (!updatedAt) {
    console.log("[RedditHotSurge] reddit-hot.json 没有 updatedAt，本次不保存推送批次。");
    return;
  }

  var ok = $persistentStore.write(updatedAt, STORE_KEY);
  if (!ok) {
    console.log("[RedditHotSurge] persistentStore 保存 updatedAt 失败，后续可能重复推送。");
  }
}

function sendNotification(posts) {
  var topPost = posts[0];
  var title = "Reddit 股票热门帖 · " + posts.length + " 条";
  var subtitle = "最新：r/" + topPost.subreddit;
  var body = posts.map(function (post, index) {
    return (index + 1) + ". r/" + post.subreddit + "\n" + post.title;
  }).join("\n\n");

  $notification.post(title, subtitle, body, {
    url: topPost.url
  });
  console.log("[RedditHotSurge] 已推送 " + posts.length + " 条 Reddit 股票热门帖。");
}

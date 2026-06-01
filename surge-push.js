var JSON_URL = "https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/reddit-hot.json";
var STORE_KEY = "reddit_hot_surge_seen_ids";
var MAX_HISTORY = 300;
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
    var posts = Array.isArray(payload.posts) ? payload.posts : [];
    pushNewPosts(posts);
  } catch (parseError) {
    console.log("[RedditHotSurge] JSON 解析失败：" + parseError);
    $notification.post("Reddit Hot Daily 抓取失败", "reddit-hot.json 解析失败", String(parseError));
    $done();
  }
});

function pushNewPosts(posts) {
  var seenIds = loadSeenIds();
  var seenMap = makeMap(seenIds);
  var freshPosts = [];

  for (var i = 0; i < posts.length; i++) {
    var post = normalizePost(posts[i]);
    if (!post.id || seenMap[post.id]) {
      continue;
    }
    freshPosts.push(post);
    if (freshPosts.length >= TOP_N) {
      break;
    }
  }

  if (freshPosts.length === 0) {
    console.log("[RedditHotSurge] 当前没有新帖子，未推送。");
    $done();
    return;
  }

  sendNotification(freshPosts);
  saveSeenIds(freshPosts, seenIds);
  $done();
}

function normalizePost(post) {
  post = post || {};
  return {
    id: String(post.id || post.url || ""),
    subreddit: String(post.subreddit || "reddit"),
    title: String(post.title || ""),
    url: String(post.url || JSON_URL)
  };
}

function loadSeenIds() {
  var raw = $persistentStore.read(STORE_KEY);
  if (!raw) {
    return [];
  }

  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch (error) {
    console.log("[RedditHotSurge] 读取历史记录失败：" + error);
    return [];
  }
}

function saveSeenIds(posts, oldIds) {
  var merged = [];
  var used = {};

  for (var i = 0; i < posts.length; i++) {
    addId(posts[i].id);
  }
  for (var j = 0; j < oldIds.length; j++) {
    addId(oldIds[j]);
  }

  var ok = $persistentStore.write(JSON.stringify(merged), STORE_KEY);
  if (!ok) {
    console.log("[RedditHotSurge] persistentStore 保存失败，后续可能重复推送。");
  }

  function addId(id) {
    if (!id || used[id] || merged.length >= MAX_HISTORY) {
      return;
    }
    used[id] = true;
    merged.push(id);
  }
}

function makeMap(list) {
  var map = {};
  for (var i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }
  return map;
}

function sendNotification(posts) {
  var topPost = posts[0];
  var title = "Reddit 今日热门帖 · " + posts.length + " 条";
  var subtitle = "最新：r/" + topPost.subreddit;
  var body = posts.map(function (post, index) {
    return (index + 1) + ". r/" + post.subreddit + "\n" + post.title;
  }).join("\n\n");

  $notification.post(title, subtitle, body, {
    url: topPost.url
  });
  console.log("[RedditHotSurge] 已推送 " + posts.length + " 条 Reddit 热门帖。");
}

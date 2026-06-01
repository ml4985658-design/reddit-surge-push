var DEFAULT_SUBS = "technology|programming|ChatGPT";
var DEFAULT_LIMIT = 10;
var DEFAULT_TOP_N = 5;
var DEFAULT_MIN_SCORE = 0;
var STORE_KEY = "reddit_hot_surge_seen_ids";
var MAX_HISTORY = 300;

var argText = typeof $argument === "undefined" ? "" : $argument;
var args = parseArguments(argText);
var subs = parseSubs(getArg("subs", "SUBS", DEFAULT_SUBS));
var limit = parsePositiveInt(getArg("limit", "LIMIT", DEFAULT_LIMIT), DEFAULT_LIMIT);
var topN = parsePositiveInt(getArg("topN", "TOP_N", DEFAULT_TOP_N), DEFAULT_TOP_N);
var minScore = parseMinScore(getArg("minScore", "MIN_SCORE", DEFAULT_MIN_SCORE), DEFAULT_MIN_SCORE);
var seenIds = loadSeenIds();
var seenMap = makeMap(seenIds);

fetchAllSubreddits(subs, function (errors, posts) {
  if (errors.length > 0) {
    notifyRequestFailure(errors);
  }

  var freshPosts = posts
    .filter(function (post) {
      return !seenMap[post.id];
    });

  var selectedPosts = freshPosts.slice(0, topN);

  if (selectedPosts.length === 0) {
    console.log("[RedditHotSurge] 当前没有新帖子，未推送。");
    $done();
    return;
  }

  sendRedditNotification(selectedPosts);
  saveSeenIds(selectedPosts, seenIds);
  $done();
});

function getArg(lowerKey, upperKey, fallback) {
  if (args[lowerKey] !== undefined && args[lowerKey] !== "") {
    return args[lowerKey];
  }
  if (args[upperKey] !== undefined && args[upperKey] !== "") {
    return args[upperKey];
  }
  return fallback;
}

function parseArguments(text) {
  var result = {};
  if (!text) {
    return result;
  }

  var pairs = String(text).split("&");
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    if (!pair) {
      continue;
    }

    var index = pair.indexOf("=");
    var key = index >= 0 ? pair.slice(0, index) : pair;
    var value = index >= 0 ? pair.slice(index + 1) : "";
    result[decodeValue(key)] = decodeValue(value);
  }
  return result;
}

function decodeValue(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, "%20"));
  } catch (error) {
    return String(value);
  }
}

function parseSubs(value) {
  var rawSubs = String(value || DEFAULT_SUBS).split("|");
  var result = [];
  var used = {};

  for (var i = 0; i < rawSubs.length; i++) {
    var sub = trim(rawSubs[i]).replace(/^\/?r\//i, "");
    if (sub && !used[sub.toLowerCase()]) {
      used[sub.toLowerCase()] = true;
      result.push(sub);
    }
  }

  return result.length > 0 ? result : DEFAULT_SUBS.split("|");
}

function parsePositiveInt(value, fallback) {
  var number = parseInt(value, 10);
  return isNaN(number) || number <= 0 ? fallback : number;
}

function parseMinScore(value, fallback) {
  var number = parseInt(value, 10);
  return isNaN(number) || number < 0 ? fallback : number;
}

function trim(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "");
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

function fetchAllSubreddits(list, callback) {
  var allPosts = [];
  var errors = [];
  var index = 0;

  function next() {
    if (index >= list.length) {
      callback(errors, allPosts);
      return;
    }

    var sub = list[index];
    index++;
    fetchSubredditHot(sub, limit, function (error, posts) {
      if (error) {
        errors.push(error);
      } else {
        allPosts = allPosts.concat(posts);
      }
      next();
    });
  }

  next();
}

function fetchSubredditHot(sub, postLimit, callback) {
  var encodedSub = encodeURIComponent(sub);
  var urls = [
    "https://www.reddit.com/r/" + encodedSub + "/hot/.rss?limit=" + postLimit,
    "https://old.reddit.com/r/" + encodedSub + "/hot/.rss?limit=" + postLimit
  ];
  var failures = [];
  var index = 0;

  function tryNextUrl() {
    if (index >= urls.length) {
      var message = "r/" + sub + " all endpoints failed: " + failures.join(" / ");
      console.log("[RedditHotSurge] " + message);
      callback(message, []);
      return;
    }

    var url = urls[index];
    index++;

    $httpClient.get({
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/rss+xml,application/xml,text/xml,*/*",
        "Accept-Language": "en-US,en;q=0.9"
      }
    }, function (error, response, data) {
      if (error) {
        failures.push("request error");
        console.log("[RedditHotSurge] r/" + sub + " 请求失败，尝试下一个 endpoint：" + error);
        tryNextUrl();
        return;
      }

      var status = response && (response.status || response.statusCode);
      if (status && (status < 200 || status >= 300)) {
        failures.push("HTTP " + status);
        console.log("[RedditHotSurge] r/" + sub + " HTTP " + status + "，尝试下一个 endpoint。");
        tryNextUrl();
        return;
      }

      try {
        callback(null, parseRedditRssPosts(sub, data));
      } catch (parseError) {
        failures.push("RSS parse failed");
        console.log("[RedditHotSurge] r/" + sub + " RSS 解析失败，尝试下一个 endpoint：" + parseError);
        tryNextUrl();
      }
    });
  }

  tryNextUrl();
}

function parseRedditRssPosts(fallbackSub, xml) {
  var blocks = extractXmlBlocks(xml, "entry").concat(extractXmlBlocks(xml, "item"));
  var posts = [];

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var title = getXmlText(block, "title");
    var link = getXmlLink(block);
    if (!title || !link) {
      continue;
    }

    posts.push({
      id: getXmlText(block, "id") || link,
      subreddit: getXmlSubreddit(block, fallbackSub, link),
      title: title,
      score: 0,
      comments: 0,
      url: link
    });
  }

  return posts;
}

function extractXmlBlocks(xml, tagName) {
  var blocks = [];
  var pattern = new RegExp("<" + tagName + "\\b[\\s\\S]*?<\\/" + tagName + ">", "gi");
  var match;

  while ((match = pattern.exec(String(xml || ""))) !== null) {
    blocks.push(match[0]);
  }

  return blocks;
}

function getXmlText(block, tagName) {
  var pattern = new RegExp("<" + tagName + "\\b[^>]*>([\\s\\S]*?)<\\/" + tagName + ">", "i");
  var match = pattern.exec(block);
  return match ? cleanXmlText(match[1]) : "";
}

function getXmlLink(block) {
  var atomLink = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atomLink && atomLink[1]) {
    return decodeXml(atomLink[1]);
  }

  return getXmlText(block, "link");
}

function getXmlSubreddit(block, fallbackSub, link) {
  var category = /<category\b[^>]*(?:term|label)=["'](?:r\/)?([^"']+)["']/i.exec(block);
  if (category && category[1]) {
    return cleanSubredditName(category[1], fallbackSub);
  }

  var linkMatch = /\/r\/([^\/?#]+)/i.exec(link || "");
  return linkMatch && linkMatch[1] ? cleanSubredditName(linkMatch[1], fallbackSub) : fallbackSub;
}

function cleanSubredditName(value, fallbackSub) {
  var name = trim(decodeXml(value)).replace(/^r\//i, "");
  var pathMatch = /\/r\/([^\/?#]+)/i.exec(name);
  if (pathMatch && pathMatch[1]) {
    name = pathMatch[1];
  }
  try {
    name = decodeURIComponent(name);
  } catch (error) {}
  return name || fallbackSub;
}

function cleanXmlText(value) {
  var text = String(value || "").replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
  return trim(decodeXml(text.replace(/<[^>]+>/g, "")));
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_, number) {
      return String.fromCharCode(parseInt(number, 10));
    })
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function sendRedditNotification(posts) {
  var topPost = posts[0];
  var title = "Reddit 今日热门帖 · " + posts.length + " 条";
  var subtitle = "最高：r/" + topPost.subreddit + " · 👍 " + topPost.score + " · 💬 " + topPost.comments;
  var body = posts.map(function (post, index) {
    return (index + 1) + ". r/" + post.subreddit + " · 👍 " + post.score + " · 💬 " + post.comments + "\n" + post.title;
  }).join("\n\n");

  $notification.post(title, subtitle, body, {
    url: topPost.url
  });
  console.log("[RedditHotSurge] 已推送 " + posts.length + " 条 Reddit 热门帖。");
}

function notifyRequestFailure(errors) {
  var title = "Reddit Hot Daily 请求失败";
  var subtitle = "有 " + errors.length + " 个 subreddit 抓取失败";
  var body = errors.slice(0, 5).join("\n");

  console.log("[RedditHotSurge] " + subtitle + "：" + body);
  $notification.post(title, subtitle, body);
}

var JSON_URL = "https://raw.githubusercontent.com/ml4985658-design/reddit-surge-push/main/reddit-hot.json";
var TOP_N = 5;

$httpClient.get({
      url: JSON_URL,
      headers: {
              "Accept": "application/json,text/plain,*/*",
              "Cache-Control": "no-cache"
            },
      timeout: 20
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
                        } catch (e) {
                          console.log("[RedditHotSurge] JSON 解析失败：" + e);
                          $notification.post("Reddit Hot Daily 抓取失败", "reddit-hot.json 解析失败", String(e));
                          $done();
                        }
    });

function pushTopPosts(payload) {
      payload = payload || {};
      var posts = Array.isArray(payload.posts) ? payload.posts : [];
      var topPosts = posts.slice(0, TOP_N);

  if (topPosts.length === 0) {
          console.log("[RedditHotSurge] reddit-hot.json 里 posts 为空。");
          $notification.post("Reddit Hot Daily", "没有可推送的帖子", "reddit-hot.json 里 posts 为空");
          $done();
          return;
        }

  var first = topPosts[0];
      var title = "Reddit 股票热门帖 · " + topPosts.length + " 条";
      var subtitle = "最新：r/" + (first.subreddit || "stocks");

  var body = topPosts.map(function (post, index) {
          return (index + 1) + ". r/" + (post.subreddit || "stocks") + "\n" + (post.title || "(无标题)");
        }).join("\n\n");

  var url = first.url || JSON_URL;

  $notification.post(title, subtitle, body, {
          url: url
        });

  console.log("[RedditHotSurge] 已推送 " + topPosts.length + " 条 Reddit 股票热门帖。");
      $done();
    }

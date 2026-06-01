const fs = require("node:fs/promises");

const SUBREDDITS = ["technology", "programming", "ChatGPT"];
const LIMIT_PER_SUB = 5;
const MAX_POSTS = 10;
const OUTPUT_FILE = "reddit-hot.json";
const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

main().catch((error) => {
  console.error("[fetch-reddit] failed:", error);
  process.exit(1);
});

async function main() {
  const allPosts = [];
  const errors = [];

  for (const sub of SUBREDDITS) {
    try {
      const posts = await fetchSubredditRss(sub, LIMIT_PER_SUB);
      allPosts.push(...posts);
      console.log(`[fetch-reddit] r/${sub}: ${posts.length} posts`);
    } catch (error) {
      errors.push(`r/${sub}: ${error.message || error}`);
      console.warn(`[fetch-reddit] r/${sub} failed:`, error.message || error);
    }
  }

  if (allPosts.length === 0) {
    throw new Error(`all subreddits failed: ${errors.join(" / ")}`);
  }

  const seen = new Set();
  const posts = [];
  for (const post of allPosts) {
    if (!post.id || seen.has(post.id)) {
      continue;
    }
    seen.add(post.id);
    posts.push(post);
    if (posts.length >= MAX_POSTS) {
      break;
    }
  }

  const data = {
    updatedAt: new Date().toISOString(),
    posts
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`[fetch-reddit] wrote ${posts.length} posts to ${OUTPUT_FILE}`);
}

async function fetchSubredditRss(sub, limit) {
  const encodedSub = encodeURIComponent(sub);
  const urls = [
    `https://www.reddit.com/r/${encodedSub}/hot/.rss?limit=${limit}`,
    `https://old.reddit.com/r/${encodedSub}/hot/.rss?limit=${limit}`
  ];
  const failures = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": SAFARI_UA,
          "Accept": "application/rss+xml,application/xml,text/xml,*/*",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });

      if (!response.ok) {
        failures.push(`HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const posts = parseRssPosts(sub, xml).slice(0, limit);
      if (posts.length === 0) {
        failures.push("empty RSS");
        continue;
      }
      return posts;
    } catch (error) {
      failures.push(error.message || String(error));
    }
  }

  throw new Error(failures.join(" / "));
}

function parseRssPosts(fallbackSub, xml) {
  const blocks = extractXmlBlocks(xml, "entry").concat(extractXmlBlocks(xml, "item"));
  const posts = [];

  for (const block of blocks) {
    const title = getXmlText(block, "title");
    const url = getXmlLink(block);
    const id = getXmlText(block, "id") || getXmlText(block, "guid") || url;

    if (!title || !url) {
      continue;
    }

    posts.push({
      id,
      subreddit: getSubredditFromLink(url, fallbackSub),
      title,
      url
    });
  }

  return posts;
}

function extractXmlBlocks(xml, tagName) {
  const blocks = [];
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, "gi");
  let match;

  while ((match = pattern.exec(String(xml || ""))) !== null) {
    blocks.push(match[0]);
  }

  return blocks;
}

function getXmlText(block, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = pattern.exec(block);
  return match ? cleanXmlText(match[1]) : "";
}

function getXmlLink(block) {
  const atomLink = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atomLink && atomLink[1]) {
    return decodeXml(atomLink[1]);
  }
  return getXmlText(block, "link");
}

function getSubredditFromLink(url, fallbackSub) {
  const match = /\/r\/([^\/?#]+)/i.exec(url || "");
  if (!match || !match[1]) {
    return fallbackSub;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch (error) {
    return match[1];
  }
}

function cleanXmlText(value) {
  const text = String(value || "").replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
  return decodeXml(text.replace(/<[^>]+>/g, "")).trim();
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(parseInt(number, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

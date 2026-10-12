"use strict";

const express = require("express");
const { createClient } = require("redis");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const leaderboardKey = process.env.REDIS_LEADERBOARD_KEY || "leaderboard:users";
const viewsKeyPrefix = process.env.REDIS_VIEWS_KEY_PREFIX || "post:views:";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (error) => {
  console.error("Redis client error:", error.message);
});

app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

function redisRequired(_req, res, next) {
  if (!redis.isReady) {
    return res.status(503).json({ error: "Redis is temporarily unavailable" });
  }
  next();
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

app.post("/posts/:postId/views", redisRequired, async (req, res, next) => {
  if (!validId(req.params.postId)) {
    return res.status(400).json({ error: "postId must be between 1 and 200 characters" });
  }

  try {
    const views = await redis.incr(`${viewsKeyPrefix}${req.params.postId}`);
    return res.status(200).json({ postId: req.params.postId, views });
  } catch (error) {
    next(error);
  }
});

app.post("/users/:userId/points", redisRequired, async (req, res, next) => {
  if (!validId(req.params.userId)) {
    return res.status(400).json({ error: "userId must be between 1 and 200 characters" });
  }
  const { points } = req.body || {};
  if (!Number.isSafeInteger(points) || points <= 0) {
    return res.status(400).json({ error: "points must be a positive integer" });
  }

  try {
    const score = await redis.zIncrBy(leaderboardKey, points, req.params.userId);
    return res.status(200).json({ userId: req.params.userId, score: Number(score) });
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard", redisRequired, async (_req, res, next) => {
  try {
    const rows = await redis.zRangeWithScores(leaderboardKey, 0, 9, { REV: true });
    const users = rows.map((row, index) => ({
      userId: row.value,
      score: Number(row.score),
      rank: index + 1,
    }));
    return res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard/:userId/rank", redisRequired, async (req, res, next) => {
  if (!validId(req.params.userId)) {
    return res.status(400).json({ error: "userId must be between 1 and 200 characters" });
  }

  try {
    const rank = await redis.zRevRank(leaderboardKey, req.params.userId);
    if (rank === null) {
      return res.status(404).json({ error: "User has no leaderboard score", userId: req.params.userId });
    }
    const score = await redis.zScore(leaderboardKey, req.params.userId);
    if (score === null) {
      return res.status(404).json({ error: "User has no leaderboard score", userId: req.params.userId });
    }
    return res.status(200).json({ userId: req.params.userId, score: Number(score), rank: rank + 1 });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  return res.status(404).json({ error: "Route not found" });
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }
  console.error("Request failed:", err.message);
  if (res.headersSent) return;
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 503;
  return res.status(status).json({
    error: status === 503 ? "Redis operation failed; please try again" : "Request could not be processed",
  });
});

async function start() {
  const server = app.listen(port, () => {
    console.log(`Leaderboard API listening on port ${port}`);
  });

  redis.connect().catch((error) => {
    console.error("Could not connect to Redis:", error.message);
    // node-redis reconnects automatically; requests receive 503 until it is ready.
  });

  const shutdown = async () => {
    server.close(async () => {
      if (redis.isOpen) await redis.quit().catch(() => {});
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();

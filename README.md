# Live Leaderboard with Redis

A small Redis-backed leaderboard with a browser frontend and JSON API. The frontend and backend are served together by the Node.js server.

## Features

- Shows the top 10 players and their scores, refreshed every five seconds.
- Adds positive integer points to a player's score.
- Looks up a player's current score and rank.
- Increments a post's view counter.
- Shows clear feedback for invalid input, missing users, and server errors.

## Run locally with Docker

Install Docker Desktop (with Docker Compose), then clone and start the app and Redis together:

```sh
git clone https://github.com/Amrittt22/live-leaderboard-using-redis.git
cd live-leaderboard-using-redis
docker compose up --build
```

Open <http://localhost:3000/>. The compose setup binds the app to your own computer only and keeps Redis data in a Docker volume. Stop the app with `Ctrl+C`; use `docker compose down` to stop and remove the containers while keeping stored Redis data.

If port `3000` is already in use, set a different host port before starting:

```powershell
$env:HOST_PORT = "3001"
docker compose up --build
```

On macOS or Linux, use `HOST_PORT=3001 docker compose up --build`.

## Run with Node.js and local Redis

Alternatively, install Node.js 18 or newer and Redis 6 or newer, then install the app dependencies:

```sh
npm install
```

Set these environment variables to override the defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `REDIS_LEADERBOARD_KEY` | `leaderboard:users` | Sorted set for user scores |
| `REDIS_VIEWS_KEY_PREFIX` | `post:views:` | Prefix for post view counters |

Start the app:

```sh
npm run dev
# or
npm start
```

By default the Node.js server listens on `127.0.0.1:3000`, so it is reachable only from the local computer. Ensure Redis is reachable at `REDIS_URL`. When Redis is unavailable, the web page can load, while API operations respond with `503 Service Unavailable`.

## API

All endpoints return JSON. IDs must be between 1 and 200 characters. Ranks are one-based. Users with equal scores are ordered by user ID in reverse lexicographic order, matching Redis `ZREVRANGE` and `ZREVRANK`.

### Increment a post's views

`POST /posts/:postId/views` increments the counter by one using Redis `INCR`.

```sh
curl -X POST http://localhost:3000/posts/article-42/views
```

```json
{ "postId": "article-42", "views": 1 }
```

### Add points

`POST /users/:userId/points` accepts a positive safe integer in the `points` JSON field and adds it using `ZINCRBY`.

```sh
curl -X POST http://localhost:3000/users/alex/points \
  -H 'Content-Type: application/json' \
  -d '{"points":25}'
```

```json
{ "userId": "alex", "score": 25 }
```

### Top 10

`GET /leaderboard` returns up to 10 users with their score and rank.

```sh
curl http://localhost:3000/leaderboard
```

```json
{
  "users": [
    { "userId": "alex", "score": 25, "rank": 1 },
    { "userId": "sam", "score": 18, "rank": 2 }
  ]
}
```

### A user's rank

`GET /leaderboard/:userId/rank` returns the user's score and rank, or `404 Not Found` if the user has no score.

```sh
curl http://localhost:3000/leaderboard/alex/rank
```

```json
{ "userId": "alex", "score": 25, "rank": 1 }
```

### Error responses

- `400 Bad Request`: malformed JSON or invalid input.
- `404 Not Found`: user has no leaderboard score, or route does not exist.
- `413 Payload Too Large`: JSON request body exceeds 16 KB.
- `503 Service Unavailable`: Redis is disconnected or a Redis command failed.

## Project layout

```text
backend/server.js   Express API and static file server
frontend/           Browser page, styles, and client-side behavior
package.json        Project scripts and dependencies
```

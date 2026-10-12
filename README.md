# Live Leaderboard with Redis

A local leaderboard app built with Node.js, Express, and Redis. It includes a browser frontend and a JSON API served from the same server. Docker Compose can start the app and Redis together, so a clone can run without installing Node.js or Redis directly on the host.

## What the project does

- Displays the top 10 users, their scores, and their ranks.
- Refreshes the leaderboard automatically every five seconds, with a manual refresh button.
- Adds a positive integer number of points to a user.
- Looks up an individual user's score and rank.
- Increments a post's view counter by one.
- Shows validation and API errors in the frontend.

## Run locally with Docker (recommended)

Install Docker Desktop, which includes Docker Compose. Then clone the repository and start the app:

```sh
git clone https://github.com/Amrittt22/live-leaderboard-using-redis.git
cd live-leaderboard-using-redis
docker compose up --build
```

Open <http://localhost:3000/>. The API is available at the same address. The Compose configuration binds the app to `127.0.0.1`, so it is available on the local computer only. Redis data is stored in a named Docker volume and survives container restarts.

To run it in the background, use `docker compose up --build -d`. Stop the containers with `docker compose down`; this keeps the Redis data volume. To erase the saved leaderboard and view counters too, run `docker compose down -v`.

If port `3000` is already in use, select another local port:

```powershell
$env:HOST_PORT = "3001"
docker compose up --build
```

On macOS or Linux:

```sh
HOST_PORT=3001 docker compose up --build
```

Then open <http://localhost:3001/>.

## Run with Node.js and Redis

As an alternative to Docker, install Node.js 18 or newer and Redis 6 or newer. Start Redis, then from the project folder run:

```sh
npm install
npm run dev
```

Alternatively, start the same server with `npm start`. The frontend is at <http://localhost:3000/>. By default, the Node server listens on `127.0.0.1`, limiting access to the local computer. Redis must be reachable at `REDIS_URL` for API requests to work.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Address the Node server listens on. Docker sets this to `0.0.0.0` inside its private network. |
| `PORT` | `3000` | HTTP server port. Must be between 1 and 65535. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL. |
| `REDIS_LEADERBOARD_KEY` | `leaderboard:users` | Redis sorted-set key for user scores. |
| `REDIS_VIEWS_KEY_PREFIX` | `post:views:` | Prefix for individual post view counter keys. |

For PowerShell, set an environment variable for the current terminal session like this:

```powershell
$env:REDIS_URL = "redis://localhost:6379"
npm run dev
```

If Redis is disconnected, the frontend still loads, but API requests return `503 Service Unavailable` until Redis is available again.

## How scores and views are stored

- User scores are members of one Redis sorted set. `ZINCRBY` adds points to a user's score; `ZREVRANGE` reads the top 10; and `ZREVRANK` looks up a user's rank.
- Each post has its own integer key: `post:views:<postId>`. `INCR` adds one view per request.
- Ranks start at 1. Equal scores are ordered by user ID in reverse lexicographic order, matching Redis `ZREVRANGE` and `ZREVRANK`. Tied users occupy consecutive sorted-set positions.

## API reference

All endpoints return JSON. IDs must contain 1 to 200 characters. Point values must be positive safe integers. Request bodies are limited to 16 KB.

### Increment a post's views

`POST /posts/:postId/views` increments the view counter by one.

```sh
curl -X POST http://localhost:3000/posts/article-42/views
```

```json
{ "postId": "article-42", "views": 1 }
```

### Add points to a user

`POST /users/:userId/points` requires a JSON body with a positive integer `points` field.

```sh
curl -X POST http://localhost:3000/users/alex/points -H 'Content-Type: application/json' -d '{"points":25}'
```

```json
{ "userId": "alex", "score": 25 }
```

### Get the top 10 users

`GET /leaderboard` returns up to 10 users, with score and one-based rank.

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

An empty sorted set returns `{ "users": [] }`.

### Look up one user's rank

`GET /leaderboard/:userId/rank` returns the current score and one-based rank. It returns `404` if the user is not in the leaderboard.

```sh
curl http://localhost:3000/leaderboard/alex/rank
```

```json
{ "userId": "alex", "score": 25, "rank": 1 }
```

## Status codes and errors

| Status | Meaning |
| --- | --- |
| `200 OK` | Request succeeded. |
| `400 Bad Request` | Invalid ID or points, or malformed JSON. |
| `404 Not Found` | User has no leaderboard score, or the route does not exist. |
| `413 Payload Too Large` | JSON request body exceeds 16 KB. |
| `503 Service Unavailable` | Redis is unavailable or a Redis operation failed. |

## Project structure

```text
backend/server.js   Express server, Redis connection, and API routes
frontend/index.html Browser interface
frontend/app.js     Fetch requests, form handling, and leaderboard refresh
frontend/styles.css Page styles and responsive layout
Dockerfile          Node app image
compose.yaml        Local app and Redis services
package.json        Node scripts and dependencies
```

This is intended as a local demo. The write endpoints do not require authentication, so keep it bound to localhost unless you add access controls before exposing it to other machines.

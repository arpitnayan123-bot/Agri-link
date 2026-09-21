# AgriLink Bharat — realtime mini-service (prototype-grade image)
# socket.io gateway :3003 (dashboard clients) + internal POST /emit :3004 (API fan-out)
FROM oven/bun:1

WORKDIR /app

COPY package.json index.ts ./
RUN bun install

EXPOSE 3003 3004

CMD ["bun", "run", "index.ts"]

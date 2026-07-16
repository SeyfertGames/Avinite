import { Elysia } from "elysia";
import { avatarsRoute } from "./routes/avatars";
import { discordReviewBot } from "./bot/discord";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "127.0.0.1";

const app = new Elysia()
  .use(avatarsRoute)
  .get("/", () => ({ status: "ok", version: "1.0.0" }))
  .listen({ port, hostname: host });

void discordReviewBot.start();

console.log(`Avinite Started`);
console.log(`WebSocket endpoint: ws://${host}:${port}/ws/avatars`);

export type App = typeof app;

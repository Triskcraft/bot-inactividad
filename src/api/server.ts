import Express from "express";
import cors from "cors";
import { readFile } from "fs/promises";
import { envs } from "../config.js";
import { client } from "../client.js"
import { db } from "../prisma/database.js";
import type { GuildMember } from "discord.js";
import type { Link } from "../prisma/generated/client.js";
import { getMembers } from "./members/get.js";

const app = Express();

app.use(Express.json());
app.use(
    cors({
        origin: process.env.FRONT_ORIGIN,
    })
);

app.get("/members", getMembers);

// app.get("/rt", async (req, res) => {
//     const session = await createSession(req, res);

//     const interval = setInterval(async () => {
//         session.push(await requestSerial("get_temp"));
//     }, 1_000);

//     session.once("disconnected", () => {
//         clearInterval(interval);
//     });
// });
export { app }


import postgres from "postgres";
import { assertConfig } from "./config";

assertConfig();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  // Keep it conservative; serverless-ish environments can open many connections.
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});


export default sql;

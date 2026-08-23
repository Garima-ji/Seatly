import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend/.env') });

async function test() {
  console.log("Testing connection with URL:", process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log("✅ Success! Connection established successfully.");
    await client.end();
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}
test();

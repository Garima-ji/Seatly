import { PGlite } from '@electric-sql/pglite';
import path from 'path';

async function test() {
  const db = new PGlite(path.join(process.cwd(), 'local_db'));
  await db.exec('CREATE TABLE IF NOT EXISTS test_tbl(id serial primary key, name text);');
  await db.query('INSERT INTO test_tbl(name) VALUES($1)', ['Hello PGlite']);
  const res = await db.query('SELECT * FROM test_tbl');
  console.log('PGlite working perfectly!', res.rows);
}
test().catch(console.error);

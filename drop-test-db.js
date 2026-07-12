const { MongoClient } = require('./server/node_modules/mongodb');

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGO_URL not set');

  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to tollsync');

  await client.db('test').dropDatabase();
  console.log('Dropped "test" database');

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });

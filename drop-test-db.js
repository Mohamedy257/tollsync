require('dotenv').config({ path: './server/.env' });
const mongoose = require('./server/node_modules/mongoose');

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGO_URL not set');

  // Connect to the test database specifically to drop it
  const base = uri.replace(/\/[^/?]+(\?|$)/, '/test$1');
  await mongoose.connect(base);
  console.log('Connected');

  await mongoose.connection.db.dropDatabase();
  console.log('Dropped "test" database');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

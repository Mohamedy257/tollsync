const mongoose = require('mongoose');

// Normalize all documents: expose id (string) instead of _id, remove __v
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

async function connectDB() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URL;
  if (!uri) throw new Error('MONGO_URL environment variable is not set');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });
  console.log('✅ MongoDB connected');
}

module.exports = { connectDB };

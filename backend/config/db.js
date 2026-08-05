const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Create a backend/.env file from .env.example and set MONGO_URI to your MongoDB connection string.');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Connection Pooling — keeps a pool of connections alive to avoid
      // the latency of opening a new TCP connection for every request
      maxPoolSize: 10,
      minPoolSize: 2,
      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
};

module.exports = connectDB;

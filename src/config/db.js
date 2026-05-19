const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  mongoose.set('strictQuery', true);
  connectionPromise = mongoose.connect(uri).then((conn) => {
    console.log('MongoDB connected');
    return conn;
  });

  return connectionPromise;
}

module.exports = { connectDB };

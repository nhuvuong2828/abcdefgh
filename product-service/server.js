// product-service/server.js
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import productRoutes from './src/routes/productRoutes.js';

dotenv.config();

const app = express();

app.use((req, res, next) => {
    console.log(`[Product Service] Received request for: ${req.originalUrl}`);
    next();
});

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB for Product Service'))
    .catch((err) => console.error('Could not connect to MongoDB', err));

app.use(express.json());

app.use('/', productRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Product Service is running on http://localhost:${PORT}`);
});
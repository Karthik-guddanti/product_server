require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Product = require('./models/Product');
// const initialProducts = require('./Productdata');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parse');
const upload = multer();
const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true
})
.then(() => console.log('✅ MongoDB Atlas connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const authorize = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or missing API Key.' });
  }
  next();
};

// CRUD routes
app.post('/api/products', authorize, async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ message: 'Error creating product', error: err.message });
  }
});

// CSV upload route
app.post('/api/products/upload', authorize, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  const results = [];
  const parser = csv.parse({ columns: true, trim: true });
  parser.on('readable', () => {
    let record;
    while ((record = parser.read())) {
      results.push(record);
    }
  });
  parser.on('error', err => {
    return res.status(400).json({ message: 'CSV parse error', error: err.message });
  });
  parser.on('end', async () => {
    try {
      // Validate and insert products
      const validProducts = results.filter(p =>
        p.name && p.price && p.stock !== undefined && p.category
      );
      const inserted = await Product.insertMany(validProducts);
      res.status(201).json({ message: 'Products uploaded', count: inserted.length });
    } catch (err) {
      res.status(500).json({ message: 'Error saving products', error: err.message });
    }
  });
  parser.write(req.file.buffer);
  parser.end();
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching products', error: err.message });
  }
});

app.put('/api/products/:id', authorize, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: 'Error updating product', error: err.message });
  }
});

app.delete('/api/products/:id', authorize, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Error deleting product', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
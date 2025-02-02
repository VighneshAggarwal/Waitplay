const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const QRCode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');
dotenv.config();

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

app.use(express.json());

const server = http.createServer(app);

// Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// MongoDB Connection
mongoose
  .connect('mongodb+srv://Waitplay:Waitplay@cluster0.u4tx7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Schemas and Models
const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  detailedDescription: String,
  image: String,
  isVeg: Boolean,
  price: Number,
  halfPrice: Number,
  fullPrice: Number,
  specialItems: [String],
  category: String,
  type: String,
});

const Product = mongoose.model('Product', productSchema);

const cartSchema = new mongoose.Schema({
  cartId: { type: String, unique: true, required: true },
  createdBy: { type: String, required: true },
  users: [{ type: String }],
  items: [
    {
      itemName: String,
      quantity: Number,
      addedBy: String,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const Cart = mongoose.model('Cart', cartSchema);

// Middleware for Logging
app.use((req, res, next) => {
  console.log(`Received ${req.method} request at ${req.url}`);
  console.log('Request Params:', req.params);
  console.log('Request Body:', req.body);
  next();
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-cart', (cartId) => {
    socket.join(cartId);
    console.log(`User joined cart room: ${cartId}`);
  });

  socket.on('update-cart', async (data) => {
    const { cartId, item } = data;

    try {
      const cart = await Cart.findOne({ cartId });
      if (!cart) {
        console.error('Cart not found:', cartId);
        return;
      }

      const existingItem = cart.items.find((i) => i.itemName === item.itemName);
      if (existingItem) {
        existingItem.quantity = item.quantity;
      } else {
        cart.items.push(item);
      }

      await cart.save();
      io.to(cartId).emit('cart-updated', cart);
    } catch (error) {
      console.error('Error updating cart:', error);
      socket.emit('error', { message: 'Failed to update cart', error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.get('/products', async (req, res) => {
  try {
    const { type, category } = req.query;
    let filter = {};

    if (type && type !== 'all') filter.type = type.toLowerCase();
    if (category && category !== 'all') filter.category = category.toLowerCase();

    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
});

app.get('/categories', async (req, res) => {
  try {
    const { type } = req.query;
    let filter = {};

    if (type && type !== 'all') filter.type = type.toLowerCase();

    const categories = await Product.distinct('category', filter);
    res.json(categories);
  } catch (err) {
    res.status(500).send('Server error: ' + err.message);
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const results = await Product.find({ title: { $regex: query, $options: 'i' } });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching search results', error: error.message });
  }
});

app.post('/create-cart', async (req, res) => {
  try {
    const { userId } = req.body;
    const cartId = crypto.randomBytes(4).toString('hex');

    const newCart = new Cart({
      cartId,
      createdBy: userId,
      users: [userId],
    });

    await newCart.save();

    const qrCode = await QRCode.toDataURL(cartId);
    res.status(201).json({ cartId, qrCode });
  } catch (error) {
    res.status(500).json({ message: 'Error creating cart', error: error.message });
  }
});

app.post('/join-cart', async (req, res) => {
  try {
    const { cartId, userId } = req.body;

    const cart = await Cart.findOne({ cartId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    if (!cart.users.includes(userId)) {
      cart.users.push(userId);
      await cart.save();
    }

    io.to(cartId).emit('cart-updated', cart);
    res.status(200).json({ message: 'Successfully joined the cart', cartId });
  } catch (error) {
    res.status(500).json({ message: 'Error joining cart', error: error.message });
  }
});

app.post('/cart/:cartId/add-item', async (req, res) => {
  const { cartId } = req.params;
  if (!cartId) {
    return res.status(400).json({ message: 'Cart ID is required.' });
  }

  try {
    const { itemName, quantity, addedBy } = req.body;

    const cart = await Cart.findOne({ cartId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const existingItem = cart.items.find((item) => item.itemName === itemName);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ itemName, quantity, addedBy });
    }

    await cart.save();
    io.to(cartId).emit('cart-updated', cart);
    res.status(200).json({ message: 'Item added to cart', cart });
  } catch (error) {
    res.status(500).json({ message: 'Error adding item to cart', error: error.message });
  }
});

app.get('/cart/:cartId', async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findOne({ cartId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
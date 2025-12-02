require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Server start and DB sync
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    // Sync models and create tables if they don't exist
    await sequelize.sync(); 
    console.log('DB connected & synced successfully.');
  } catch (err) {
    console.error('DB sync failed:', err);
    // In a real app, you might exit here if DB connection is critical
  }
});
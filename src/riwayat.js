require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to API for HISTORY and MESSAGE",
    version: "1.0.0",
  });
});

// Database setup with Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

// Define History model
const History = sequelize.define("History", {
  email: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'HISTORY',
  timestamps: false,
});

// Define Message model
const Message = sequelize.define("Message", {
  message_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_speech_to_text: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
}, {
  tableName: 'MESSAGE',
  timestamps: false,
});

// Relations
Message.belongsTo(History, { foreignKey: 'email' });

// Route: POST /api/history/email
app.post("/api/history/email", async (req, res) => {
  try {
    const { email, title } = req.body;

    if (!email || !title) {
      return res.status(400).json({ message: "Email dan title harus diisi" });
    }

    const existingHistory = await History.findOne({ where: { email } });
    if (existingHistory) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const id = uuidv4();
    await History.create({
      email,
      id,
      title,
    });

    res.status(201).json({
      message: "Data History berhasil dibuat",
      data: { email, id, title },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route: POST /api/history/:email
app.post("/api/history/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { message, is_speech_to_text } = req.body;

    if (!message || is_speech_to_text === undefined) {
      return res.status(400).json({ message: "Message dan is_speech_to_text harus diisi" });
    }

    const existingHistory = await History.findOne({ where: { email } });
    if (!existingHistory) {
      return res.status(404).json({ message: `History dengan email ${email} tidak ditemukan` });
    }

    const message_id = uuidv4();
    const created_at = new Date();
    await Message.create({
      message_id,
      email,
      message,
      created_at,
      is_speech_to_text,
    });

    res.status(201).json({
      message: "Data Message berhasil dibuat",
      data: { message_id, email, message, created_at, is_speech_to_text },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route: GET /api/data/:email
app.get("/api/history/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const history = await History.findOne({ where: { email } });
    if (!history) {
      return res.status(404).json({ message: `History dengan email ${email} tidak ditemukan` });
    }

    const messages = await Message.findAll({ where: { email } });

    res.json({
      message: "Data ditemukan",
      data: {
        history,
        messages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route: DELETE /api/history/:email
app.delete("/api/history/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const history = await History.findOne({ where: { email } });
    if (!history) {
      return res.status(404).json({ message: `History dengan email ${email} tidak ditemukan` });
    }

    await Message.destroy({ where: { email } });
    await History.destroy({ where: { email } });

    res.json({ message: `History dan message dengan email ${email} telah dihapus` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: "Internal server error", error: err.message });
});

// Server & Database Initialization
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully");
    await sequelize.sync({ alter: true });

    app.listen(PORT, () => {
      console.log(`Server berjalan di port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
  }
})();
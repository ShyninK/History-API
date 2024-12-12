require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const cors = require("cors");

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Capstone API",
    version: "1.0.0",
    endpoints: {
      soundboards: "/api/soundboards",
      history: "/api/history",
      profile: "/api/profile",
      feedback: "/api/feedback",
    },
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    success: true,
    timestamp: new Date(),
    uptime: process.uptime(),
    status: "healthy",
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
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 60000,
    },
  }
);

const History = sequelize.define(
  "History",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_speech_to_text: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "history",
    timestamps: false, // Disable Sequelize's default timestamps
  }
);

// History Routes
// Method untuk hanya menambahkan title dan email
app.post("/api/history/email", async (req, res, next) => {
  try {
    const { title, email } = req.body;

    // Validasi input
    if (!title || !email) {
      return res.status(400).json({
        status: "error",
        message: "Title dan email harus diisi",
      });
    }

    // Cek apakah email sudah ada
    const existingEntry = await sequelize.query(
      "SELECT * FROM history WHERE email = ?",
      {
        replacements: [email],
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (existingEntry.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Email sudah terdaftar",
      });
    }

    const id = uuidv4(); // Generate unique ID
    const createdAt = new Date();

    // Query untuk memasukkan data ke dalam tabel history
    const [result] = await sequelize.query(
      "INSERT INTO history (id, title, message, created_at, email, is_speech_to_text) VALUES (?, ?, ?, ?, ?, ?)",
      {
        replacements: [id, title, null, createdAt, email, null],
        type: Sequelize.QueryTypes.INSERT,
      }
    );

    res.status(201).json({
      status: "success create data",
      data: {
        id,
        title,
        message: null,
        created_at: createdAt,
        email,
        is_speech_to_text: null,
      },
    });
  } catch (error) {
    next(error);
  }
});


// Method untuk menambahkan data lainnya berdasarkan email yang telah ada
app.post("/api/history/:email", async (req, res, next) => {
  try {
    const { email } = req.params;
    const { message, is_speech_to_text } = req.body;

    // Validasi input
    if (!message || is_speech_to_text === undefined) {
      return res.status(400).json({
        status: "error",
        message: "Message dan is_speech_to_text harus diisi",
      });
    }

    // Mengecek apakah email sudah ada
    const existingHistory = await History.findOne({ where: { email } });

    const createdAt = new Date();

    if (existingHistory) {
      // Jika data dengan email yang sama sudah ada, update hanya message, is_speech_to_text, dan created_at
      existingHistory.message = message;
      existingHistory.is_speech_to_text = is_speech_to_text;
      existingHistory.created_at = createdAt;

      await existingHistory.save(); // Menyimpan perubahan

      res.status(200).json({
        status: "success update data",
        data: existingHistory,
      });
    } else {
      // Jika tidak ada, memberikan response error
      return res.status(404).json({
        status: "error",
        message: `Tidak ditemukan history dengan email ${email}`,
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST route for history
app.get("/api/history", async (req, res, next) => {
  try {
    const histories = await sequelize.query(
      "SELECT * FROM history ORDER BY created_at DESC",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (histories.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "History tidak ditemukan",
      });
    }

    const formattedHistories = histories.map((history) => ({
      id: history.id,
      email: history.email,
      title: history.title,
      message: [
        {
          text: history.message,
          created_at: history.created_at,
          is_speech_to_text: history.is_speech_to_text,
        },
      ],
      detection_type: history.is_speech_to_text
        ? "Speech to Text"
        : "Gesture Detection",
    }));

    res.json({
      status: "success get data",
      data: formattedHistories,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Something went wrong",
    });
  }
});

// GET route for history by email
app.get("/api/history/:email", async (req, res, next) => {
  try {
    const { email } = req.params;

    console.log("Searching for history with Email:", email); // Logging Email

    const histories = await History.findAll({ where: { email } });

    if (histories.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `History untuk email ${email} tidak ditemukan`,
      });
    }

    const formattedHistories = histories.map((history) => ({
      email: history.email,
      id: history.id,
      title: history.title,
      message: [
        {
          text: history.message,
          created_at: history.created_at,
          is_speech_to_text: history.is_speech_to_text,
        },
      ],
      detection_type: history.is_speech_to_text
        ? "Speech to Text"
        : "Gesture Detection",
    }));

    res.json({
      status: "success get data",
      data: formattedHistories,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE route for history by email
app.delete("/api/history/:email", async (req, res, next) => {
  try {
    const { email } = req.params;

    // Mencari data berdasarkan email
    const histories = await History.findAll({ where: { email } });

    if (histories.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `History untuk email ${email} tidak ditemukan`,
      });
    }

    // Menghapus semua data dengan email yang sesuai
    await History.destroy({ where: { email } });

    res.json({
      status: "success",
      message: `History dengan Email ${email} telah dihapus`,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE route for history
app.delete("/api/history/:email", async (req, res, next) => {
  try {
    const { email } = req.params;

    // Mencari data berdasarkan email
    const history = await History.findByPk(email);

    if (!history) {
      return res.status(404).json({
        status: "error",
        message: "History tidak ditemukan",
      });
    }

    // Menghapus data
    await history.destroy();

    res.json({
      status: "success",
      message: `History dengan Email ${email} telah dihapus`,
    });
  } catch (error) {
    next(error);
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      status: "error",
      message: "File upload error",
      error: err.message,
    });
  }

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({
      status: "error",
      message: "Validation error",
      errors: err.errors.map((e) => e.message),
    });
  }

  res.status(500).json({
    status: "error",
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// Server & Database Initialization
const PORT = process.env.PORT || 8080;

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully");

    await sequelize.sync();
    console.log("Database synced successfully");

    app.listen(PORT, () => {
      console.log(`Server berjalan di port ${PORT}`);
      console.log(`Test API at: http://localhost:${PORT}`);
      console.log("\nAvailable routes:");
      console.log("- POST   /api/history");
      console.log("- GET    /api/history");
      console.log("- GET    /api/history/:email");
      console.log("- DELETE /api/history/:email");
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
};

start();
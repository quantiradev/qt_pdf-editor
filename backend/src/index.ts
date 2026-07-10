import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration (allow requests from Next.js dev server with credentials)
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://qt-pdf-editor.vercel.app",
    ],
    credentials: true,
  })
);

// Register routes
app.use("/api/auth", authRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.listen(PORT, () => {
  console.log(`[server]: Backend server is running at http://localhost:${PORT}`);
});

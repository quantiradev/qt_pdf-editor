import { Router } from "express";
import { createUser, getUserByEmail, verifyPassword } from "../db.js";
import { sign, verify } from "../jwt.js";

const router = Router();

// POST /register
router.post("/register", (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long" });
      return;
    }

    const existingUser = getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ error: "User already exists with this email" });
      return;
    }

    const user = createUser(name, email, password);
    const token = sign({ userId: user.id, email: user.email, name: user.name });

    res.cookie("qt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
      path: "/",
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

// POST /login
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = sign({ userId: user.id, email: user.email, name: user.name });

    res.cookie("qt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
      path: "/",
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

// POST /logout
router.post("/logout", (req, res) => {
  try {
    res.clearCookie("qt_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error during logout" });
  }
});

// GET /me
router.get("/me", (req, res) => {
  try {
    const token = req.cookies?.qt_token;

    if (!token) {
      res.json({ loggedIn: false });
      return;
    }

    const payload = verify(token);
    if (!payload) {
      res.json({ loggedIn: false });
      return;
    }

    res.json({
      loggedIn: true,
      user: {
        email: payload.email,
        name: payload.name,
      },
    });
  } catch (error) {
    console.error("Session verification error:", error);
    res.json({ loggedIn: false });
  }
});

export default router;

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/routes.js";
dotenv.config();
const app = express();
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.BETTER_AUTH_URL,
    "http://localhost:3000",
].filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server requests, mobile apps, curl, etc.
        if (!origin)
            return callback(null, true);
        // Check configured origins
        if (allowedOrigins.some((allowed) => origin === allowed || origin === allowed.replace(/\/$/, ""))) {
            return callback(null, true);
        }
        // Allow any Vercel deployment domain (*.vercel.app)
        if (origin.endsWith(".vercel.app") && origin.startsWith("https://")) {
            return callback(null, true);
        }
        // Allow local development ports
        if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
}));
app.use(express.json());
// Health check endpoint
app.get(["/health", "/api/health"], (_req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
// Welcome / API root endpoint
app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "Welcome to Alumni directory api",
    });
});
app.use("/api", router);
// Centralized error handler
app.use((err, _req, res, _next) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ success: false, message });
});
export default app;

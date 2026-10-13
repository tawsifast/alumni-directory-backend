import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/routes.js";
dotenv.config();
const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());
// Health check endpoint
app.get("/health", (_req, res) => {
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

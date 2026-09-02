import cors from "cors";
import express from "express";

import { HttpError } from "./_lib/http-error";
import { booksRouter } from "./routes/books";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CORS_ORIGIN,
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/books", booksRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, "Route not found"));
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const isHttp = err instanceof HttpError;
    const status = isHttp ? err.status : 500;
    const message = isHttp
      ? err.message
      : err instanceof Error
        ? err.message
        : "Internal server error";

    if (!isHttp) {
      console.error("Unhandled API error:", err);
    }

    const payload: { error: string; details?: string } = { error: message };
    if (!isHttp && process.env.NODE_ENV !== "production" && err instanceof Error) {
      payload.details = err.stack;
    }

    res.status(status).json(payload);
  }
);

app.listen(PORT, () => {
  console.log(`\nServer is running on: http://localhost:${PORT}`);
});

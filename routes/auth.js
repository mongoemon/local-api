import express from "express";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

function getBearerToken(req) {
  const authorization = req.get("authorization");
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  const headerToken = req.get("x-access-token");
  return typeof headerToken === "string" ? headerToken.trim() : "";
}

export function createAuthRouter(config) {
  const router = express.Router();
  const jwtSecret = config.auth.jwtSecret;

  router.get("/prep", (req, res) => {
    const prefix = typeof req.query.prefix === "string" && req.query.prefix.trim()
      ? req.query.prefix.trim()
      : "prep";
    const timestamp = Date.now();
    const token = config.auth.bearerToken;

    res.json({
      message: "preprocessor seed generated",
      requestId: `${prefix}-${randomUUID()}`,
      token,
      authorizationHeader: `Bearer ${token}`,
      timestamp,
      isoTime: new Date(timestamp).toISOString(),
      nextEndpoint: "/protected"
    });
  });

  router.get("/protected", (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "missing_token",
        message: "Send Authorization: Bearer <token> or x-access-token header"
      });
    }

    if (token !== config.auth.bearerToken) {
      return res.status(403).json({
        error: "invalid_token",
        message: "Token is not valid for this environment"
      });
    }

    res.json({
      message: "protected resource access granted",
      authenticated: true,
      tokenSource: req.get("authorization") ? "authorization" : "x-access-token"
    });
  });

  router.post("/auth/login", (req, res) => {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({
        error: "missing_credentials",
        message: "Send username and password in request body"
      });
    }

    if (username !== "demo" || password !== "password") {
      return res.status(401).json({
        error: "invalid_credentials",
        message: "Invalid username or password"
      });
    }

    const token = jwt.sign(
      {
        userId: "user-123",
        username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      },
      jwtSecret
    );

    res.json({
      message: "login successful",
      authenticated: true,
      token,
      tokenType: "Bearer",
      expiresIn: "24 hours",
      user: { userId: "user-123", username }
    });
  });

  router.post("/auth/verify", (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "missing_token",
        message: "Send Authorization: Bearer <token> or x-access-token header"
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      res.json({
        message: "token is valid",
        valid: true,
        decoded: {
          userId: decoded.userId,
          username: decoded.username,
          iat: new Date(decoded.iat * 1000).toISOString(),
          exp: new Date(decoded.exp * 1000).toISOString()
        }
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "token_expired",
          message: "Token has expired",
          expiredAt: error.expiredAt
        });
      }
      res.status(403).json({
        error: "invalid_token",
        message: "Token is not valid"
      });
    }
  });

  return router;
}

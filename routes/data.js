import express from "express";

export function createDataRouter() {
  const router = express.Router();

  router.post("/submit-one", (req, res) => {
    const { name } = req.body ?? {};

    if (!name) {
      return res.status(400).json({
        error: "missing_required_parameter",
        required: ["name"]
      });
    }

    res.json({
      message: "received one required parameter",
      data: { name }
    });
  });

  router.post("/submit-two", (req, res) => {
    const { name, type } = req.body ?? {};

    if (!name || !type) {
      return res.status(400).json({
        error: "missing_required_parameters",
        required: ["name", "type"]
      });
    }

    res.json({
      message: "received two required parameters",
      data: { name, type }
    });
  });

  return router;
}

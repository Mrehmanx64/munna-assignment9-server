const http = require("http");
const { app } = require("./dist/app.js");

const PORT = 5099;
const server = app.listen(PORT, async () => {
  console.log(`[SmokeTest] Test server listening on http://localhost:${PORT}`);

  const get = (path) =>
    new Promise((resolve, reject) => {
      http
        .get(`http://localhost:${PORT}${path}`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        })
        .on("error", reject);
    });

  try {
    // 1. Root route
    const root = await get("/");
    console.log(`✔ Root endpoint: ${root.status} - ${root.body.message}`);
    if (root.status !== 200 || !root.body.success) throw new Error("Root check failed");

    // 2. Health check endpoint
    const health = await get("/api/health");
    console.log(`✔ Health endpoint: ${health.status} - service=${health.body.data.service}, status=${health.body.data.status}`);
    if (health.status !== 200 || !health.body.success) throw new Error("Health check failed");

    // 3. 404 handler check
    const notFound = await get("/api/non-existent-route");
    console.log(`✔ 404 handler: ${notFound.status} - ${notFound.body.message}`);
    if (notFound.status !== 404 || notFound.body.success !== false) throw new Error("404 check failed");

    console.log("🎉 All smoke tests passed successfully!");
    server.close(() => process.exit(0));
  } catch (err) {
    console.error("❌ Smoke test failed:", err);
    server.close(() => process.exit(1));
  }
});

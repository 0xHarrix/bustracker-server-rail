const http = require("http");
const app = require("./app.js");
const initSocket = require("./realtime/socket.js");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

initSocket(server);

connectDB();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

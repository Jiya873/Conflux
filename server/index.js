const { createClient } = require("redis");
const Delta = require("quill-delta");
const socketIdToHexColor = require("./utils/socketIdToHexColor");
const redisAPI = require("./utils/redisAPI");

const io = require("socket.io")(3001, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let redisClient;
const SAVE_DEBOUNCE_MS = 2000;
const docSaveTimers = new Map();
// Authoritative in-memory document state keyed by docId.
const docDeltas = new Map();

const isValidDocId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

const isValidUsername = (name) =>
  typeof name === "string" && name.trim().length > 0 && name.length <= 50;

const isValidDelta = (delta) =>
  delta !== null && typeof delta === "object" && Array.isArray(delta.ops);

const isValidRange = (range) =>
  range === null ||
  (typeof range === "object" &&
    typeof range.index === "number" &&
    typeof range.length === "number");

(async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || "redis://redis:6379",
  });

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  const { addUser, getUsers, initDoc, setDoc, removeUser } = new redisAPI(
    redisClient
  );

  await redisClient.connect().then(async () => {
    console.log("Redis connected...");

    try {
      await redisClient.flushAll();
      console.log("Redis flushed...");
    } catch (err) {
      console.error("Error in redis flushAll", err);
    }

    io.on("connection", (socket) => {
      const rawUsername = socket.handshake.query.username;
      const username = isValidUsername(rawUsername)
        ? rawUsername.trim().slice(0, 50)
        : "Anonymous";
      const color = socketIdToHexColor(socket.id);

      socket.on("get-doc", async (docId) => {
        if (!isValidDocId(docId)) return;
        try {
          const doc = await initDoc(docId);

          // Seed in-memory delta from Redis if not already loaded.
          if (!docDeltas.has(docId)) {
            docDeltas.set(
              docId,
              new Delta(doc && doc.ops ? doc : { ops: [] })
            );
          }

          socket.join(docId);
          socket.docId = docId;

          const newUser = {
            id: socket.id,
            username,
            color,
          };
          await addUser(docId, newUser);
          const userList = await getUsers(docId);
          io.to(docId).emit("users", userList);

          socket.emit("load-doc", doc);
        } catch (err) {
          console.error("Error in get-doc:", err);
          socket.emit("error", "Failed to load document.");
        }
      });

      socket.on("text-change", async (delta) => {
        if (!socket.docId || !isValidDelta(delta)) return;
        try {
          // Compose onto the authoritative state so the server always holds
          // the canonical document, independent of client save timing.
          const current = docDeltas.get(socket.docId) || new Delta();
          docDeltas.set(socket.docId, current.compose(new Delta(delta)));

          socket.broadcast.to(socket.docId).emit("receive-text-change", delta);

          if (docSaveTimers.has(socket.docId)) {
            clearTimeout(docSaveTimers.get(socket.docId));
          }
          docSaveTimers.set(
            socket.docId,
            setTimeout(() => {
              socket.emit("request-save");
              docSaveTimers.delete(socket.docId);
            }, SAVE_DEBOUNCE_MS)
          );
        } catch (err) {
          console.error("Error in text-change:", err);
          socket.emit("error", "Text update failed.");
        }
      });

      socket.on("user-typing", async (state) => {
        if (!socket.docId || typeof state !== "boolean") return;
        try {
          socket.broadcast
            .to(socket.docId)
            .emit("receive-user-typing", socket.id, state);
        } catch (err) {
          console.error("Error in user-typing:", err);
          socket.emit("error", "Typing notification failed.");
        }
      });

      socket.on("cursor-change", async ({ range, username: cursorUsername }) => {
        if (!socket.docId || !isValidRange(range)) return;
        try {
          socket.broadcast.to(socket.docId).emit("receive-cursor-change", {
            userId: socket.id,
            range,
            username: cursorUsername,
            color,
          });
        } catch (err) {
          console.error("Error in cursor-change:", err);
          socket.emit("error", "Cursor update failed.");
        }
      });

      socket.on("save-doc", async (data) => {
        if (!socket.docId || !isValidDelta(data)) return;
        try {
          // Persist the authoritative composed delta, not the raw client payload.
          const authoritative = docDeltas.get(socket.docId);
          const toSave = authoritative ? authoritative : new Delta(data);
          await setDoc(socket.docId, JSON.stringify(toSave));
        } catch (err) {
          console.error("Error saving document:", err);
          socket.emit("error", "Failed to save document.");
        }
      });

      socket.on("disconnect", async () => {
        if (!socket.docId) return;
        try {
          socket.broadcast.to(socket.docId).emit("remove-cursor", socket.id);
          await removeUser(socket.docId, socket.id);
          const userList = await getUsers(socket.docId);
          io.to(socket.docId).emit("users", userList);

          // Free in-memory delta when the last user leaves the doc.
          const room = io.sockets.adapter.rooms.get(socket.docId);
          if (!room || room.size === 0) {
            docDeltas.delete(socket.docId);
          }
        } catch (err) {
          console.error("Error in disconnect:", err);
          socket.emit("error", "Error during disconnect cleanup.");
        }
      });
    });
  });
})();

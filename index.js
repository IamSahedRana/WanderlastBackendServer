import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing in environment variables!");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("✅ You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

app.use(cors());
app.use(express.json());

// Initialize Database and Collections safely (Fixed collection name to plural "destinations")
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("wanderlust");
const destinationCollection = db.collection("destinations"); // ✅ Fixed to "destinations"
const bookingCollection = db.collection("bookings");

// Middleware: Verify JWT Token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send({ msg: "Unauthorized: No token provided!" });
    }
    const token = authHeader.split(" ")[1];

    if (!process.env.CLIENT_URL) {
      return res.status(500).send({ msg: "Server configuration error: CLIENT_URL missing" });
    }

    console.log("token", token)
    
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    );

    await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    console.log(error)
    return res.status(401).send({ msg: "Unauthorized: Invalid or expired token!" });
  }
};

// --- DESTINATIONS ROUTES ---

app.post("/add-destination", verifyToken, async (req, res) => {
  try {
    const data = req.body;
    const result = await destinationCollection.insertOne(data);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/destinations", async (req, res) => {
  try {
    const result = await destinationCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/featured-destinations", async (req, res) => {
  try {
    const result = await destinationCollection.find().limit(5).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/destination/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid ID format" });
    }
    const result = await destinationCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!result) return res.status(404).send({ msg: "Destination not found" });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.patch("/destination/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid ID format" });
    }
    const data = req.body;
    const result = await destinationCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );
    res.json(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.delete("/destination/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid ID format" });
    }
    const result = await destinationCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.json(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// --- BOOKINGS ROUTES ---

app.post("/booking", async (req, res) => {
  try {
    const data = req.body;
    const result = await bookingCollection.insertOne(data);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/my-bookings/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const result = await bookingCollection.find({ email: email }).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.delete("/my-bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ msg: "Invalid ID format" });
    }
    const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// --- BASE ROUTE ---

app.get("/", (req, res) => {
  res.send({ message: "Server is running fine!" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});

export default app;
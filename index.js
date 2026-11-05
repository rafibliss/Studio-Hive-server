import express from 'express'
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from "cors"


const app = express()
const PORT = 8000;

// parse incoming JSON request bodies (frontend sends studio data as JSON)
app.use(express.json())
app.use(cors());


const client = new MongoClient(process.env.MONGODB_URI);
// database handle to use inside routes (studio-space database)
const db = client.db('StudioSpace');

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}

connectToMongoDB();

// POST /add-studio
// Receives studio data from the frontend form as a JSON body and saves it
// in the `studios` collection of the `StudioSpace` database.
// Expected body shape:
// {
//   "hostName": "String",
//   "hostEmail": "String",
//   "title": "String",
//   "category": "String",
//   "hourlyRate": "Number",
//   "securityDeposit": "Number",
//   "maxCapacity": "Number",
//   "location": "String",
//   "imageUrl": "String",
//   "amenities": ["String", "..."],
//   "overview": "String",
//   "createdAt": "Date"  // ISO date string or epoch ms; falls back to now if missing
// }
app.post('/add-studio', async (req, res) => {
    try {
        const { hostName, hostEmail, title, category, hourlyRate, securityDeposit, maxCapacity, location, imageUrl, amenities, overview, createdAt } = req.body ?? {};

        // basic validation - title is the minimum required field
        if (!title || typeof title !== 'string') {
            return res.status(400).send({ message: "Studio 'title' is required and must be a string" });
        }

        // coerce numbers safely, in case the form sends them as strings
        const toNumber = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };

        const newStudio = {
            hostName,
            hostEmail,
            title,
            category,
            hourlyRate: toNumber(hourlyRate),
            securityDeposit: toNumber(securityDeposit),
            maxCapacity: toNumber(maxCapacity),
            location,
            imageUrl,
            amenities: Array.isArray(amenities) ? amenities : [],
            overview,
            createdAt: createdAt ? new Date(createdAt) : new Date(),
        };

        const result = await db.collection('studios').insertOne(newStudio);
        console.log(`Studio "${title}" added with _id: ${result.insertedId}`);

        // 201 Created + return the new document id so the frontend can use it
        return res.status(201).send({
            message: 'Studio added successfully',
            insertedId: result.insertedId,
        });
    } catch (err) {
        console.error('Failed to add studio:', err);
        return res.status(500).send({ message: 'Failed to add studio', error: err.message });
    }
})

// GET /studios
// Fetches studio listings from the `studios` collection in the StudioSpace database.
// Optional query parameters:
//   ?limit=4      -> limit the number of returned documents (e.g. 4-6 featured items for the homepage)
//   ?category=X   -> filter listings by category (e.g. "Photo Studio", "Film Stage", ...)
// Examples:
//   GET /studios                          -> all studios
//   GET /studios?limit=6                  -> 6 featured studios for the homepage
//   GET /studios?category=Podcast%20Lounge-> only podcast lounges
app.get('/studios', async (req, res) => {
    try {
        const { limit, category } = req.query;

        const query = {};
        if (category) {
            query.category = category;
        }

        // parse limit as an integer, guarding against invalid values like ?limit=abc
        const parsedLimit = limit ? parseInt(limit, 10) : null;

        let cursor = db.collection('studios').find(query);
        if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
            cursor = cursor.limit(parsedLimit);
        }

        const studios = await cursor
            .sort({ createdAt: -1 })  // newest first
            .toArray();

        return res.status(200).send(studios);
    } catch (err) {
        console.error('Failed to fetch studios:', err);
        return res.status(500).send({ message: 'Failed to fetch studios', error: err.message });
    }
})


app.get('/', (req, res) => {
    res.send({ msg: "server is running fine " })
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`)
})

//http://localhost:8000/add-studio
import express from 'express'
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from "cors"


const app = express()
const PORT = 8000;


app.use(express.json())
app.use(cors());


const client = new MongoClient(process.env.MONGODB_URI);

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


app.post('/add-studio', async (req, res) => {
    try {
        const { hostName, hostEmail, title, category, hourlyRate, securityDeposit, maxCapacity, location, imageUrl, amenities, overview, createdAt } = req.body ?? {};

        if (!title || typeof title !== 'string') {
            return res.status(400).send({ message: "Studio 'title' is required and must be a string" });
        }


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


        return res.status(201).send({
            message: 'Studio added successfully',
            insertedId: result.insertedId,
        });
    } catch (err) {
        console.error('Failed to add studio:', err);
        return res.status(500).send({ message: 'Failed to add studio', error: err.message });
    }
})

//all studios api:
app.get('/studios', async (req, res) => {
    try {
        const { limit, category } = req.query;

        const query = {};
        if (category) {
            query.category = category;
        }


        const parsedLimit = limit ? parseInt(limit, 10) : null;

        let cursor = db.collection('studios').find(query);
        if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
            cursor = cursor.limit(parsedLimit);
        }

        const studios = await cursor
            .sort({ createdAt: -1 })
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
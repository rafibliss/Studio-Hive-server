import express from 'express'
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from "cors"
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { toNodeHandler } from 'better-auth/node';


const app = express()
const PORT = 8000;


const client = new MongoClient(process.env.MONGODB_URI);

const db = client.db('StudioSpace');


export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,
    trustedOrigins: ['http://localhost:3000'],
    database: mongodbAdapter(db, { client }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },
});


app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));


const nuAuth = toNodeHandler(auth);
const AUTH_ALIASES = new Set(['/api/auth/sign-in', '/api/auth/sign-up', '/api/auth/me']);
app.use((req, res, next) => {
    if (req.path.startsWith('/api/auth/') && !AUTH_ALIASES.has(req.path)) {
        return nuAuth(req, res, next);
    }
    next();
});

app.use(express.json());



const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//login 
app.post(['/api/auth/sign-in', '/api/login'], async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
        return res.status(400).send({ message: 'Email and password are required and cannot be empty' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).send({ message: 'Invalid email format' });
    }

    try {

        const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
        for (const cookie of response.headers.getSetCookie()) {
            res.append('Set-Cookie', cookie);
        }
        const user = await response.json();

        return res.status(response.status).send(user);
    } catch (err) {
        console.error('Sign-in failed:', err);
        return res.status(500).send({ message: 'Sign-in failed', error: err.message });
    }
});

//signup
app.post(['/api/auth/sign-up', '/api/register'], async (req, res) => {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
        return res.status(400).send({ message: 'Name, email and password are required and cannot be empty' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).send({ message: 'Invalid email format' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).send({ message: 'Password must be at least 8 characters' });
    }

    try {
        const response = await auth.api.signUpEmail({ body: { name, email, password }, asResponse: true });


        if (response.status === 422) {
            const body = await response.json().catch(() => ({}));
            return res.status(400).send({
                message: 'Email is already registered',
                code: body?.code || 'USER_ALREADY_EXISTS',
            });
        }

        for (const cookie of response.headers.getSetCookie()) {
            res.append('Set-Cookie', cookie);
        }
        const user = await response.json();
        return res.status(response.status).send(user);
    } catch (err) {
        console.error('Sign-up failed:', err);
        return res.status(500).send({ message: 'Sign-up failed', error: err.message });
    }
});


app.get(['/api/auth/me', '/api/session'], async (req, res) => {
    try {
        const session = await auth.api.getSession({ headers: req.headers });
        return res.status(200).send({
            authenticated: Boolean(session),
            user: session?.user ?? null,
            session: session?.session ?? null,
        });
    } catch (err) {
        console.error('Session check failed:', err);
        return res.status(500).send({ message: 'Session check failed', error: err.message });
    }
});

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
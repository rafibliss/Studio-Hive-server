import express from 'express'
// const { ObjectId } = require('mongodb');
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb';
import cors from "cors"
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { toNodeHandler } from 'better-auth/node';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';


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

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
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
app.use(cookieParser());



// JWT
function createToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' },
    );
}


function sendTokenCookie(res, user) {
    res.cookie('token', createToken(user), {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
    });
}


function verifyToken(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized: no token provided' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).send({ message: 'Unauthorized: invalid or expired token' });
    }
}



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
        const body = await response.json();


        if (response.status === 200 && body?.user) {
            sendTokenCookie(res, body.user);
        }

        return res.status(response.status).send(body);
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
        const body = await response.json();


        if (response.status === 200 && body?.user) {
            sendTokenCookie(res, body.user);
        }

        return res.status(response.status).send(body);
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



app.post(['/studios', '/add-studio', '/api/studios'], verifyToken, async (req, res) => {
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
        const { limit, category, email } = req.query;
        const query = {};
        if (category) {
            query.category = category;
        }
        if (email) {
            query.hostEmail = email;
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
});


//studio details by id:
app.get('/studios/:id', async (req, res) => {
    try {
        const { id } = req.params;


        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Studio not found' });
        }

        const studio = await db
            .collection('studios')
            .findOne({ _id: new ObjectId(id) });

        if (!studio) {
            return res.status(404).send({ message: 'Studio not found' });
        }

        return res.status(200).send(studio);
    } catch (err) {
        console.error('Failed to fetch studio:', err);
        return res.status(500).send({ message: 'Failed to fetch studio', error: err.message });
    }
})


const STUDIO_UPDATE_FIELDS = ['title', 'category', 'location', 'imageUrl', 'overview', 'hostName', 'hostEmail'];
const STUDIO_NUMBER_FIELDS = ['hourlyRate', 'securityDeposit', 'maxCapacity'];

app.put(['/studios/:id', '/api/studios/:id'], async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body ?? {};


        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid studio id' });
        }

        const setFields = {};


        for (const field of STUDIO_UPDATE_FIELDS) {
            if (updatedData[field] !== undefined) {
                if (typeof updatedData[field] !== 'string') {
                    return res.status(400).send({ message: `'${field}' must be a string` });
                }
                setFields[field] = updatedData[field];
            }
        }


        for (const field of STUDIO_NUMBER_FIELDS) {
            if (updatedData[field] !== undefined && updatedData[field] !== '') {
                const n = Number(updatedData[field]);
                if (!Number.isFinite(n) || n < 0) {
                    return res.status(400).send({ message: `'${field}' must be a valid non-negative number` });
                }
                setFields[field] = n;
            }
        }


        if (updatedData.amenities !== undefined) {
            if (!Array.isArray(updatedData.amenities) || updatedData.amenities.some((a) => typeof a !== 'string')) {
                return res.status(400).send({ message: `'amenities' must be an array of strings` });
            }
            setFields.amenities = updatedData.amenities;
        }

        if (Object.keys(setFields).length === 0) {
            return res.status(400).send({ message: 'No valid studio fields provided to update' });
        }


        const updatedStudio = await db.collection('studios').findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: setFields },
            { returnDocument: 'after' },
        );

        if (!updatedStudio) {
            return res.status(404).send({ message: 'Studio not found' });
        }

        return res.status(200).send({
            success: true,
            message: 'Studio updated successfully',
            studio: updatedStudio,
        });
    } catch (err) {
        console.error('Failed to update studio:', err);
        return res.status(500).send({ message: 'Failed to update studio', error: err.message });
    }
});


app.delete(['/studios/:id', '/api/studios/:id'], verifyToken, async (req, res) => {
    try {
        const { id } = req.params;


        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Studio not found' });
        }


        const deletedStudio = await db.collection('studios').findOneAndDelete({ _id: new ObjectId(id) });

        if (!deletedStudio) {
            return res.status(404).send({ message: 'Studio not found' });
        }

        return res.status(200).send({
            success: true,
            message: 'Studio deleted successfully',
        });
    } catch (err) {
        console.error('Failed to delete studio:', err);
        return res.status(500).send({ message: 'Failed to delete studio', error: err.message });
    }
});



app.post(['/bookings', '/api/bookings'], verifyToken, async (req, res) => {
    try {
        const { studioId, studioTitle, studioImage, location, hourlyRate, userName, userEmail, bookingDate, timeSlot } = req.body ?? {};

        if (!studioId || !userEmail) {
            return res.status(400).send({ message: "'studioId' and 'userEmail' are required" });
        }
        if (!bookingDate || !timeSlot) {
            return res.status(400).send({ message: "'bookingDate' and 'timeSlot' are required" });
        }

        const n = Number(hourlyRate);
        const newBooking = {
            studioId,
            studioTitle: studioTitle || '',
            studioImage: studioImage || '',
            location: location || '',
            hourlyRate: Number.isFinite(n) ? n : null,
            userName: userName || '',
            userEmail,
            bookingDate,
            timeSlot,
            status: 'Pending',
            createdAt: new Date(),
        };

        const result = await db.collection('bookings').insertOne(newBooking);
        console.log(`Booking created for ${userEmail} (${studioTitle || studioId}) -> ${result.insertedId}`);

        return res.status(201).send({
            success: true,
            message: 'Booking created successfully',
            insertedId: result.insertedId,
        });
    } catch (err) {
        console.error('Failed to create booking:', err);
        return res.status(500).send({ message: 'Failed to create booking', error: err.message });
    }
});


app.get(['/bookings', '/api/bookings'], async (req, res) => {
    try {
        const { email } = req.query;

        const query = {};
        if (email) {
            query.userEmail = email;
        }

        const bookings = await db.collection('bookings')
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).send(bookings);
    } catch (err) {
        console.error('Failed to fetch bookings:', err);
        return res.status(500).send({ message: 'Failed to fetch bookings', error: err.message });
    }
});


app.delete(['/bookings/:id', '/api/bookings/:id'], async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Booking not found' });
        }

        const deleted = await db.collection('bookings').findOneAndDelete({ _id: new ObjectId(id) });

        if (!deleted) {
            return res.status(404).send({ message: 'Booking not found' });
        }

        return res.status(200).send({
            success: true,
            message: 'Booking deleted successfully',
        });
    } catch (err) {
        console.error('Failed to delete booking:', err);
        return res.status(500).send({ message: 'Failed to delete booking', error: err.message });
    }
});


//booking creation api:
app.post('/bookings', async (req, res) => {
    try {
        const { studioId, studioTitle, studioImage, location, hourlyRate, userName, userEmail, bookingDate, timeSlot } = req.body ?? {};

        if (!studioId || !userEmail || !bookingDate || !timeSlot) {
            return res.status(400).send({ message: 'studioId, userEmail, bookingDate, and timeSlot are required' });
        }
        if (!ObjectId.isValid(studioId)) {
            return res.status(400).send({ message: 'Invalid studioId' });
        }
        if (hourlyRate !== undefined && hourlyRate !== null && !Number.isFinite(Number(hourlyRate))) {
            return res.status(400).send({ message: 'hourlyRate must be a number' });
        }

        const newBooking = {
            studioId,
            studioTitle: studioTitle || null,
            studioImage: studioImage || null,
            location: location || null,
            hourlyRate: hourlyRate !== undefined && hourlyRate !== null ? Number(hourlyRate) : null,
            userName: userName || null,
            userEmail,
            bookingDate,
            timeSlot,
            status: 'Pending',
            createdAt: new Date(),
        };

        const result = await db.collection('bookings').insertOne(newBooking);
        console.log(`Booking for studio "${studioTitle}" created with _id: ${result.insertedId}`);

        return res.status(201).send({
            message: 'Booking created successfully',
            insertedId: result.insertedId,
        });
    } catch (err) {
        console.error('Failed to create booking:', err);
        return res.status(500).send({ message: 'Failed to create booking', error: err.message });
    }
})

//bookings by user email:
app.get('/bookings', async (req, res) => {
    try {
        const { email } = req.query;

        const query = {};

        if (email) {
            query.userEmail = email;
        }

        const bookings = await db.collection('bookings')
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        return res.status(200).send(bookings);
    } catch (err) {
        console.error('Failed to fetch bookings:', err);
        return res.status(500).send({ message: 'Failed to fetch bookings', error: err.message });
    }
})

//delete a booking by id:
app.delete('/bookings/:id', async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Booking not found' });
        }

        const result = await db.collection('bookings').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: 'Booking not found' });
        }

        return res.status(200).send({
            success: true,
            message: 'Booking deleted successfully',
        });
    } catch (err) {
        console.error('Failed to delete booking:', err);
        return res.status(500).send({ message: 'Failed to delete booking', error: err.message });
    }
})


app.get('/', (req, res) => {
    res.send({ msg: "server is running fine " })
})

app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`)
})

//http://localhost:8000/add-studio
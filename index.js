import express from 'express'
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb';
import cors from "cors"
import { createRemoteJWKSet, jwtVerify } from 'jose';
const app = express()
const PORT = process.env.PORT || 8000;

const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

let mongoCache = globalThis.__studioSpaceMongoCache;

if (!mongoCache) {
    const client = new MongoClient(process.env.MONGODB_URI, {
        // serverless-friendly: release idle sockets quickly so a frozen lambda
        // never wakes up against dead server sockets (MongoTopologyClosedError)
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
    });
    mongoCache = globalThis.__studioSpaceMongoCache = {
        client,
        db: client.db('StudioSpace'),
        connectPromise: client.connect(),
    };
    mongoCache.connectPromise
        .then(() => console.log('You successfully connected to MongoDB!'))
        .catch((err) => console.dir(err)); // keep the "server starts even without DB" behavior
}

const client = mongoCache.client;
const db = mongoCache.db;
app.use(cors({
    origin: CLIENT_URL,
    credentials: true,
}));
app.use(express.json());
// Serverless: guarantee a live DB connection before any route queries it.
// Warm instance -> cached promise resolves instantly; cold start -> waits for
// the one-time handshake.
app.use(async (req, res, next) => {
    const connectedClient = await connectToMongoDB();
    if (!connectedClient) {
        return res.status(503).send({ message: 'Database unavailable' });
    }
    next();
});
// ─── JWT protection (data API only) ─────────────────────────────────────────
// All authentication (credentials + Google OAuth) lives in the Next.js
// frontend, whose Better Auth instance has the `jwt()` plugin enabled. It
// signs tokens ASYMMETRICALLY (EdDSA / Ed25519), so there is no shared
// secret here: we fetch the PUBLIC keys from the frontend's JWKS endpoint
// (on the FRONTEND's origin, not this server's) and verify with jose.
const jwks = createRemoteJWKSet(new URL('/api/auth/jwks', CLIENT_URL), {
    // jose caches keys; re-fetch at most every 30s per warm instance
    cooldownDuration: 30000,
});

async function verifyJWT(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized: missing Authorization: Bearer <token> header' });
    }
    try {
        // Better Auth jwt() plugin defaults: issuer = audience = the auth
        // baseURL, i.e. the frontend origin (CLIENT_URL). Algorithm: EdDSA.
        const { payload } = await jwtVerify(token, jwks, {
            issuer: CLIENT_URL,
            audience: CLIENT_URL,
            algorithms: ['EdDSA'],
        });
        // Normalize claims: Better Auth JWTs carry `sub` (user id) + `email`.
        req.user = { id: payload.sub || payload.id, email: payload.email };
        next();
    } catch (err) {
        // Surface jose's exact reason (e.g. ERR_JWT_CLAIM_VALIDATION_FAILED
        // for issuer/audience mismatch, ERR_JWT_EXPIRED, JWKS fetch failures)
        // so a mismatch between the frontend and this verifier is immediately
        // visible in the response and in the server log.
        const reason = err?.code || err?.name || err?.message || 'unknown';
        console.error('JWT verification failed:', reason, '-', err?.message);
        return res.status(401).send({
            message: 'Unauthorized: invalid or expired token',
            reason,
        });
    }
}
// Awaited before DB queries (via the global middleware below). On a warm
// instance the cached promise has already resolved, so this returns in
// microseconds; on a cold start it waits for the single handshake. Returns
// null on connection failure so the middleware can respond 503 cleanly.
export async function connectToMongoDB() {
    try {
        await mongoCache.connectPromise;
        return mongoCache.client;
    } catch (err) {
        console.dir(err);
        return null;
    }
}
function withImages(studio) {
    if (!studio) return studio;
    const gallery = Array.isArray(studio.images)
        ? studio.images
        : (studio.image || studio.imageUrl ? [studio.image || studio.imageUrl] : []);
    return { ...studio, images: gallery };
}
function parseImagesInput(body) {
    if (body.images === undefined) return undefined;
    if (!Array.isArray(body.images) || body.images.some((a) => typeof a !== 'string')) {
        return null;
    }
    return body.images.filter((a) => a.trim() !== '');
}
app.post(['/studios', '/add-studio', '/api/studios'], verifyJWT, async (req, res) => {
    try {
        const { hostName, hostEmail, title, category, hourlyRate, securityDeposit, maxCapacity, location, imageUrl, images, amenities, overview, createdAt } = req.body ?? {};
        if (!title || typeof title !== 'string') {
            return res.status(400).send({ message: "Studio 'title' is required and must be a string" });
        }
        const galleryInput = parseImagesInput(req.body ?? {});
        if (galleryInput === null) {
            return res.status(400).send({ message: "'images' must be an array of strings" });
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
            images: galleryInput ?? (imageUrl ? [imageUrl] : []),
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
        return res.status(200).send(studios.map(withImages));
    } catch (err) {
        console.error('Failed to fetch studios:', err);
        return res.status(500).send({ message: 'Failed to fetch studios', error: err.message });
    }
});
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
        return res.status(200).send(withImages(studio));
    } catch (err) {
        console.error('Failed to fetch studio:', err);
        return res.status(500).send({ message: 'Failed to fetch studio', error: err.message });
    }
})
const STUDIO_UPDATE_FIELDS = ['title', 'category', 'location', 'imageUrl', 'overview', 'hostName', 'hostEmail'];
const STUDIO_NUMBER_FIELDS = ['hourlyRate', 'securityDeposit', 'maxCapacity'];
app.put(['/studios/:id', '/api/studios/:id'], verifyJWT, async (req, res) => {
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
        const galleryInput = parseImagesInput(updatedData);
        if (galleryInput === null) {
            return res.status(400).send({ message: "'images' must be an array of strings" });
        }
        if (galleryInput !== undefined) {
            setFields.images = galleryInput;
            setFields.imageUrl = galleryInput[0] || '';
        } else if (updatedData.imageUrl !== undefined) {
            setFields.images = updatedData.imageUrl ? [updatedData.imageUrl] : [];
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
            studio: withImages(updatedStudio),
        });
    } catch (err) {
        console.error('Failed to update studio:', err);
        return res.status(500).send({ message: 'Failed to update studio', error: err.message });
    }
});
app.delete(['/studios/:id', '/api/studios/:id'], verifyJWT, async (req, res) => {
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
function parseSlotTime(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}
function parseSlotRange(timeSlot) {
    if (typeof timeSlot !== 'string') return null;
    const parts = timeSlot.split(/\s*[–—-]\s*/).filter(Boolean);
    if (parts.length !== 2) return null;
    const start = parseSlotTime(parts[0]);
    const end = parseSlotTime(parts[1]);
    if (start === null || end === null || end <= start) return null;
    return { start, end };
}
async function findConflictingBooking(studioId, bookingDate, timeSlot) {
    const requested = parseSlotRange(timeSlot);
    const activeBookings = await db.collection('bookings')
        .find({
            studioId,
            bookingDate,
            status: { $in: ['Pending', 'Confirmed'] },
        })
        .toArray();
    return (
        activeBookings.find((booking) => {
            if (booking.timeSlot === timeSlot) return true;
            if (!requested) return false;
            const existing = parseSlotRange(booking.timeSlot);
            if (!existing) return false;
            return requested.start < existing.end && existing.start < requested.end;
        }) || null
    );
}
function sendBookingConflict(res, conflict) {
    return res.status(400).send({
        success: false,
        message: 'This studio is already booked for the selected time slot. Please pick a different date or time.',
        conflictingBookingId: conflict._id,
    });
}
app.post(['/bookings', '/api/bookings'], verifyJWT, async (req, res) => {
    try {
        const { studioId, studioTitle, studioImage, location, hourlyRate, userName, userEmail, bookingDate, timeSlot } = req.body ?? {};
        if (!studioId || !userEmail) {
            return res.status(400).send({ message: "'studioId' and 'userEmail' are required" });
        }
        if (!bookingDate || !timeSlot) {
            return res.status(400).send({ message: "'bookingDate' and 'timeSlot' are required" });
        }
        const n = Number(hourlyRate);
        const conflict = await findConflictingBooking(studioId, bookingDate, timeSlot);
        if (conflict) {
            return sendBookingConflict(res, conflict);
        }
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
        const { email, status } = req.query;
        const query = {};
        if (email) {
            query.userEmail = email;
        }
        if (status) {
            if (!BOOKING_STATUSES.includes(status)) {
                return res.status(400).send({ message: `'status' must be one of: ${BOOKING_STATUSES.join(', ')}` });
            }
            query.status = status;
        }
        const bookings = await db.collection('bookings')
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();
        return res.status(200).send(
            bookings.map((booking) => ({ ...booking, status: booking.status || 'Pending' })),
        );
    } catch (err) {
        console.error('Failed to fetch bookings:', err);
        return res.status(500).send({ message: 'Failed to fetch bookings', error: err.message });
    }
});
app.delete(['/bookings/:id', '/api/bookings/:id'], verifyJWT, async (req, res) => {
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
const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const BOOKING_TRANSITIONS = {
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
};
function ownsBooking(booking, user) {
    return (
        typeof booking?.userEmail === 'string' &&
        typeof user?.email === 'string' &&
        booking.userEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
    );
}
app.patch(['/bookings/:id/cancel', '/api/bookings/:id/cancel'], verifyJWT, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Booking not found' });
        }
        const bookings = db.collection('bookings');
        const booking = await bookings.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            return res.status(404).send({ message: 'Booking not found' });
        }
        if (!ownsBooking(booking, req.user)) {
            return res.status(403).send({ message: 'You can only cancel your own bookings' });
        }
        if (booking.status === 'Cancelled') {
            return res.status(200).send({
                success: true,
                message: 'Booking is already cancelled',
                booking,
            });
        }
        if (booking.status !== 'Pending') {
            return res.status(400).send({
                message: `Only pending bookings can be cancelled (current status: ${booking.status})`,
            });
        }
        const cancelled = await bookings.findOneAndUpdate(
            { _id: new ObjectId(id), status: 'Pending' },
            { $set: { status: 'Cancelled' } },
            { returnDocument: 'after' },
        );
        if (!cancelled) {
            return res.status(400).send({ message: 'Booking status changed, cannot cancel anymore' });
        }
        return res.status(200).send({
            success: true,
            message: 'Booking cancelled successfully',
            booking: cancelled,
        });
    } catch (err) {
        console.error('Failed to cancel booking:', err);
        return res.status(500).send({ message: 'Failed to cancel booking', error: err.message });
    }
});
app.patch(['/bookings/:id', '/api/bookings/:id'], verifyJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const { status: nextStatus } = req.body ?? {};
        if (!BOOKING_STATUSES.includes(nextStatus)) {
            return res.status(400).send({
                message: `'status' is required and must be one of: ${BOOKING_STATUSES.join(', ')}`,
            });
        }
        if (!ObjectId.isValid(id)) {
            return res.status(404).send({ message: 'Booking not found' });
        }
        const bookings = db.collection('bookings');
        const booking = await bookings.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            return res.status(404).send({ message: 'Booking not found' });
        }
        if (!ownsBooking(booking, req.user)) {
            return res.status(403).send({ message: 'You can only update your own bookings' });
        }
        if (booking.status === nextStatus) {
            return res.status(200).send({
                success: true,
                message: `Booking is already ${nextStatus}`,
                booking,
            });
        }
        const allowed = BOOKING_TRANSITIONS[booking.status] ?? [];
        if (!allowed.includes(nextStatus)) {
            return res.status(400).send({
                message: `Cannot change status from '${booking.status}' to '${nextStatus}'`,
            });
        }
        const updated = await bookings.findOneAndUpdate(
            { _id: new ObjectId(id), status: booking.status },
            { $set: { status: nextStatus } },
            { returnDocument: 'after' },
        );
        if (!updated) {
            return res.status(400).send({ message: 'Booking status changed, please retry' });
        }
        return res.status(200).send({
            success: true,
            message: `Booking marked as ${nextStatus}`,
            booking: updated,
        });
    } catch (err) {
        console.error('Failed to update booking status:', err);
        return res.status(500).send({ message: 'Failed to update booking status', error: err.message });
    }
});
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
        const conflict = await findConflictingBooking(studioId, bookingDate, timeSlot);
        if (conflict) {
            return sendBookingConflict(res, conflict);
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
export default app;
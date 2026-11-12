import 'dotenv/config'
import { MongoClient } from 'mongodb';

// Sample-listing seed for testing the gallery carousel feature.
// Run with: npm run seed:samples
//
// Inserts exactly 5 studio docs, one per distinct category (vocal booth,
// full-band tracking, electronic mixing/mastering, vintage analog, modern
// production lounge), each with a 3-image Unsplash gallery.
//
// Idempotent: only docs with hostEmail "samples@studiohive.com" are replaced,
// so it never touches the 18 catalog studios from `npm run seed` (hosted by
// alex@studiohive.com) or any real user data.
//
// Field notes: docs carry the requested shape (name, description, price,
// host) AND the legacy listing fields the frontend already uses (title,
// overview, hourlyRate, hostName/hostEmail, imageUrl) so they render
// correctly no matter which fields a page reads.

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('StudioSpace');

const HOST = { name: 'Rafiq Hasan', email: 'samples@studiohive.com' };

const sampleStudios = [
    {
        // 1. Vocal booth / podcasting setup
        name: 'Acoustic Vault Dhaka',
        title: 'Acoustic Vault Dhaka',
        description: 'A double-walled isolation booth purpose-built for vocals, voice-over, and podcast recording. Dead-quiet acoustics, broadcast mic chains, and a separate producer desk with zero latency monitoring.',
        overview: 'A double-walled isolation booth purpose-built for vocals, voice-over, and podcast recording. Dead-quiet acoustics, broadcast mic chains, and a separate producer desk with zero latency monitoring.',
        location: 'Dhanmondi, Dhaka',
        price: 80,
        hourlyRate: 80,
        images: [
            'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80',
            'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80',
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
        ],
        amenities: ['Pro Tools HD', 'Vocal Booth', 'Acoustic Treatment', 'Shure SM7B Mics', 'Remote Call Bridge', 'Zero-Latency Monitoring'],
        host: HOST,
        hostName: HOST.name,
        hostEmail: HOST.email,
        imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80',
    },
    {
        // 2. Full-band tracking room with live instruments
        name: 'Sonic Groove Studio',
        title: 'Sonic Groove Studio',
        description: 'A full-band tracking room with a 40 sqm live area, tuned drum kit, grand piano, and a wall of guitar amps. Everybody in one room, headphones on, record the take — the way records used to be cut.',
        overview: 'A full-band tracking room with a 40 sqm live area, tuned drum kit, grand piano, and a wall of guitar amps. Everybody in one room, headphones on, record the take — the way records used to be cut.',
        location: 'Uttara, Dhaka',
        price: 100,
        hourlyRate: 100,
        images: [
            'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80',
            'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
            'https://images.unsplash.com/photo-1598488035139-bdbb7f05173a?w=800&q=80',
        ],
        amenities: ['Pro Tools HD', 'Live Room', 'Tuned Drum Kit', 'Grand Piano', 'Guitar Amp Wall', 'SSL Console'],
        host: HOST,
        hostName: HOST.name,
        hostEmail: HOST.email,
        imageUrl: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80',
    },
    {
        // 3. Electronic music / mixing & mastering suite
        name: 'Pulse Wave Lab',
        title: 'Pulse Wave Lab',
        description: 'An electronic music production and mastering suite tuned to a flat response: main monitors plus a subwoofer array, analog summing, and metering you can actually trust for final masters.',
        overview: 'An electronic music production and mastering suite tuned to a flat response: main monitors plus a subwoofer array, analog summing, and metering you can actually trust for final masters.',
        location: 'Banani, Dhaka',
        price: 120,
        hourlyRate: 120,
        images: [
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
            'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80',
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
        ],
        amenities: ['Ableton Live Suite', 'Pro Tools HD', 'Analog Summing Mixer', 'Studio Monitors + Sub Array', 'MIDI Controllers', 'Acoustic Treatment'],
        host: HOST,
        hostName: HOST.name,
        hostEmail: HOST.email,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    },
    {
        // 4. Vintage analog recording studio
        name: 'Tape Deck Analog House',
        title: 'Tape Deck Analog House',
        description: 'A vintage analog studio where every critical stage is hardware: 2-inch tape, class-A preamps, ribbon mics, and a natural stone reverb chamber. Warmth included, recall not guaranteed.',
        overview: 'A vintage analog studio where every critical stage is hardware: 2-inch tape, class-A preamps, ribbon mics, and a natural stone reverb chamber. Warmth included, recall not guaranteed.',
        location: 'Gulshan, Dhaka',
        price: 150,
        hourlyRate: 150,
        images: [
            'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80',
            'https://images.unsplash.com/photo-1492691524714-191d01af4775?w=800&q=80',
            'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80',
        ],
        amenities: ['2-Inch Tape Machine', 'Class-A Preamps', 'Ribbon Mics', 'Vintage Compressors', 'Reverb Chamber', 'Acoustic Treatment'],
        host: HOST,
        hostName: HOST.name,
        hostEmail: HOST.email,
        imageUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80',
    },
    {
        // 5. High-end modern production lounge
        name: 'Skyline Beat Lounge',
        title: 'Skyline Beat Lounge',
        description: 'A high-end production lounge with panoramic city views, dual 4K displays, a full plugin locker, and a sofa-furnished client area. Built for producers who work long sessions in comfort.',
        overview: 'A high-end production lounge with panoramic city views, dual 4K displays, a full plugin locker, and a sofa-furnished client area. Built for producers who work long sessions in comfort.',
        location: 'Gulshan 2, Dhaka',
        price: 130,
        hourlyRate: 130,
        images: [
            'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
            'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=800&q=80',
            'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=800&q=80',
        ],
        amenities: ['Dual 4K Displays', 'Full Plugin Suite', 'Studio Monitors', 'MIDI Pads & Controllers', 'Client Lounge', 'Espresso Bar'],
        host: HOST,
        hostName: HOST.name,
        hostEmail: HOST.email,
        imageUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
    },
];

async function seedSamples() {
    try {
        await client.connect();
        console.log('You successfully connected to MongoDB!');

        const collection = db.collection('studios');
        const deleted = await collection.deleteMany({ hostEmail: HOST.email });
        console.log(`Removed ${deleted.deletedCount} old sample listing(s)`);

        const result = await collection.insertMany(
            sampleStudios.map((studio) => ({ ...studio, createdAt: new Date() })),
        );
        console.log(`Successfully inserted ${result.insertedCount} sample listings into StudioSpace.studios`);

        for (const [key, id] of Object.entries(result.insertedIds)) {
            console.log(`  ${sampleStudios[key].name} -> ${id} (gallery: ${sampleStudios[key].images.length} images)`);
        }
    } catch (err) {
        console.error('Seeding sample listings failed:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
        console.log('MongoDB connection closed.');
    }
}

seedSamples();

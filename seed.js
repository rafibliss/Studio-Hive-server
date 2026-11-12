import 'dotenv/config'
import { MongoClient } from 'mongodb';

// Seed script: inserts realistic sample studios into the `studios` collection
// in the StudioSpace database. Run with: npm run seed
//
// Idempotent: only docs with hostEmail "alex@studiohive.com" are replaced.
// Each studio now carries BOTH imageUrl (legacy single image) and images
// (3-shot gallery carousel) so the frontend can migrate gradually.

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('StudioSpace');

const sampleStudios = [
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "LensCraft Photo Studio",
        category: "Photo Studio",
        hourlyRate: 65,
        securityDeposit: 200,
        maxCapacity: 12,
        location: "Banani, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb7f05173a?w=800&q=80",
        amenities: ["Wi-Fi", "Lighting Kit", "Makeup Station", "Green Screen", "Dressing Room"],
        overview: "A bright, fully equipped photography studio with a seamless white cyc wall, strobes, and continuous lighting. Ideal for portraits, product shoots, and e-commerce content.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Nova Film Stage",
        category: "Film Stage",
        hourlyRate: 150,
        securityDeposit: 500,
        maxCapacity: 40,
        location: "Gulshan 2, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1492691524714-191d01af4775?w=800&q=80",
        amenities: ["Blackout Curtains", "Lighting Grid", "Green Room", "Cinema Camera Gear", "Monitor Wall", "Loader Room"],
        overview: "A 3,000 sq ft soundstage with a 18ft ceiling, blackout capability, and a pre-rigged lighting grid. Production-friendly drive-in access and dedicated gear storage.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Echo Nest Podcast Lounge",
        category: "Podcast Lounge",
        hourlyRate: 45,
        securityDeposit: 150,
        maxCapacity: 6,
        location: "Dhanmondi, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80",
        amenities: ["Wi-Fi", "Shure SM7B Mics", "Multi-track Recorder", "Acoustic Panels", "Video Cameras", "Coffee Bar"],
        overview: "A cozy acoustically-treated lounge built for podcast recording and livestreams. Records up to four hosts plus a guest, with broadcast-quality mics and video capture.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Harbor Line Music Suite",
        category: "Music Suite",
        hourlyRate: 80,
        securityDeposit: 300,
        maxCapacity: 10,
        location: "Uttara Sector 7, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80",
        amenities: ["Drums", "Guitar Amp", "Piano", "PA System", "Control Room", "Backline Storage"],
        overview: "A purpose-built rehearsal and tracking suite with double-leaf acoustic doors, full drum backline, and a separate control room with a hybrid analog/digital setup.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Forge Creative Workshop",
        category: "Workshop",
        hourlyRate: 35,
        securityDeposit: 100,
        maxCapacity: 20,
        location: "Mirpur DOHS, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=800&q=80",
        amenities: ["Wi-Fi", "Projector", "Whiteboard Wall", "Modular Tables", "Tool Bench", "Kitchenette"],
        overview: "A flexible maker workshop and teaching space with modular seating for classes, meetups, and small build sessions. Projector, whiteboard wall, and a stocked tool bench are included.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Golden Hour Rooftop Studio",
        category: "Photo Studio",
        hourlyRate: 95,
        securityDeposit: 350,
        maxCapacity: 15,
        location: "Bashundhara R/A, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=800&q=80",
        amenities: ["Natural Light", "Lighting Kit", "Props & Furniture", "Makeup Station", "Terrace Access"],
        overview: "North-facing rooftop studio with floor-to-ceiling windows and controlled natural light for the golden-hour look. Includes styled props, furniture sets, and a private terrace.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Cut Take Film Stage",
        category: "Film Stage",
        hourlyRate: 120,
        securityDeposit: 450,
        maxCapacity: 30,
        location: "Tejgaon I/A, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80",
        amenities: ["Blackout Curtains", "Grip Truck", "HMIs", "Green Room", "Wardrobe Area", "Loader Room"],
        overview: "A versatile mid-size stage three meters from the airport road, designed for commercial shoots and music videos. Comes with an on-site grip package and HMIs.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Whisper Room Podcast Booth",
        category: "Podcast Lounge",
        hourlyRate: 40,
        securityDeposit: 120,
        maxCapacity: 4,
        location: "Mohakhali, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
        amenities: ["Wi-Fi", "Shure SM7B Mics", "Acoustic Panels", "Sound-isolated Booth", "Remote Call Bridge"],
        overview: "A whisper-quiet isolated booth for interviews and solo shows. Sound-isolated to a weekday-street-library level and wired for remote guest call-ins.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Through the Lens Studio",
        category: "Photo Studio",
        hourlyRate: 70,
        securityDeposit: 250,
        maxCapacity: 14,
        location: "Banani 11, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1452626038306-9aae5e191892?w=800&q=80",
        amenities: ["Profoto Strobes", "Backdrop Library", "Makeup Station", "Wi-Fi", "Changing Room", "Props & Furniture"],
        overview: "A working photographer's studio with a curated backdrop library, Profoto strobe kit, and rail-mounted modifiers. Changing room and steam station on site for fashion and portrait shoots.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "White Frame Photo Loft",
        category: "Photo Studio",
        hourlyRate: 55,
        securityDeposit: 180,
        maxCapacity: 10,
        location: "Lalmatia, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800&q=80",
        amenities: ["Daylight Windows", "Ring Lights", "Seamless Backdrops", "Props Closet", "Wi-Fi", "Coffee Bar"],
        overview: "A sunlit loft studio popular with small brands and content creators. South-facing daylight windows with blackout blinds, plus a props closet stocked with vases, textiles, and furniture.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Blueprint Film Stage",
        category: "Film Stage",
        hourlyRate: 130,
        securityDeposit: 400,
        maxCapacity: 25,
        location: "Shyamoli, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80",
        amenities: ["Blackout Curtains", "Lighting Grid", "Dolly & Track", "Green Room", "Craft Services", "Loader Room"],
        overview: "A fully blacked-out stage with a motorized lighting grid and pre-laid dolly track, built for talking-head commercials and short-form productions. Craft services kitchen included with full-day bookings.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Riverside Cine Stage",
        category: "Film Stage",
        hourlyRate: 110,
        securityDeposit: 380,
        maxCapacity: 22,
        location: "Khilgaon, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&q=80",
        amenities: ["Blackout Curtains", "HMIs", "Grip Truck", "Green Room", "Wardrobe Area", "Monitor Wall"],
        overview: "A mid-size production stage near the Buriganga side with a drive-in loading bay, HMI package, and a client-facing monitor wall. Well suited to music videos and television commercials.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "MicBooth 21",
        category: "Podcast Lounge",
        hourlyRate: 42,
        securityDeposit: 100,
        maxCapacity: 5,
        location: "Farmgate, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80",
        amenities: ["Shure SM7B Mics", "Mixing Console", "Acoustic Panels", "Remote Call Bridge", "Wi-Fi", "Headphone Amp"],
        overview: "A compact broadcast booth seating three hosts plus a producer. Console-based mixing with shure SM7B chains, headphone cue amps, and a built-in bridge for remote guests.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Two Cups Podcast Cafe",
        category: "Podcast Lounge",
        hourlyRate: 38,
        securityDeposit: 130,
        maxCapacity: 8,
        location: "Gulshan 1, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
        amenities: ["Wi-Fi", "Podcast Mics", "Acoustic Panels", "Video Cameras", "Coffee Bar", "Modular Seating"],
        overview: "A cafe-style conversational set with warm lighting, modular seating, and dual video capture. Designed to look great on camera with zero set dressing — ideal for interview shows.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "The Amp Room",
        category: "Music Suite",
        hourlyRate: 75,
        securityDeposit: 280,
        maxCapacity: 12,
        location: "Mirpur 10, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        amenities: ["Drums", "Guitar Amp", "Bass Rig", "Keyboard", "PA System", "Control Room"],
        overview: "A rehearsal room tuned by working musicians, with a full backline (drums, twin guitar rigs, bass rig, 88-key board) and a small control room for quick demo tracking.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "Melody Den Tracking Suite",
        category: "Music Suite",
        hourlyRate: 90,
        securityDeposit: 320,
        maxCapacity: 9,
        location: "Dhanmondi 27, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
        amenities: ["Grand Piano", "Drum Booth", "Vocal Booth", "Studio Monitors", "Control Room", "Isolation Panels"],
        overview: "A serious tracking suite with a tuned live room, separate drum and vocal booths, and a piano in tune on arrival. The control room runs near-fields on acoustic isolation pads.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "CraftLab Workshop Space",
        category: "Workshop",
        hourlyRate: 35,
        securityDeposit: 90,
        maxCapacity: 18,
        location: "Mohakhali DOHS, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
        amenities: ["Laser Cutter", "3D Printers", "Tool Bench", "Modular Tables", "Projector", "Wi-Fi"],
        overview: "A hands-on maker space with a laser cutter, three 3D printers, and a stocked tool bench. Modular tables reconfigure from classroom rows to project pods in minutes.",
        createdAt: new Date(),
    },
    {
        hostName: "Alex Rivera",
        hostEmail: "alex@studiohive.com",
        title: "MindMesh Training Workshop",
        category: "Workshop",
        hourlyRate: 45,
        securityDeposit: 140,
        maxCapacity: 24,
        location: "Baridhara, Dhaka",
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
        amenities: ["Dual Projectors", "Whiteboard Glass Walls", "AV Recording", "Catering Corner", "Wi-Fi", "Power Backup"],
        overview: "A training and seminar room with dual projection, glass whiteboard walls, and built-in AV recording so sessions can be repurposed as course content. Catering corner is included for all-day workshops.",
        createdAt: new Date(),
    },
];

// Give every seeded studio a 3-image gallery carousel: its own main shot
// (kept in imageUrl for backward compatibility) plus 2 related studio
// interiors borrowed from the already-in-use image pool (demo data only).
const GALLERY_POOL = sampleStudios.map((s) => s.imageUrl);
sampleStudios.forEach((studio, i) => {
    studio.images = [
        studio.imageUrl,
        GALLERY_POOL[(i + 1) % GALLERY_POOL.length],
        GALLERY_POOL[(i + 2) % GALLERY_POOL.length],
    ];
});

async function seed() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");

        // Start clean so re-running the seed doesn't duplicate the sample data
        const collection = db.collection('studios');
        const deleted = await collection.deleteMany({ hostEmail: "alex@studiohive.com" });
        console.log(`Removed ${deleted.deletedCount} existing sample studio(s)`);

        const result = await collection.insertMany(sampleStudios);
        console.log(`Successfully inserted ${result.insertedCount} sample studios into StudioSpace.studios`);

        for (const [key, id] of Object.entries(result.insertedIds)) {
            console.log(`  ${sampleStudios[key].title} -> ${id}`);
        }
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exitCode = 1;
    } finally {
        await client.close();
        console.log("MongoDB connection closed.");
    }
}

seed();

const mongoose = require('mongoose');

async function seedAlert() {
    try {
        await mongoose.connect('mongodb://localhost:27017/kinetix');
        console.log('Connected to DB');

        const trainer = await mongoose.connection.db.collection('trainerprofiles').findOne({});
        if (!trainer) {
            console.log('No trainer found');
            return;
        }

        const client = await mongoose.connection.db.collection('clientprofiles').findOne({ trainerId: trainer._id });
        if (!client) {
            console.log('No client found for this trainer');
            return;
        }

        await mongoose.connection.db.collection('clientprofiles').updateOne(
            { _id: client._id },
            { $set: { nextWeekRequested: true, updatedAt: new Date() } }
        );

        console.log('Successfully updated client to trigger alert');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

seedAlert();

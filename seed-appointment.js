const mongoose = require('mongoose');

async function seedAppointment() {
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

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const appointment = {
            trainerId: trainer._id,
            clientId: client._id,
            time: tomorrow,
            duration: 45,
            type: 'CHECK_IN',
            status: 'SCHEDULED',
            notes: 'Weekly progress review',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await mongoose.connection.db.collection('appointments').insertOne(appointment);

        console.log('Successfully created appointment for ' + tomorrow);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

seedAppointment();

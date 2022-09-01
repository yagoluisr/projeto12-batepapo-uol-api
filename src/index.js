import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('uol');
});


app.post('/participants', async (req, res) => {
    const participant = req.body;


    if (!participant || typeof(participant.name) !== 'string' || participant.name === '') {
        res.sendStatus(422);
    }

    try {
        const user = await db.collection('participants').insertOne({...participant, lastStatus: `${Date.now()}`})    
        console.log(user);
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(409);
    }
    
});






app.listen(5000, () => {
    console.log('listen on port 5000');
})
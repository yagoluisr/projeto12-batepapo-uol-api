import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('uol');
});

const userSchema = joi.object({
    name: joi.string().empty()
});


// console.log(dayjs());
// console.log(dayjs().format( 'HH:mm:ss' ));
// console.log(dayjs().format());

app.post('/participants', async (req, res) => {
    const participant = req.body;

    //console.log(participant.name);
    //console.log({...participant, lastStatus: `${Date.now()}`});

    const validationUser = userSchema.validate(participant, {abortEarly: false});

    if (validationUser.error) {
        const message = validationUser.error.details.map(obj => obj.message);
        return res.status(422).send(message);
    }

    try {
        const filterParticipant = await db.collection('participants').find({name: participant.name}).toArray();
        console.log(filterParticipant);

        if (filterParticipant.length !== 0){
            return res.status(409).send('Já existe um usuário com esse nome');
        }

        const user = await db.collection('participants').insertOne({...participant, lastStatus: `${Date.now()}`})    
        console.log(user);

        const message = await db.collection('message').insertOne({
            from: participant.name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('HH:mm:ss')
        });

        console.log(message)
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(409);
    }
    
});






app.listen(5000, () => {
    console.log('listen on port 5000');
})
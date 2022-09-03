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
    name: joi.string().empty().required()
});

const messageSchema = joi.object({
    to: joi.string().empty(),
    text: joi.string().empty(),
    type: joi.string().valid("message","private_message")
})


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

        const message = await db.collection('messages').insertOne({
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

app.get('/participants', async (req, res) => {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const user = req.headers.user;
    const validation = messageSchema.validate(req.body, {abortEarly: false});

    if (validation.error) {
        const error = validation.error.details.map(obj => obj.message)
        return res.status(422).send(error);
    }

    try {
        const participant = await db.collection('participants').find({name: user}).toArray();
        
        if (participant.length === 0) {
            return res.status(422).send('Esse remetente não está mais online');
        }

        const test = await db.collection('messages').insertOne({
            from: user, 
            to, 
            text, 
            type, 
            time: dayjs().format('HH:mm:ss')
    });
        console.log(test);
        res.sendStatus(201);
    } catch (error) {
        res.status(422).send(error);
    }
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query.limit);

    try {
        const messages = await db.collection('messages').find().toArray();

        if (!limit) return res.status(200).send(messages);
        
        const filteredMessages = messages.slice(-limit);

        res.status(200).send(filteredMessages);
    } catch (error) {
        res.status(422).send(error);   
    }

    //res.send(a);
});




app.listen(5000, () => {
    console.log('listen on port 5000');
})
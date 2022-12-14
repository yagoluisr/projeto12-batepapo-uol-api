import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
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
});

app.post('/participants', async (req, res) => {
    const participant = req.body;

    const validationUser = userSchema.validate(participant, {abortEarly: false});

    if (validationUser.error) {
        const message = validationUser.error.details.map(obj => obj.message);
        return res.status(422).send(message);
    }

    try {
        const filterParticipant = await db.collection('participants').find({name: participant.name}).toArray();

        if (filterParticipant.length !== 0){
            return res.status(409).send('Já existe um usuário com esse nome');
        }

        const user = await db.collection('participants').insertOne({...participant, lastStatus: `${Date.now()}`})    

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
            return res.sendStatus(422);
        }

        await db.collection('messages').insertOne({
            from: user, 
            to, 
            text, 
            type, 
            time: dayjs().format('HH:mm:ss')
        });

        res.sendStatus(201);
    } catch (error) {
        res.status(422).send(error);
    }
});

app.get('/messages', async (req, res) => {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit);
    
    try {
        const messages = await db.collection('messages').find().toArray();

        if (!limit) return res.status(200).send(messages);

        const filteredMessages = messages
            .filter(msg => 
                msg.to === "Todos" || 
                (msg.type === "private_message" &&
                 (msg.from === user || msg.to === user)
                ));
        
        const limitMessages = filteredMessages.slice(-limit);

        res.status(200).send(limitMessages);
    } catch (error) {
        res.status(500).send(error);   
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;

    try {
        const participant = await db.collection('participants').find({name: user}).toArray();
        
        if (participant.length === 0) {
            return res.sendStatus(404);
        }

        await db.collection('participants')
        .updateOne(
            {name: user},
            {$set:{lastStatus: `${Date.now()}`}}
        )

        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

setInterval(async () => {
    try {
        let participant = await db.collection('participants').find().toArray();

        let filterParticipant = participant.filter(obj => ((Date.now() - obj.lastStatus) / 1000) > 10);

        filterParticipant.forEach(async (obj) => {
            await db.collection('participants').deleteOne({_id: ObjectId(obj._id)});
            await db.collection('messages').insertOne(
                {
                    from: obj.name, 
                    to: 'Todos', 
                    text: 'sai da sala...', 
                    type: 'status', 
                    time: dayjs().format('HH:mm:ss')
                }
            )
        });
    } catch (error) {
        console.log(error);
    }
}, 15000);

app.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
    const { user } = req.headers;
    const idMessage = req.params.ID_DA_MENSAGEM;

    try {
        const message = await db.collection('messages').find({_id: ObjectId(`${idMessage}`)}).toArray();
        
        if (message.length === 0) {
            return res.sendStatus(404);
        }

        if (message[0].from !== user) {
            return res.sendStatus(401);
        }

        await db.collection('messages').deleteOne({_id: ObjectId(`${idMessage}`)});

        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
    const { user } = req.headers;
    const { to, text, type } = req.body
    const idMessage = req.params.ID_DA_MENSAGEM;
    const validation = messageSchema.validate(req.body, {abortEarly: false});

    if (validation.error) {
        const error = validation.error.details.map(obj => obj.message);
        return res.status(422).send(error)
    }

    try {
    
        const participant = await db.collection('participants').find({name: user}).toArray();
    
        if (participant.length === 0) {
            return res.sendStatus(422);
        }

        const message = await db.collection('messages').find({_id: ObjectId(`${idMessage}`)}).toArray();

        if (message.length === 0) {
            return res.sendStatus(404);
        }

        if(user !== message[0].from){
            return res.sendStatus(401);
        }

        await db.collection('messages')
        .updateOne(
            {_id: ObjectId (`${idMessage}`)},
            {$set: {text: text}}
        )

        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.listen(5000, () => {
    console.log('listen on port 5000');
});
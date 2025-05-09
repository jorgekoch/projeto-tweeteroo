import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();


const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;

mongoClient.connect()
.then(() => db = mongoClient.db())
.catch((err) => console.log(err.message));

app.post("/sign-up", (req, res) => {
    const { username, avatar } = req.body;
    
    const schema = Joi.object({
        username: Joi.string().required(),
        avatar: Joi.string().required()
    });

    const { error } = schema.validate({ username, avatar });

    if (error) {
        return res.status(422).send(error.details[0].message);
    }
    
    db.collection("users").insertOne({ username, avatar })
        .then(() => {
            return res.sendStatus(201);
        })
        .catch((err) => {
            return res.status(500).send(err.message);
        });
});

app.post("/tweet", async (req, res) => {
    const { username, tweet } = req.body;

    const schema = Joi.object({
        username: Joi.string().required(),
        tweet: Joi.string().required()
    });

    const { error } = schema.validate({ username, tweet });

    if (error) {
        return res.status(422).send(error.details[0].message);
    }

    try {
        const user = await db.collection("users").findOne({ username });

        if (!user) {
            return res.status(401).send("Usuário não está logado.");
        }

        await db.collection("tweets").insertOne({ username, tweet });
        return res.sendStatus(201);
    } catch (err) {
        return res.status(500).send(err.message);
    }
});


app.get("/tweets", async (req, res) => {
    try {
        const tweets = await db.collection("tweets").find().toArray();

        if (tweets.length === 0) {
            return res.send([]);
        }

        const tweetsWithAvatar = await Promise.all(
            tweets.map(async (tweet) => {
                const user = await db.collection("users").findOne({ username: tweet.username });
                return {
                    _id: tweet._id, 
                    username: tweet.username,
                    avatar: user.avatar,
                    tweet: tweet.tweet
                };
            })
        );

        res.send(tweetsWithAvatar.reverse());
    } catch (err) {
        res.status(500).send(err.message); 
    }
});


app.put("/tweets/:id", async (req, res) => {
    const { id } = req.params;
    const { tweet } = req.body;

    const schema = Joi.object({
        tweet: Joi.string().required()
    });

    const { error } = schema.validate({ tweet });

    if (error) {
        return res.status(422).send(error.details[0].message);
    }

    try {
        const result = await db.collection("tweets").updateOne(
            { _id: new ObjectId(id) },
            { $set: { tweet } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send("Tweet não encontrado.");
        }

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message); 
    }

})

app.delete('/tweet/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.collection("tweets").deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).send("Tweet não encontrado.");
        }

        res.sendStatus(204);
    } catch (err) {
        res.status(500).send(err.message); 
    }

});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Rodando na porta ${PORT}`))
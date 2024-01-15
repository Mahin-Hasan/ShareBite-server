const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;


//middleware
app.use(cors({
    origin: [
        // 'http://localhost:5173'
        'https://sharebite-66978.web.app',
        'https://sharebite-66978.firebaseapp.com'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


//connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4lo48xa.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// secure api
const logger = (req, res, next) => {
    // console.log('logger triggered', req.method, req.url);
    next();
}
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    // console.log('current active token', token);
    if (!token) {
        return res.status(401).send({ message: 'access denied' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'access denied' })
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        //Database Collections
        const foodCollection = client.db('shareBiite').collection('foods');
        const requestCollection = client.db('shareBiite').collection('requests');


        //token related api
        app.post('/token', async (req, res) => {
            const user = req.body;
            // console.log('token for user: ', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })
        //clear cookie on logout
        app.post('/logout', async (req, res) => {
            const user = req.body;
            // console.log('triggered log out', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        // updated get food api with sorting with least validity and email query
        app.get('/foods', async (req, res) => {
            let query = {};
            if (req.query?.userEmail) {
                query = { userEmail: req.query.userEmail }
            }
            const cursor = foodCollection.find(query).sort({ expiredDateTime: 1 });// sorting from lowest to highest
            const result = await cursor.toArray();
            res.send(result);
        })

        //add food 
        app.post('/foods', async (req, res) => {
            const newFood = req.body;
            const result = await foodCollection.insertOne(newFood);
            res.send(result)
        })
        // view single food by id
        app.get('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await foodCollection.findOne(query);
            res.send(result)
        })
        //update single food status to pending from available when food is requested
        app.patch('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedFood = req.body;
            const updateDoc = {
                $set: {
                    foodStatus: updatedFood.foodStatus
                },
            };
            const result = await foodCollection.updateOne(filter, updateDoc);
            res.send(result);
        }) 
        app.put('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedFoods = req.body;
            const brands = {
                $set: {
                    foodName: updatedFoods.foodName,
                    foodImage: updatedFoods.foodImage,
                    foodQuantity: updatedFoods.foodQuantity,
                    pickupLocation: updatedFoods.pickupLocation,
                    expiredDateTime: updatedFoods.expiredDateTime,
                    additionalNotes: updatedFoods.additionalNotes,
                    foodStatus: updatedFoods.foodStatus,
                    userName: updatedFoods.userName,
                    userEmail: updatedFoods.userEmail,
                    userPhoto: updatedFoods.userPhoto,
                }
            }
            const result = await foodCollection.updateOne(filter, brands, options)
            res.send(result);
        })
        // delete single food by Id
        app.delete('/foods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await foodCollection.deleteOne(query);
            res.send(result);
        })

        // Food request related api
        // read request with some data
        app.get('/requests', logger, verifyToken, async (req, res) => {
            let query = {};
            if (req.query?.loggedUserEmail) {
                query = { loggedUserEmail: req.query.loggedUserEmail }
            }
            //another query to get items according to given food id
            if (req.query?.foodId) {
                query.foodId = req.query.foodId;
            }
            const result = await requestCollection.find(query).toArray();
            res.send(result);
        })
        //add food request
        app.post('/requests', async (req, res) => {
            const newRequest = req.body;
            const result = await requestCollection.insertOne(newRequest);
            res.send(result)
        })
        //update food request status
        app.patch('/requests/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedReq = req.body;
            const updateReq = {
                $set: {
                    foodRequestStatus: updatedReq.foodRequestStatus
                },
            };
            const result = await requestCollection.updateOne(filter, updateReq);
            res.send(result);
        })
        //delete Requested food
        app.delete('/requests/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await requestCollection.deleteOne(query);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('sharebite is running')
})

app.listen(port, () => {
    console.log(`sharebite server is running at port ${port}`);
})
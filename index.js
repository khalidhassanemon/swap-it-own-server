const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vsbxkzu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        const usersCollection = client.db('swap').collection('users');
        const categoriesCollection = client.db('swap').collection('categories');
        const productsCollection = client.db('swap').collection('products');
        const ordersCollection = client.db('swap').collection('orders');
        const advertisementsCollection = client.db('swap').collection('advertisements');
        const paymentsCollection = client.db('swap').collection('payments');
        const reportssCollection = client.db('swap').collection('reports');

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories);
        });

        app.post('/products', verifyJWT, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        });

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });

        app.get('/users/allseller', async (req, res) => {
            const query = usersCollection.find({ role: 'seller' });
            const users = await query.toArray();
            res.send(users);
        });

        app.get('/users/allbuyer', async (req, res) => {
            const query = usersCollection.find({ role: 'buyer' });
            const users = await query.toArray();
            res.send(users);
        });

        app.get('/myproducts', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.send(categories);
        });

        app.get('/products/:email', async (req, res) => {
            const email = req.params.email;
            const result = await productsCollection.find().toArray();
            const filterData = result.filter(p => p.sellerMail === email);
            res.send(filterData);
        });

        app.get('/category/:categoryName', async (req, res) => {
            const cursor = req.params.categoryName;
            const query = await productsCollection.find({}).toArray();
            const filterData = query.filter(prod => prod.category === cursor);
            res.send(filterData);
        });

        app.post('/orders', verifyJWT, async (req, res) => {
            const product = req.body;
            const result = await ordersCollection.insertOne(product);
            res.send(result);
        });

        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email;
            const result = await ordersCollection.find().toArray();
            const filterData = result.filter(p => p.email === email);
            res.send(filterData);
        });

        app.delete('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        });

        app.delete('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        app.delete('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(filter);
            res.send(result);
        });

        app.post('/advertisements', verifyJWT, async (req, res) => {
            const ad = req.body;
            const result = await advertisementsCollection.insertOne(ad);
            res.send(result);
        });

        app.get('/advertisements', async (req, res) => {
            const query = {};
            const result = await advertisementsCollection.find(query).sort({ _id: -1 }).toArray();
            res.send(result);
        });

        app.get('/orders/payment/:id', async (req, res) => {
            const id = req.params.id;
            const result = await ordersCollection.find({ _id: ObjectId(id) }).toArray();
            res.send(result);
        });

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const resalePrice = booking.price;

            const amount = parseInt(resalePrice) * 100;
            console.log(typeof (amount), amount)
            if (amount) {
                const paymentIntent = await stripe.paymentIntents.create({
                    currency: 'usd',
                    amount: amount,
                    "payment_method_types": [
                        "card"
                    ]
                });
                res.send({
                    clientSecret: paymentIntent.client_secret,
                });

            }
            else {
                return
            }
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await ordersCollection.updateOne(filter, updatedDoc)
            res.send(result);
        });

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        };

        app.put('/users/seller/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'Veryfied'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.get('/veryfied/seller/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email: email });
            if (result?.status === 'Veryfied') {
                res.send(result);
            }
            else {
                return;
            }
        });

        app.post('/report-items', verifyJWT, async (req, res) => {
            const product = req.body;
            const result = await reportssCollection.insertOne(product);
            res.send(result);
        });

        app.get('/reports', async (req, res) => {
            const product = req.body;
            const result = await reportssCollection.find(product).toArray();
            res.send(result);
        });

        app.delete('/reported-products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await reportssCollection.deleteOne(filter);
            res.send(result);
        });

        app.patch('/stockout/:id', async (req, res) => {
            const id = req.params.id;
            const result = await productsCollection.updateOne({ _id: ObjectId(id) }, {
                $set: {
                    quantity: 0
                }
            })
            if (result.modifiedCount) {
                res.send(result);
            }
        })
    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send("Swap IT API is running");
})

app.listen(port, () => {
    console.log(`Swap IT API is running on PORT: ${port}`);
})
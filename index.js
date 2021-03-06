const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ajuo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//verifyJwt token
const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: 'UnAuthorized access'});
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
    if(err){
      res.status(403).send({message: 'forbiddenAccess'})
    }
    req.decoded = decoded;
    next();
  })
}

async function run(){
  try{
    await client.connect();
    const itemsCollection = client.db('ElectricItems').collection('items');
    const userCollection = client.db('ElectricItems').collection('users');
    const orderCollection = client.db('ElectricItems').collection('orders');
    const reviewCollection = client.db('ElectricItems').collection('review');
    const paymentCollection = client.db('ElectricItems').collection('payment');

    //Verify Admin
    const verifyAdmin = async(req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});
      if(requesterAccount.role === "admin"){
        next();
      }
      else{
        res.status(403).send({message: 'forbiddenAccess'})
      }
    }

    //post payment api
    app.post('/create-payment-intent', verifyJwt, async(req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price*100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //update Order and insertPayment
    app.patch('/order/:id', verifyJwt, async(req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        }
      }
      const updatedOrder = await orderCollection.updateOne(filter, updateDoc);
      const result = await paymentCollection.insertOne(payment);
      res.send(updateDoc);
    })

    //get all items
    app.get('/items', async(req, res) => {
      const query = {};
      const result = await itemsCollection.find().toArray();
      res.send(result);
    });

    //get single items using id
    app.get('/items/:id', verifyJwt, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const result = await itemsCollection.findOne(filter);
      res.send(result);
    });

    //add a new user
    app.put('/user/:email', async(req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res.send({result, token});
    });

    //update user
    app.put('/updateuser/:email', async(req, res) => {
      const email = req.params.email;
      const userupdate = req.body;
      const filter = {email: email};
      const options = { upsert: true };
      const updateDoc = {
        $set: userupdate,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send({result});
    });

    //get single users
      app.get('/user/:email', async(req, res) => {
      const email = req.params.email;
      const query = {email: email}
      const users = await userCollection.findOne(query);
      res.send(users);
    });

    //get all user
    app.get('/user', verifyJwt, async(req, res) => {
      const query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    //Delete User
    app.delete('/user/:email', verifyJwt, verifyAdmin, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    //add a order
    app.post('/order', async(req, res) => {
      const order = req.body;
      const exists = await orderCollection.findOne(order);
      if(exists){
        return res.send({success: false, order: exists})
      }
      const result = await orderCollection.insertOne(order);
      return res.send({success: true, result});
    });

    //get single orders using email
    app.get('/order', verifyJwt, async(req, res) => {
      const email = req.query.Email;
      const decodedEmail = req.decoded.email;
      if(email === decodedEmail){
        const query = {email: email};
        const orders = await orderCollection.find(query).toArray();
        return res.send(orders);
      }else{
        return res.status(403).send({message: 'forbiddenAccess'})
      }
    });

    //Delete Order
    app.delete('/order/:email', verifyJwt, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    //find single Order
    app.get('/order/:id', verifyJwt, async(req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    //add a new Admin
    app.put('/user/admin/:email', verifyJwt, verifyAdmin, async(req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});
      const filter = {email: email};
      const updateDoc = {
        $set: {role: 'admin'},
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //check admin label
    app.get('/admin/:email', async(req, res) =>{
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    });

    //add new Review
    app.post('/review', verifyJwt, async(req, res) => {
      const review = req.body;
      const exists = await reviewCollection.findOne(review);
      if(exists){
        return res.send({success: false, review: exists})
      }
      const result = await reviewCollection.insertOne(review);
      return res.send({success: true, result});
    });

    //get all review
    app.get('/review', async(req, res) => {
      const query = {};
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    //get single review using email
    app.get('/review', verifyJwt, async(req, res) => {
      const email = req.query.Email;
      const decodedEmail = req.decoded.email;
      if(email === decodedEmail){
        const query = {email: email};
        const review = await reviewCollection.find(query).toArray();
        return res.send(review);
      }else{
        return res.status(403).send({message: 'forbiddenAccess'})
      }
    });

    //Delete Review
    app.delete('/review/:email', verifyJwt, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    //add new Items
    app.post('/items', verifyJwt, verifyAdmin, async(req, res) => {
      const items = req.body;
      const exists = await itemsCollection.findOne(items);
      if(exists){
        return res.send({success: false, review: exists})
      }
      const result = await itemsCollection.insertOne(items);
      return res.send({success: true, result});
    });

    //get single items using email
    app.get('/item', verifyJwt, verifyAdmin, async(req, res) => {
      const email = req.query.Email;
      const decodedEmail = req.decoded.email;
      if(email === decodedEmail){
        const query = {email: email};
        const review = await itemsCollection.find(query).toArray();
        return res.send(review);
      }else{
        return res.status(403).send({message: 'forbiddenAccess'})
      }
    });

    //Delete Items
    app.delete('/item/:email', verifyJwt, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await itemsCollection.deleteOne(query);
      res.send(result);
    });
  }
  finally{}
}
run().catch(console.dir);

//home route from server side
app.get('/', (req, res) => {
  res.send('Hello From Electric Items');
})

//server side listening page
app.listen(port, () => {
  console.log(`Electric Items listening on Port: ${port}`);
})
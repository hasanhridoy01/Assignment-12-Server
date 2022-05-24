const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
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

    //get all items
    app.get('/items', async(req, res) => {
      const query = {};
      const result = await itemsCollection.find().toArray();
      res.send(result);
    });

    //get single items using id
    app.get('/items/:id', async(req, res) => {
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

    // app.get('/orders', async(req, res) => {
    //   const query = {};
    //   const orders = await orderCollection.find(query).toArray();
    //   res.send(orders);
    // })

    //get all orders
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
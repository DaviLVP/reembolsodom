require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new MongoClient(process.env.MONGO_URI);
let db;

// Conectar ao MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db("bancoreembolso");
    console.log("Conectado ao MongoDB!");
  } catch (err) {
    console.error("Erro ao conectar ao MongoDB:", err);
  }
}
connectDB();

// --------- Rotas de usuários ---------
app.post('/users', async (req, res) => {
  try {
    const { email, name, role, password } = req.body;
    const result = await db.collection('users').insertOne({ email, name, role, password });
    res.json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Rotas de despesas ---------
app.post('/expenses', async (req, res) => {
  try {
    const expense = req.body;
    const result = await db.collection('expenses').insertOne(expense);
    res.json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/expenses', async (req, res) => {
  try {
    const expenses = await db.collection('expenses').find().toArray();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/expenses/:id', async (req, res) => {
  try {
    const expense = await db.collection('expenses').findOne({ _id: new ObjectId(req.params.id) });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/expenses/:id', async (req, res) => {
  try {
    const updated = req.body;
    await db.collection('expenses').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updated }
    );
    res.json({ message: "Expense updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/expenses/:id', async (req, res) => {
  try {
    await db.collection('expenses').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Endpoint de login simples ---------
app.post('/login', async (req, res) => {
  try {
    const { email, password: senhaEnviada } = req.body; // renomeado para evitar conflito
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.password !== senhaEnviada) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Retorna dados do usuário sem a senha
    const { password, ...userData } = user;
    res.json(userData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// --------- Start server ---------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const upload = multer();
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

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

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
    const expense = {
      ...req.body,
      status: "pendente", // novo campo padrão
      valor_aprovado: null,
      createdAt: new Date()
    };
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

// --------- Upload de imagem ---------
app.post('/expenses/:id/receipt', upload.single('receipt'), async (req, res) => {
  try {
    const expenseId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const receiptData = {
      data: req.file.buffer,
      name: req.file.originalname,
      contentType: req.file.mimetype,
    };

    await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { $set: { receipt: receiptData } }
    );

    res.json({ message: 'Imagem salva com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Rota para exibir imagem ---------
app.get('/expenses/:id/receipt', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expense = await db.collection('expenses').findOne({ _id: new ObjectId(expenseId) });

    if (!expense || !expense.receipt) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    res.set('Content-Type', expense.receipt.contentType);
    res.send(expense.receipt.data.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Atualizar status de despesa (aprovar, reprovar, parcial) ---------
app.put('/expenses/:id/status', async (req, res) => {
  try {
    const { status, valor_aprovado } = req.body;

    if (!["pendente", "aprovado", "reprovado", "parcial"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    await db.collection('expenses').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, valor_aprovado: valor_aprovado || null } }
    );

    res.json({ message: "Status atualizado com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Listar despesas pendentes (para financeiro e sócio) ---------
app.get('/expenses/pendentes', async (req, res) => {
  try {
    const pendentes = await db.collection('expenses')
      .find({ status: "pendente" })
      .toArray();

    res.json(pendentes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Endpoint de login simples ---------
app.post('/login', async (req, res) => {
  try {
    const { email, password: senhaEnviada } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.password !== senhaEnviada) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

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

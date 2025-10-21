// index.js

// Importações (Usando CommonJS, como no seu código original)
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require = require('bcrypt'); // Note: 'bcrypt' é síncrono, 'bcryptjs' é assíncrono e comum no Node

// Configuração do Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Variáveis de conexão e DB
const uri = process.env.MONGO_URI;
const port = process.env.PORT || 3000;

let client;
let db;

/**
 * Função para conectar ao MongoDB e iniciar o servidor Express.
 */
async function startServer() {
  if (!uri) {
      console.error('❌ ERRO CRÍTICO: Variável de ambiente MONGO_URI não definida. O servidor não pode iniciar.');
      process.exit(1);
  }

  try {
    // 1. Conexão com o MongoDB
    // ✅ CORREÇÃO APLICADA PARA SSL/TLS: Adiciona as opções de SSL/TLS para funcionar no Railway/Linux
    client = new MongoClient(uri, { 
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      ssl: true,
      tlsAllowInvalidCertificates: true // Permite certificados inválidos (solução para ambiente Railway)
    });
    
    await client.connect();

    // Define o DB para o nome que você usou ("bancoreembolso")
    // Se o nome do banco estiver na URI, você pode usar client.db()
    db = client.db("bancoreembolso");
    console.log("✅ Conectado ao MongoDB!");

    // 2. Inicia o servidor Express APENAS após a conexão com o DB
    app.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
    });
  } catch (err) {
    console.error("❌ Erro ao conectar ao MongoDB:", err);
    process.exit(1); // encerra o processo se o banco falhar
  }
}

// ===================================
// ROTAS DE APLICAÇÃO
// ===================================

// Middleware para verificar se o DB está conectado antes de processar rotas
app.use((req, res, next) => {
    if (!db) {
        return res.status(503).json({ error: "Serviço indisponível: Conexão com o banco de dados falhou ou ainda não foi estabelecida." });
    }
    next();
});

// Rota de saúde (Health Check)
app.get('/', (req, res) => {
    res.status(200).send({
        status: 'OK',
        message: 'Servidor Express rodando e acessível.',
        database_status: db ? 'Conectado (Conexão MongoDB OK)' : 'Desconectado',
        port_used: port
    });
});


// --------- Rotas de usuários ---------

// POST /users: Cria um novo usuário
app.post('/users', async (req, res) => {
  try {
    const { email, name, role, password } = req.body;
    
    // Verificação básica para campos obrigatórios
    if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({ email, name, role, password_hash });
    res.status(201).json({ insertedId: result.insertedId, message: "Usuário criado com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:id: Busca um usuário por ID
app.get('/users/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "ID de usuário inválido." });
    }
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado." });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------- Rotas de despesas ---------

// POST /expenses: Cria uma nova despesa
app.post('/expenses', async (req, res) => {
  try {
    const expense = req.body;
    
    // Adicionar timestamp
    expense.createdAt = new Date();
    
    const result = await db.collection('expenses').insertOne(expense);
    res.status(201).json({ insertedId: result.insertedId, message: "Despesa registrada com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /expenses: Lista todas as despesas
app.get('/expenses', async (req, res) => {
  try {
    // Ordena por data de criação (se você adicionou um timestamp)
    const expenses = await db.collection('expenses').find().sort({ createdAt: -1 }).toArray();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /expenses/:id: Busca uma despesa por ID
app.get('/expenses/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "ID de despesa inválido." });
    }
    const expense = await db.collection('expenses').findOne({ _id: new ObjectId(req.params.id) });
    if (!expense) {
        return res.status(404).json({ error: "Despesa não encontrada." });
    }
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /expenses/:id: Atualiza uma despesa
app.put('/expenses/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "ID de despesa inválido." });
    }
    const updated = req.body;
    // Remove o campo _id caso ele venha no body para evitar erros
    delete updated._id; 
    
    const result = await db.collection('expenses').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updated }
    );
    
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Despesa não encontrada para atualização." });
    }
    
    res.json({ message: "Despesa atualizada com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /expenses/:id: Deleta uma despesa
app.delete('/expenses/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "ID de despesa inválido." });
    }
    const result = await db.collection('expenses').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Despesa não encontrada para exclusão." });
    }
    
    res.json({ message: "Despesa excluída com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Executa a função principal
startServer();
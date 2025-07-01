require('dotenv').config();
console.log("Stripe key loaded :", process.env.STRIPE_SECRET_KEY ? '****' + process.env.STRIPE_SECRET_KEY.slice(-4) : 'not found');
const express = require('express');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');

// Autoriser uniquement le frontend Vercel + Render (optionnel pour test direct)
app.use(cors({
  origin: [
    'https://stryva.vercel.app',
    'https://mon-backend-stryva.onrender.com' // à adapter si besoin
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Gérer explicitement les requêtes OPTIONS pour toutes les routes
app.options('*', cors({
  origin: [
    'https://stryva.vercel.app',
    'https://mon-backend-stryva.onrender.com'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Limiter la taille du JSON reçu
app.use(express.json({ limit: '100kb' }));

// Servir les fichiers statiques seulement si le dossier existe
if (fs.existsSync('public')) {
  app.use(express.static('public'));
}

// Transport Nodemailer (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/create-checkout-session', async (req, res) => {
  const { cart } = req.body; // [{ price: 'price_xxx', quantity: 2 }, ...]

  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty or invalid.' });
  }
  // Vérification des Price ID
  if (!cart.every(item => typeof item.price === 'string' && item.price.startsWith('price_') && item.quantity > 0)) {
    return res.status(400).json({ error: 'Invalid cart format (price or quantity).' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cart.map(item => ({
        price: item.price, // Stripe Price ID
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: 'https://stryva.vercel.app/success.html',
      cancel_url: 'https://stryva.vercel.app/cancel.html',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  const { amount, livraison } = req.body; // montant en centimes, infos livraison
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Montant invalide.' });
  }
  if (!livraison || !livraison.nom || !livraison.adresse || !livraison.cp || !livraison.ville || !livraison.email) {
    return res.status(400).json({ error: 'Informations de livraison incomplètes.' });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        nom: livraison.nom,
        adresse: livraison.adresse,
        cp: livraison.cp,
        ville: livraison.ville,
        email: livraison.email
      }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Erreur PaymentIntent :', error);
    res.status(500).json({ error: 'Erreur Stripe : ' + error.message });
  }
});

// Utilisation du port dynamique pour Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));

// Webhook Stripe pour paiement réussi (express.raw uniquement ici)
app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Erreur webhook Stripe :', err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const meta = paymentIntent.metadata || {};
    console.log('Paiement réussi pour :', meta.email || '(email inconnu)', 'Montant :', paymentIntent.amount);
    // Envoi de l'email de confirmation
    if (meta.email) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: meta.email,
        subject: 'Confirmation de votre commande STRYVA',
        text: `Merci ${meta.nom},\n\nVotre commande a bien été reçue et sera livrée à :\n${meta.adresse}, ${meta.cp} ${meta.ville}`
      };
      try {
        await transporter.sendMail(mailOptions);
        console.log('Email envoyé à', meta.email);
      } catch (error) {
        console.error('Erreur envoi email :', error);
      }
    } else {
      console.warn('Aucun email fourni dans les metadata Stripe, email non envoyé.');
    }
  }
  response.json({received: true});
});

// Gestion d'erreur 404 globale
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

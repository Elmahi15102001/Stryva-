require('dotenv').config();
console.log("clé chargée :", process.env.STRIPE_SECRET_KEY);
const express = require('express');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const nodemailer = require('nodemailer');

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

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

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cart.map(item => ({
        price: item.price, // Stripe Price ID
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: 'http://localhost:5500/success.html',
      cancel_url: 'http://localhost:5500/cancel.html',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  const { amount, livraison } = req.body; // montant en centimes, infos livraison
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        nom: livraison?.nom || '',
        adresse: livraison?.adresse || '',
        cp: livraison?.cp || '',
        ville: livraison?.ville || ''
      }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Erreur PaymentIntent :', error);
    res.status(500).json({ error: error.message });
  }
});

let stripe_price_id = 'price_1RfpsVR77l8Z8CmrdNgwXCmk';

app.listen(3000, () => console.log('Server running on http://localhost:5500'));

const panier = [
  {
    "id": "phantom",
    "nom": "STRYVA Phantom",
    "prix": 129,
    "img": "images/modele1.jpg",
    "qte": 1,
    "stripe_price_id": "price_1RfpsVR77l8Z8CmrdNgwXCmk"
  }
];

// Webhook Stripe pour paiement réussi
app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
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
    // Envoi de l'email de confirmation
    if (meta.email) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: meta.email,
        subject: 'Confirmation de votre commande STRYVA',
        text: `Merci ${meta.nom},\n\nVotre commande a bien été reçue et sera livrée à :\n${meta.adresse}, ${meta.cp} ${meta.ville}`
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.error('Erreur envoi email :', error);
        }
        console.log('Email envoyé :', info.response);
      });
    }
  }
  response.json({received: true});
});

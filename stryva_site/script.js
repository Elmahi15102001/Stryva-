// This file is intentionally left blank.
// Gestion du panier STRYVA (localStorage)
// Panier flottant et pop-up STRYVA
function getPanier() {
  return JSON.parse(localStorage.getItem('panierStryva') || '[]');
}
function setPanier(panier) {
  localStorage.setItem('panierStryva', JSON.stringify(panier));
}
function updateCartCount() {
  const panier = getPanier();
  const count = panier.reduce((acc, p) => acc + p.qte, 0);
  const el = document.getElementById('cart-count');
  if (el) el.textContent = count;
}
function renderCartPopup() {
  const panier = getPanier();
  let html = '';
  let total = 0;
  if (panier.length === 0) {
    html = '<p class="empty">Votre panier est vide.</p>';
    document.getElementById('cart-popup-total').innerHTML = '';
    document.getElementById('go-livraison').disabled = true;
  } else {
    html = '<ul>';
    panier.forEach((p, i) => {
      html += `<li><img src="${p.img}" alt="" class="img-panier"> <span>${p.nom}</span> <span>${p.prix.toFixed(2)} €</span> <span>x${p.qte}</span> <button class="del-panier" data-i="${i}">✕</button></li>`;
      total += p.prix * p.qte;
    });
    html += '</ul>';
    document.getElementById('cart-popup-total').innerHTML = `<div class="total">Total : <b>${total.toFixed(2)} €</b></div>`;
    document.getElementById('go-livraison').disabled = false;
  }
  document.getElementById('cart-popup-list').innerHTML = html;
  document.querySelectorAll('.del-panier').forEach(btn => {
    btn.onclick = function() {
      let panier = getPanier();
      panier.splice(this.dataset.i, 1);
      setPanier(panier);
      renderCartPopup();
      updateCartCount();
    };
  });
}
// Ouvre/ferme le pop-up panier
if (document.getElementById('cart-float')) {
  updateCartCount();
  document.getElementById('cart-float').onclick = function() {
    renderCartPopup();
    document.getElementById('cart-popup').classList.add('open');
  };
  document.getElementById('close-cart').onclick = function() {
    document.getElementById('cart-popup').classList.remove('open');
  };
  document.getElementById('go-livraison').onclick = function() {
    window.location.href = 'livraison.html';
  };
  // Fermer pop-up si clic hors de la fenêtre
  document.addEventListener('mousedown', function(e) {
    const popup = document.getElementById('cart-popup');
    if (popup.classList.contains('open') && !popup.contains(e.target) && !document.getElementById('cart-float').contains(e.target)) {
      popup.classList.remove('open');
    }
  });
}
// Ajout au panier depuis lunettes.html
if (document.querySelectorAll('.add-panier').length) {
  document.querySelectorAll('.add-panier').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      const nom = this.dataset.nom;
      const prix = parseFloat(this.dataset.prix);
      const img = this.dataset.img;
      // Utilise le Price ID Stripe fourni pour tous les produits
      let stripe_price_id = 'price_1RfpsVR77l8Z8CmrdNgwXCmk';
      let panier = getPanier();
      let exist = panier.find(p => p.id === id);
      if (exist) { exist.qte += 1; }
      else { panier.push({id, nom, prix, img, qte: 1, stripe_price_id}); }
      setPanier(panier);
      updateCartCount();
      this.textContent = 'Ajouté !';
      setTimeout(()=>{this.textContent='Ajouter au panier';}, 1200);
    });
  });
}
// Affichage du panier dans panier.html
if (document.getElementById('panier-list')) {
  function renderPanier() {
    let panier = getPanier();
    let html = '';
    let total = 0;
    if (panier.length === 0) {
      html = '<p class="empty">Votre panier est vide.</p>';
      document.getElementById('panier-total').innerHTML = '';
      document.getElementById('valider-commande').style.display = 'none';
    } else {
      html = '<ul class="liste-panier">';
      panier.forEach((p, i) => {
        html += `<li><img src="${p.img}" alt="" class="img-panier"> <span>${p.nom}</span> <span>${p.prix.toFixed(2)} €</span> <span>x${p.qte}</span> <button class="del-panier" data-i="${i}">✕</button></li>`;
        total += p.prix * p.qte;
      });
      html += '</ul>';
      document.getElementById('panier-total').innerHTML = `<div class="total">Total : <b>${total.toFixed(2)} €</b></div>`;
      document.getElementById('valider-commande').style.display = '';
    }
    document.getElementById('panier-list').innerHTML = html;
    // Suppression d'un produit
    document.querySelectorAll('.del-panier').forEach(btn => {
      btn.onclick = function() {
        let panier = getPanier();
        panier.splice(this.dataset.i, 1);
        setPanier(panier);
        renderPanier();
      };
    });
  }
  renderPanier();
}
// Livraison : choix du mode de livraison (point relais ou domicile)
if (document.getElementById('form-livraison')) {
  const relaisFictifs = [
    { nom: 'Mondial Relay - Paris République', adresse: '12 rue de la Paix, 75002 Paris' },
    { nom: 'Relais Colis - Paris Bastille', adresse: '8 avenue Ledru-Rollin, 75012 Paris' },
    { nom: 'Pickup Station - Paris Gare', adresse: '5 rue de Lyon, 75012 Paris' }
  ];
  // Ajout du choix mode de livraison
  const form = document.getElementById('form-livraison');
  let modeLivraison = 'relais';
  if (!document.getElementById('choix-modes')) {
    const choix = document.createElement('div');
    choix.id = 'choix-modes';
    choix.innerHTML = `
      <label class="mode-livraison"><input type="radio" name="mode" value="relais" checked> Point relais</label>
      <label class="mode-livraison"><input type="radio" name="mode" value="domicile"> Livraison à domicile</label>
    `;
    form.insertBefore(choix, form.firstChild);
  }
  form.addEventListener('change', function(e) {
    if (e.target.name === 'mode') {
      modeLivraison = e.target.value;
      if (modeLivraison === 'relais') {
        document.getElementById('cp').parentElement.style.display = '';
        document.getElementById('btn-recherche').style.display = '';
        document.getElementById('liste-relais').style.display = '';
        document.getElementById('valider-livraison').textContent = 'Valider';
      } else {
        document.getElementById('cp').parentElement.style.display = 'none';
        document.getElementById('btn-recherche').style.display = 'none';
        document.getElementById('liste-relais').style.display = 'none';
        document.getElementById('valider-livraison').textContent = 'Valider la livraison à domicile';
        document.getElementById('valider-livraison').style.display = '';
      }
    }
  });
  document.getElementById('btn-recherche').onclick = function() {
    const cp = document.getElementById('cp').value.trim();
    let html = '';
    if (/^\d{5}$/.test(cp)) {
      html = '<div class="relais-list">';
      relaisFictifs.forEach((r, i) => {
        html += `<label class="relais-item"><input type="radio" name="relais" value="${r.nom}" data-adresse="${r.adresse}"> <b>${r.nom}</b><br><span>${r.adresse}</span></label>`;
      });
      html += '</div>';
      document.getElementById('valider-livraison').style.display = '';
    } else {
      html = '<p class="error">Veuillez entrer un code postal valide.</p>';
      document.getElementById('valider-livraison').style.display = 'none';
    }
    document.getElementById('liste-relais').innerHTML = html;
  };
  form.onsubmit = function(e) {
    e.preventDefault();
    if (modeLivraison === 'relais') {
      const relais = document.querySelector('input[name="relais"]:checked');
      if (!relais) {
        alert('Veuillez sélectionner un point relais.');
        return;
      }
      window.location.href = 'paiement.html';
    } else {
      window.location.href = 'paiement.html';
    }
    // localStorage.removeItem('panierStryva'); // On vide le panier après paiement, pas ici
  };
}
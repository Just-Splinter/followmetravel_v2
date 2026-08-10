import { useEffect } from "react";

// ─── Global CSS for About Section ─────────────────────────────────────
const ABOUT_CSS = `
@keyframes aboutFadeInUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes aboutFadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes aboutFadeInRight {
  from {
    opacity: 0;
    transform: translateX(50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes aboutScaleIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes aboutFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

@keyframes aboutPulse {
  0%, 100% {
    box-shadow: 0 10px 30px rgba(255, 117, 14, 0.4);
  }
  50% {
    box-shadow: 0 15px 40px rgba(255, 117, 14, 0.6);
  }
}

@keyframes aboutShimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* ─── Section Container ─── */
.about-section {
  background: #fafaf8;
  padding: 100px 0 60px;
  position: relative;
  overflow: hidden;
}

.about-section::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -100px;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255, 117, 14, 0.05) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.about-section::after {
  content: '';
  position: absolute;
  bottom: -150px;
  left: -150px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(26, 26, 46, 0.03) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.about-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  position: relative;
  z-index: 1;
}

.about-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

/* ─── Image Area ─── */
.about-image-area {
  position: relative;
  height: 520px;
  animation: aboutFadeInLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  opacity: 0;
}

.about-img-wrap {
  position: absolute;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.about-img-wrap:hover {
  transform: scale(1.03);
}

.about-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.about-img-wrap:hover img {
  transform: scale(1.08);
}

.about-img-main {
  top: 0;
  left: 0;
  width: 72%;
  height: 70%;
  z-index: 1;
}

.about-img-secondary {
  bottom: 0;
  right: 0;
  width: 55%;
  height: 55%;
  z-index: 2;
  border: 6px solid #fff;
}

/* ─── Counter Badge ─── */
.about-counter-badge {
  position: absolute;
  top: 30%;
  right: -5%;
  background: linear-gradient(135deg, rgb(255, 117, 14), rgb(255, 140, 60));
  color: #fff;
  border-radius: 20px;
  padding: 20px 24px;
  text-align: center;
  box-shadow: 0 15px 40px rgba(255, 117, 14, 0.4);
  z-index: 3;
  animation: aboutFloat 4s ease-in-out infinite, aboutPulse 3s ease-in-out infinite;
}

.about-counter-num {
  font-size: 36px;
  font-weight: 700;
  font-family: 'Playfair Display', serif;
  display: block;
  line-height: 1;
  margin-bottom: 6px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.about-counter-label {
  font-size: 12px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 500;
  opacity: 0.95;
  letter-spacing: 0.5px;
}

/* ─── Content Area ─── */
.about-content {
  animation: aboutFadeInRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: 0.2s;
  opacity: 0;
}

.about-subtitle {
  font-size: 12px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  letter-spacing: 3px;
  color: rgb(255, 117, 14);
  text-transform: uppercase;
  margin-bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.about-subtitle::before {
  content: '';
  width: 30px;
  height: 2px;
  background: rgb(255, 117, 14);
  display: inline-block;
}

.about-title {
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.15;
  font-family: 'Playfair Display', serif;
  margin-bottom: 24px;
}

.about-title br {
  display: block;
  content: '';
  margin-top: 8px;
}

.about-description {
  font-size: 16px;
  color: #6b6b7a;
  font-family: 'DM Sans', sans-serif;
  line-height: 1.8;
  margin-bottom: 16px;
  max-width: 100%;
}

.about-description a {
  color: rgb(255, 117, 14);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
  position: relative;
}

.about-description a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 0;
  height: 2px;
  background: rgb(255, 117, 14);
  transition: width 0.3s ease;
}

.about-description a:hover::after {
  width: 100%;
}

.about-description a:hover {
  color: rgb(235, 97, 0);
}

/* ─── Check List ─── */
.about-checklist {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 32px 0;
  list-style: none;
  padding: 0;
}

.about-check-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  color: #1a1a2e;
  font-weight: 500;
  padding: 10px 14px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  cursor: default;
}

.about-check-item:hover {
  background: rgba(255, 117, 14, 0.06);
  transform: translateX(6px);
}

.about-check-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(255, 117, 14), rgb(255, 140, 60));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(255, 117, 14, 0.3);
  transition: transform 0.3s ease;
}

.about-check-item:hover .about-check-icon {
  transform: scale(1.15) rotate(10deg);
}

/* ─── CTA Button ─── */
.about-cta-btn {
  background: linear-gradient(135deg, rgb(255, 117, 14), rgb(255, 140, 60));
  color: #fff;
  border: none;
  padding: 16px 36px;
  border-radius: 40px;
  cursor: pointer;
  font-size: 15px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  letter-spacing: 0.5px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(255, 117, 14, 0.3);
}

.about-cta-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s;
}

.about-cta-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 40px rgba(255, 117, 14, 0.45);
}

.about-cta-btn:hover::before {
  transform: translateX(100%);
}

.about-cta-btn:active {
  transform: translateY(-1px);
}

.about-cta-btn .arrow {
  transition: transform 0.3s;
}

.about-cta-btn:hover .arrow {
  transform: translateX(5px);
}

/* ─── Responsive ─── */
@media (max-width: 1024px) {
  .about-row {
    grid-template-columns: 1fr;
    gap: 50px;
  }
  
  .about-image-area {
    height: 420px;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .about-content {
    text-align: center;
  }
  
  .about-subtitle {
    justify-content: center;
  }
  
  .about-checklist {
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }
}

@media (max-width: 768px) {
  .about-section {
    padding: 70px 0 40px;
  }
  
  .about-row {
    gap: 40px;
  }
  
  .about-image-area {
    height: 360px;
  }
  
  .about-img-main {
    width: 70%;
    height: 68%;
  }
  
  .about-img-secondary {
    width: 52%;
    height: 52%;
  }
  
  .about-counter-badge {
    top: 28%;
    right: -2%;
    padding: 16px 20px;
  }
  
  .about-counter-num {
    font-size: 30px;
  }
  
  .about-counter-label {
    font-size: 11px;
  }
  
  .about-title {
    font-size: clamp(28px, 5vw, 38px);
  }
  
  .about-description {
    font-size: 15px;
  }
  
  .about-checklist {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .about-check-item {
    font-size: 13px;
    padding: 10px 12px;
  }
  
  .about-cta-btn {
    padding: 14px 30px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .about-container {
    padding: 0 16px;
  }
  
  .about-image-area {
    height: 300px;
  }
  
  .about-img-main {
    width: 68%;
    height: 65%;
    border-radius: 18px;
  }
  
  .about-img-secondary {
    width: 50%;
    height: 50%;
    border-radius: 18px;
    border-width: 4px;
  }
  
  .about-counter-badge {
    padding: 14px 18px;
    border-radius: 16px;
  }
  
  .about-counter-num {
    font-size: 26px;
  }
  
  .about-title {
    font-size: 28px;
  }
  
  .about-description {
    font-size: 14px;
  }
  
  .about-check-item {
    font-size: 13px;
    gap: 10px;
  }
  
  .about-check-icon {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  .about-cta-btn {
    width: 100%;
    justify-content: center;
  }
}

/* ─── Reduced Motion ─── */
@media (prefers-reduced-motion: reduce) {
  .about-image-area,
  .about-content {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  
  .about-counter-badge {
    animation: none !important;
  }
  
  .about-img-wrap,
  .about-img-wrap img,
  .about-check-item,
  .about-check-icon,
  .about-cta-btn,
  .about-description a {
    transition: none !important;
  }
  
  .about-cta-btn::before {
    display: none;
  }
}
`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("about-global-styles")) return;
    const el = document.createElement("style");
    el.id = "about-global-styles";
    el.textContent = ABOUT_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Main About Component ─────────────────────────────────────────────
export function About({ setContactOpen }) {
  useInjectStyles();

  const checkItems = [
    "Réservation Facile",
    "Support 24/7",
    "Meilleurs Prix Garantis",
    "Paiement Online & Offline",
    "Confirmation Instantanée",
    "Deals Exclusifs",
  ];

  return (
    <section className="about-section" id="about">
      <div className="about-container">
        <div className="about-row">
          {/* Left - Images */}
          <div className="about-image-area">
            <div className="about-img-wrap about-img-main">
              <img
                src="https://www.followmetravel.ma/images/upload/1751110872168839736912548652603.webp"
                alt="About Follow Me Travel"
              />
            </div>
            <div className="about-img-wrap about-img-secondary" style={{boxShadow : 'none' , border : 0}}>
              <img
                src="/src/assets/logo.png"
                alt="Follow Me Travel Logo"
              />
            </div>
            <div className="about-counter-badge">
              <span className="about-counter-num">10+</span>
              <span className="about-counter-label">Années d'Expérience</span>
            </div>
          </div>

          {/* Right - Content */}
          <div className="about-content">
            <span className="about-subtitle">À Propos de Nous</span>
            <h2 className="about-title">
              Qualité d'Agence,
              <br />
              Prix du Web
            </h2>
            <p className="about-description">
              Follow Me Travel est une agence de voyage en ligne basée au Maroc. Elle combine le service de qualité d'une agence de rue et les prix cassés d'un site en ligne.
            </p>
            <p className="about-description" style={{ marginBottom: 24 }}>
              Pour toutes vos réservations, contactez notre centre d'appel au{" "}
              <a href="tel:+212664586425">+212 664 586 425</a> /{" "}
              <a href="tel:+212520655575">+212 520 655 575</a> ou via{" "}
              <a href="https://followmetravel.ma" target="_blank" rel="noopener noreferrer">
                followmetravel.ma
              </a>{" "}
              — réservez, confirmez et payez en ligne ou en agence.
            </p>

            <ul className="about-checklist">
              {checkItems.map((item, i) => (
                <li key={i} className="about-check-item">
                  <span className="about-check-icon">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <button className="about-cta-btn" onClick={() => setContactOpen(true)}>
              Contactez-Nous <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
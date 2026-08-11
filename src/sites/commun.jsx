import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/UI";
import GoogleAuthButton from "../components/GoogleAuthButton";

const styles = {
  // Reset & Base
  pageWrapper: {
    fontFamily: "'Playfair Display', Georgia, serif",
    color: "#1a1a2e",
    overflowX: "hidden",
    background: "#fafaf8",
  },

  // Header Top Bar
  headerTopSection: {
    background: "#1a1a2e",
    padding: "10px 0",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 20px",
  },
  headerTopWrapper: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  contactList: {
    display: "flex",
    gap: "24px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  contactListItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#c8b89a",
    fontSize: "13px",
  },
  topRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  topList: {
    display: "flex",
    gap: "16px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  topListLink: {
    color: "#c8b89a",
    textDecoration: "none",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
  },
  socialIcons: {
    display: "flex",
    gap: "10px",
  },
  socialIcon: {
    color: "#c8b89a",
    textDecoration: "none",
    fontSize: "14px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(200, 184, 154, 0.3)",
    borderRadius: "50%",
    transition: "all 0.3s",
  },

  // Sticky Header
  header: {
    background: "transparent",
    padding: "15px 0",
    position: "sticky",
    top: 0,
    zIndex: 1000,
  },
  headerMain: {
    display: "flex",
    paddingTop: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a2e",
    textDecoration: "none",
    fontFamily: "'Playfair Display', serif",
    letterSpacing: "-0.5px",
  },
  logoAccent: {
    color: "rgb(255 117 14)",
  },
  nav: {
    display: "flex",
    gap: "32px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  navLink: {
    color: "#1a1a2e",
    textDecoration: "none",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    letterSpacing: "0.3px",
    transition: "color 0.3s",
    textTransform: "uppercase",
  },
  planeShape: {
    position: "absolute",
    left: "42%",
    top: "80px"
  },
  planeShape2: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  bgShape: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  themeBtn: {
    background: "rgb(255 117 14)",
    color: "#fff",
    border: "none",
    padding: "12px 28px",
    borderRadius: "40px",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
    letterSpacing: "0.3px",
  },
  themeBtnOutline: {
    background: "transparent",
    color: "rgb(255 117 14)",
    border: "2px solid rgb(255 117 14)",
    padding: "10px 24px",
    borderRadius: "40px",
    cursor: "pointer",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
  },

  // Hero Section
  heroSection: {
    background: "linear-gradient(135deg, #f8f4ef 0%, #fdf9f5 60%, #f0ebe3 100%)",
    padding: "0px 0 60px",
    position: "relative",
    overflow: "hidden",
  },
  rightShape: {
    position: "absolute",
    top: 0,
    right: 0
  },
  leftShape: {
    position: "absolute",
    left: 0,
    top: "154px"
  },
  heroRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "60px",
    marginTop: 50,
    alignItems: "center",
  },
  heroContent: {
    zIndex: 2,
    position: "relative",
  },
  heroTitle: {
    fontSize: "clamp(32px, 5vw, 58px)",
    lineHeight: "1.1",
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: "20px",
    fontFamily: "'Playfair Display', serif",
  },
  heroTitleAccent: {
    color: "rgb(255 117 14)",
    display: "block",
  },
  heroSubtitle: {
    fontSize: "17px",
    color: "#6b6b7a",
    marginBottom: "36px",
    lineHeight: "1.7",
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "420px",
  },
  heroButtons: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "40px",
  },
  heroImageGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gridTemplateRows: "220px 180px",
    gap: "12px",
  },
  heroImg1: {
    gridRow: "1 / 3",
    borderRadius: "20px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
  },
  heroImg2: {
    borderRadius: "16px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  heroImg3: {
    borderRadius: "16px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },

  // Booking Bar
  bookingBar: {
    background: "#fff",
    borderRadius: "20px",
    padding: "20px 28px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "30px",
  },
  bookingSelect: {
    flex: 1,
    minWidth: "140px",
    padding: "12px 16px",
    border: "1.5px solid #e8e3db",
    borderRadius: "12px",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1a1a2e",
    background: "#fafaf8",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23d4853a' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "calc(100% - 12px) center",
    paddingRight: "36px",
  },

  // Section Common
  sectionPadding: {
    padding: "90px 0",
  },
  sectionTitle: {
    marginBottom: "50px",
  },
  subTitle: {
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    letterSpacing: "3px",
    color: "rgb(255 117 14)",
    textTransform: "uppercase",
    marginBottom: "12px",
    display: "block",
  },
  sectionH2: {
    fontSize: "clamp(32px, 4vw, 46px)",
    fontWeight: "700",
    color: "#1a1a2e",
    lineHeight: "1.15",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "16px",
  },
  sectionDesc: {
    fontSize: "16px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "500px",
    lineHeight: "1.7",
  },
  sectionTitleArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: "40px",
    flexWrap: "wrap",
    gap: "20px",
  },

  // Destination Cards
  destinationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "24px",
  },
  destCard: {
    borderRadius: "20px",
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
  },
  destImageWrap: {
    position: "relative",
    height: "220px",
    overflow: "hidden",
  },
  destImagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    transition: "transform 0.4s",
  },
  destStar: {
    position: "absolute",
    top: "14px",
    right: "14px",
    background: "rgb(255 117 14)",
    color: "#fff",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  destContent: {
    padding: "20px",
  },
  destTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "6px",
  },
  destListing: {
    fontSize: "13px",
    color: "rgb(255 117 14)",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
  },

  // Best Destination (Tour Packages)
  bestDestBg: {
    background: "#1a1a2e",
    padding: "90px 0",
  },
  tourCard: {
    background: "#fff",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    transition: "transform 0.3s",
  },
  tourImageWrap: {
    height: "200px",
    overflow: "hidden",
    position: "relative",
  },
  tourImagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
  },
  offerBadge: {
    position: "absolute",
    top: "14px",
    left: "14px",
    background: "#e74c3c",
    color: "#fff",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
  },
  tourContent: {
    padding: "20px",
  },
  tourMeta: {
    display: "flex",
    gap: "12px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  tourMetaItem: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  tourTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "16px",
    lineHeight: "1.3",
  },
  tourPriceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tourPrice: {
    fontSize: "22px",
    fontWeight: "700",
    color: "rgb(255 117 14)",
    fontFamily: "'Playfair Display', serif",
  },
  tourPriceSub: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
  },

  // About Section
  aboutBg: {
    background: "#fafaf8",
    backgroundImage: "url('https://webnextpro.com/tf/touro/assets/img/home-1/about/shape.png')",
    backgroundRepeat: "no-repeat",
    padding: "90px 0",
    paddingBOttom: "35px",
  },
  aboutRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "70px",
    alignItems: "center",
  },
  aboutImageArea: {
    position: "relative",
    height: "480px",
  },
  aboutImg1: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "72%",
    height: "70%",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "100px",
  },
  aboutImg2: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "55%",
    height: "55%",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px"
  },
  counterBadge: {
    position: "absolute",
    top: "30%",
    right: "-5%",
    background: "rgb(255 117 14)",
    color: "#fff",
    borderRadius: "16px",
    padding: "16px 20px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(212, 133, 58, 0.4)",
    zIndex: 3,
  },
  counterNum: {
    fontSize: "32px",
    fontWeight: "700",
    fontFamily: "'Playfair Display', serif",
    display: "block",
    lineHeight: 1,
  },
  counterLabel: {
    fontSize: "11px",
    fontFamily: "'DM Sans', sans-serif",
    opacity: 0.9,
    marginTop: "4px",
  },
  checkList: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    margin: "28px 0",
    listStyle: "none",
    padding: 0,
  },
  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    color: "#1a1a2e",
    fontWeight: "500",
  },
  checkIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    flexShrink: 0,
  },

  // Adventures
  adventureBg: {
    background: "#1a1a2e",
    padding: "90px 0",
    position: "relative",
    overflow: "hidden",
  },
  adventureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "16px",
    marginTop: "50px",
  },
  adventureCard: {
    borderRadius: "16px",
    overflow: "hidden",
    position: "relative",
    cursor: "pointer",
    transition: "transform 0.3s",
  },
  adventureImgWrap: {
    height: "280px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px",
    position: "relative",
  },
  adventureOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(transparent, rgba(26,26,46,0.9))",
    padding: "30px 16px 16px",
  },
  adventureTitle: {
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    lineHeight: "1.3",
  },

  // Counter Section
  counterSection: {
    background: "#fff",
    padding: "70px 0",
    borderTop: "1px solid #f0ebe3",
    borderBottom: "1px solid #f0ebe3",
  },
  counterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "30px",
  },
  counterBox: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "24px",
    background: "#fafaf8",
    borderRadius: "16px",
    border: "1px solid #f0ebe3",
  },
  counterIconWrap: {
    width: "56px",
    height: "56px",
    borderRadius: "16px",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
    flexShrink: 0,
  },
  counterBoxNum: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    lineHeight: 1,
    marginBottom: "4px",
  },
  counterBoxLabel: {
    fontSize: "13px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
  },

  // CTA Offer
  ctaOfferBg: {
    backgroundImage: "url(https://webnextpro.com/tf/touro/assets/img/home-1/cta/bg.jpg)",
    padding: "90px 0",
    position: "relative",
    overflow: "hidden",
  },
  ctaRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "60px",
    alignItems: "center",
  },
  ctaImagesGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "12px",
    height: "360px",
  },
  ctaImg1: {
    borderRadius: "20px",
    background: "linear-gradient(135deg, #6b9fbd, #3d7a9c)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    gridRow: "1/3",
  },
  ctaImg2: {
    borderRadius: "16px",
    background: "linear-gradient(135deg, #88c9a1, #4da870)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  ctaImg3: {
    borderRadius: "16px",
    background: "linear-gradient(135deg, #c8a882, #9b7c5a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "60px",
  },
  discountCircle: {
    position: "absolute",
    bottom: "30px",
    left: "20px",
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "'Playfair Display', serif",
    boxShadow: "0 10px 30px rgba(212,133,58,0.5)",
  },

  // Team Section
  teamBg: {
    background: "#fafaf8",
    padding: "90px 0",
  },
  teamGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "24px",
    marginTop: "50px",
  },
  teamCard: {
    background: "#fff",
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "transform 0.3s",
    textAlign: "center",
  },
  teamImgWrap: {
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    position: "relative",
    overflow: "hidden",
  },
  teamSocialOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(26,26,46,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    opacity: 0,
    transition: "opacity 0.3s",
  },
  teamContent: {
    padding: "16px 20px 20px",
  },
  teamName: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "4px",
  },
  teamRole: {
    fontSize: "13px",
    color: "rgb(255 117 14)",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "500",
  },

  // Testimonials
  testimonialBg: {
    background: "#1a1a2e",
    padding: "90px 0",
  },
  testimonialRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "60px",
    alignItems: "start",
  },
  testimonialGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  testimonialCard: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "24px",
    backdropFilter: "blur(10px)",
  },
  testimonialClientRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  clientInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  clientAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgb(255 117 14), #e8a060)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  clientName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
  },
  clientRole: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.5)",
    fontFamily: "'DM Sans', sans-serif",
  },
  testimonialText: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.7)",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.7",
    marginBottom: "16px",
  },
  stars: {
    display: "flex",
    gap: "4px",
    color: "rgb(255 117 14)",
    fontSize: "13px",
  },

  // News / Blog
  newsBg: {
    background: "#fff",
    padding: "90px 0",
  },
  newsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "28px",
    marginTop: "40px",
  },
  newsCard: {
    borderRadius: "20px",
    overflow: "hidden",
    background: "#fafaf8",
    border: "1px solid #f0ebe3",
    transition: "transform 0.3s, box-shadow 0.3s",
    cursor: "pointer",
  },
  newsImgWrap: {
    height: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "80px",
    overflow: "hidden",
  },
  newsContent: {
    padding: "22px",
  },
  newsMeta: {
    display: "flex",
    gap: "12px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  newsMetaItem: {
    fontSize: "12px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  newsTag: {
    background: "rgb(255 117 14)",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
  },
  newsTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "10px",
    lineHeight: "1.4",
  },
  newsExcerpt: {
    fontSize: "14px",
    color: "#6b6b7a",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.6",
    marginBottom: "16px",
  },

  // Gallery
  galleryBg: {
    background: "#fafaf8",
    padding: "90px 0",
  },
  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gridTemplateRows: "220px 220px",
    gap: "14px",
  },
  galleryItem: {
    borderRadius: "16px",
    overflow: "hidden",
    cursor: "pointer",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "70px",
    transition: "transform 0.3s",
  },

  // CTA Banner
  ctaBanner: {
    background: "rgb(255 117 14)",
    padding: "80px 0",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  },
  ctaBannerTitle: {
    fontSize: "clamp(36px, 5vw, 56px)",
    fontWeight: "700",
    color: "#fff",
    fontFamily: "'Playfair Display', serif",
    marginBottom: "20px",
    lineHeight: "1.15",
  },
  ctaBannerSubtitle: {
    fontSize: "16px",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "36px",
    maxWidth: "500px",
    margin: "0 auto 36px",
    lineHeight: "1.7",
  },
  ctaBannerBtn: {
    background: "#fff",
    color: "rgb(255 117 14)",
    border: "none",
    padding: "16px 40px",
    borderRadius: "40px",
    fontSize: "15px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.3s",
  },

  // Footer
  footer: {
    background: "#0f0f1e",
    padding: "70px 0 0",
    color: "#c8b89a",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
    gap: "50px",
    marginBottom: "50px",
  },
  footerLogo: {
    fontSize: "28px",
    fontFamily: "'Playfair Display', serif",
    color: "#fff",
    marginBottom: "16px",
    display: "block",
    textDecoration: "none",
  },
  footerDesc: {
    fontSize: "14px",
    color: "rgba(200,184,154,0.7)",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.7",
    marginBottom: "24px",
  },
  footerContact: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "28px",
  },
  footerContactItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#c8b89a",
    fontFamily: "'DM Sans', sans-serif",
  },
  footerHeading: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "20px",
    paddingBottom: "12px",
    borderBottom: "2px solid rgb(255 117 14)",
    display: "inline-block",
  },
  footerLinks: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  footerLink: {
    fontSize: "14px",
    color: "rgba(200,184,154,0.7)",
    textDecoration: "none",
    fontFamily: "'DM Sans', sans-serif",
    transition: "color 0.3s",
  },
  footerNewsletter: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  footerInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "40px",
    border: "1px solid rgba(200,184,154,0.3)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  },
  footerBottom: {
    borderTop: "1px solid rgba(200,184,154,0.15)",
    padding: "24px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  footerCopy: {
    fontSize: "13px",
    color: "rgba(200,184,154,0.5)",
    fontFamily: "'DM Sans', sans-serif",
  },

  // Back to top
  backToTop: {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    background: "rgb(255 117 14)",
    color: "#fff",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 20px rgba(212,133,58,0.4)",
    zIndex: 999,
    transition: "all 0.3s",
  },

  // Brands
  brandsBg: {
    background: "#fff",
    padding: "50px 0",
    borderBottom: "1px solid #f0ebe3",
  },
  brandsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "48px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "20px",
  },
  brandItem: {
    fontSize: "20px",
    fontFamily: "'Playfair Display', serif",
    color: "#c8b89a",
    fontWeight: "700",
    letterSpacing: "2px",
    transition: "color 0.3s",
    cursor: "default",
  },
};





export function NavLink({ href, children }) {
  return (
    <a href={href} style={styles.navLink} onMouseEnter={e => e.target.style.color = "rgb(255 117 14)"} onMouseLeave={e => e.target.style.color = "#1a1a2e"}>
      {children}
    </a>
  );
}



export function Header() {
  return (
    <header>
      <div style={styles.container}>
        <div style={styles.headerMain}>
          <a href="/" style={styles.logo}>
            <img
              src="./src/assets/logo.png"
              alt="Logo"
              style={{ width: 130 }}
            />
          </a>

          <Navigation />

          <GoogleAuthButton />
        </div>
      </div>
    </header>
  );
}

export function Navigation() {
  return (
    <nav>
      <ul style={styles.nav}>
        <li><NavLink href="/#">Home</NavLink></li>
        <li><NavLink href="/#about">About Us</NavLink></li>
        <li><NavLink href="/#destination">Destination</NavLink></li>
        <li><NavLink href="/#testimonial">Testimonial</NavLink></li>
        <li><NavLink href="/#blog">Blog</NavLink></li>
      </ul>
    </nav>
  );
}



export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, [pathname, search]);

  return null;
}


// ─── Inject Global Animations & Responsive CSS ────────────────────
const HERO_CSS = `
`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("hero-global-styles")) return;
    const el = document.createElement("style");
    el.id = "hero-global-styles";
    el.textContent = HERO_CSS;
    document.head.appendChild(el);
  }, []);
}

// ─── Animated Hero Image (rotating gallery) ───────────────────────
function AnimatedHeroImage({ images, style, duration = 3500, className = "" }) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % images.length);
        setFade(true);
      }, 400);
    }, duration);
    return () => clearInterval(interval);
  }, [images, duration]);

  const src = images[index];

  return (
    <div style={style} className={className}>
      <img
        src={src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "opacity 0.5s ease",
          opacity: fade ? 1 : 0,
        }}
      />
    </div>
  );
}

// ─── Main Hero Component ──────────────────────────────────────────
export function Hero() {
  useInjectStyles();

  const gallery1 = [
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/01.jpg",
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/02.jpg",
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/03.jpg",
  ];

  const gallery2 = [
    "https://res.cloudinary.com/worldpackers/image/upload/c_fill,f_auto,q_auto,w_1024/v1/guides/article_cover/hseagnarcvkfz26va5v9",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSoQnyMnYT4Vt2zVrCsfiEc3EW9KGKsknosTg&s",
    "https://miro.medium.com/0*qcxGhi5OlE9HypMN",
  ];

  const gallery3 = [
    "https://travel-savvy.timeandplace.com/wp-content/uploads/2019/08/Adventure-or-Leisure-Blog-710x474@2x.jpg",
    "https://www.responsiblevacation.com/imagesClient/34012_1448.jpg",
    "https://lesroches.edu/wp-content/uploads/2024/02/ATHeader.jpg",
  ];

  return (
    <>
      <Header />

      <section className="hero-section">
        {/* Decorative shapes */}
        <div className="hero-shape hero-shape-right">
          <img
            src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-2.png"
            alt=""
          />
        </div>
        <div className="hero-shape hero-shape-left">
          <img
            src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-4.png"
            alt=""
          />
        </div>
        <div className="hero-shape hero-shape-plane">
          <img
            src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/plane.png"
            alt=""
          />
        </div>
        <div className="hero-shape hero-shape-bottom">
          <img
            src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-1.png"
            alt=""
          />
        </div>

        <div className="hero-container">
          <div className="hero-row">
            {/* Left - Content */}
            <div>
              <div className="hero-animate-up hero-delay-1">
                <span className="hero-subtitle">🌍 Start Your Journey</span>
              </div>

              <h1 className="hero-title hero-animate-up hero-delay-2">
                Your AI Travel Agent
                <span className="hero-title-accent">Plans Smarter Trips</span>
              </h1>

              <p className="hero-description hero-animate-up hero-delay-3">
                Discover extraordinary destinations with personalized itineraries
                crafted by AI. Let us turn your travel dreams into unforgettable
                memories.
              </p>

              <div className="hero-buttons hero-animate-up hero-delay-4">
                <a href="/tours" className="hero-btn-primary">
                  Explore Tours <span className="arrow">→</span>
                </a>
                <a href="/about" className="hero-btn-outline">
                  Learn More
                </a>
              </div>

              <div className="hero-stats hero-animate-up hero-delay-5">
                {/* <div className="hero-stat">
                  <div className="hero-stat-num">
                    500<span>+</span>
                  </div>
                  <div className="hero-stat-label">Destinations</div>
                </div>
                <div className="hero-stat">
                  <div className="hero-stat-num">
                    10K<span>+</span>
                  </div>
                  <div className="hero-stat-label">Happy Travelers</div>
                </div>
                <div className="hero-stat">
                  <div className="hero-stat-num">
                    4.9<span>★</span>
                  </div>
                  <div className="hero-stat-label">Average Rating</div>
                </div> */}
              </div>
            </div>

            {/* Right - Image Grid */}
            <div className="hero-animate-right hero-delay-3">
              <div className="hero-image-grid">
                <AnimatedHeroImage
                  images={gallery1}
                  style={{ borderRadius: 20, overflow: "hidden" }}
                  duration={3200}
                  className="hero-img-wrap hero-img-main"
                />

                <AnimatedHeroImage
                  images={gallery2}
                  style={{ borderRadius: 16, overflow: "hidden" }}
                  duration={3800}
                  className="hero-img-wrap"
                />

                <div className="hero-img-wrap" style={{ position: "relative" }}>
                  <AnimatedHeroImage
                    images={gallery3}
                    style={{ borderRadius: 16, overflow: "hidden", height : '100%' }}
                    duration={4200}
                  />
                  {/* <div className="hero-img-badge">
                    <div className="hero-img-badge-icon">✓</div>
                    <div className="hero-img-badge-text">
                      <div className="hero-img-badge-num">2,500+</div>
                      <div className="hero-img-badge-label">Tours Completed</div>
                    </div>
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function Hero1() {

  const gallery1 = [
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/01.jpg",
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/02.jpg",
    "https://webnextpro.com/tf/touro/assets/img/home-1/hero/03.jpg",
  ];

  const gallery2 = [
    "https://res.cloudinary.com/worldpackers/image/upload/c_fill,f_auto,q_auto,w_1024/v1/guides/article_cover/hseagnarcvkfz26va5v9?_a=BACAGSGT",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSoQnyMnYT4Vt2zVrCsfiEc3EW9KGKsknosTg&s",
    "https://miro.medium.com/0*qcxGhi5OlE9HypMN",
  ];

  const gallery3 = [
    "https://travel-savvy.timeandplace.com/wp-content/uploads/2019/08/Adventure-or-Leisure-Blog-710x474@2x.jpg",
    "https://www.responsiblevacation.com/imagesClient/34012_1448.jpg",
    "https://lesroches.edu/wp-content/uploads/2024/02/ATHeader.jpg",
  ];

  return (
    <>
      <Header></Header>
       
      <section style={styles.heroSection}>
        <div style={styles.rightShape}>
          <img src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-2.png" alt="img"></img>
        </div>
        <div style={styles.leftShape}>
          <img src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-4.png" alt="img"></img>
        </div>
        <div style={styles.planeShape}>
          <img src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/plane.png" alt="img"></img>
        </div>
        <div style={styles.planeShape2}>
          <img src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/shape-1.png" alt="img"></img>
        </div>

        <div style={styles.container}>
          <div style={styles.heroRow}>
            <div style={styles.heroContent}>
              <span style={styles.subTitle}>🌍 Start Your Journey</span>
              <h1 style={styles.heroTitle}>
                Your AI Travel Agent
                <span style={styles.heroTitleAccent}>Plans Smarter Trips</span>
              </h1>
            </div>
            <div>
              <div style={styles.heroImageGrid}>
                <AnimatedHeroImage
                  images={gallery1}
                  style={styles.heroImg1}
                  duration={3200}
                />

                <AnimatedHeroImage
                  images={gallery2}
                  style={styles.heroImg2}
                  duration={3800}
                />

                <AnimatedHeroImage
                  images={gallery3}
                  style={styles.heroImg3}
                  duration={4200}
                />
              </div>
               
            </div>
          </div>
        </div>

        <div style={styles.bgShape}>
          <img src="https://webnextpro.com/tf/touro/assets/img/home-1/hero/bg-shape-2.png" alt="img"></img>
        </div>

      </section>
    </>

  )
}

// Card language matches the Foxico hero: image-forward, 16px radius, Poppins,
// white label over a navy gradient, orange accents.
export function DestinationCard({ dest }) {
  const [hover, setHover] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onClick={() => {
        navigate(`/search?dest=${dest.$id}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: "100%",
        height: 440,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        fontFamily: "'Poppins', sans-serif",
        transition: "transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s",
        transform: hover ? "translateY(-10px)" : "translateY(0px)",
        boxShadow: hover
          ? "0 30px 60px rgba(26,26,46,.22)"
          : "0 16px 36px rgba(26,26,46,.12)",
      }}
    >
      <img
        src={dest.emoji}
        alt={dest.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "transform 1s cubic-bezier(.22,1,.36,1)",
          transform: hover ? "scale(1.08)" : "scale(1)",
        }}
      />

      {/* Navy gradient, same family as the hero overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(10,12,28,.82) 0%, rgba(10,12,28,.28) 38%, rgba(10,12,28,0) 62%)",
        }}
      />

      {/* Rating pill — echoes the hero bookmark chip */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "#fff",
          borderRadius: 12,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 6px 16px rgba(0,0,0,.18)",
          transition: ".3s",
          transform: hover ? "scale(1.05)" : "scale(1)",
        }}
      >
        <span style={{ color: "#ff750e", fontSize: 15, lineHeight: 1 }}>★</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>
          {dest.rating || "5"}
        </span>
      </div>

      {/* Label block, hero-card style */}
      <div style={{ position: "absolute", left: 22, right: 22, bottom: 20 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: "-0.3px",
            textShadow: "0 2px 10px rgba(0,0,0,.35)",
          }}
        >
          {dest.name}
        </h3>
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 13,
            color: "rgba(255,255,255,.78)",
          }}
        >
          {dest.listing} séjours disponibles
        </p>

        <div
          style={{
            display: "flex",
            marginTop: 14,
            maxHeight: hover ? 44 : 0,
            opacity: hover ? 1 : 0,
            transform: hover ? "translateY(0)" : "translateY(8px)",
            transition: ".4s cubic-bezier(.22,1,.36,1)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #ff750e, #ff8c3c)",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 10px 22px rgba(255,117,14,.4)",
            }}
          >
            Explorer →
          </span>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");

  return (<footer style={styles.footer}>
    <div style={styles.container}>
      <div style={styles.footerGrid}>
        {/* Brand */}
        <div>
          <a href="#" style={styles.footerLogo}><img src="./src/assets/logo.png" style={{ width: 200 }}></img></a>
          <div style={styles.footerContact}>
            <div style={styles.footerContactItem}><span style={{ fontSize: "16px" }}>📞</span><div><span style={{ display: "block", fontSize: "11px", opacity: 0.5, marginBottom: "2px" }}>Appelez-nous</span><a href="tel:+212664586425" style={{ color: "#c8b89a", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>+212 664 586 425</a></div></div>
            <div style={styles.footerContactItem}><span style={{ fontSize: "16px" }}>📞</span><div><span style={{ display: "block", fontSize: "11px", opacity: 0.5, marginBottom: "2px" }}>Appelez-nous</span><a href="tel:+212520655575" style={{ color: "#c8b89a", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>+212 520 655 575</a></div></div>
            <div style={styles.footerContactItem}><span style={{ fontSize: "16px" }}>✉</span><div><span style={{ display: "block", fontSize: "11px", opacity: 0.5, marginBottom: "2px" }}>Écrivez-nous</span><a href="mailto:contact@followmetravel.ma" style={{ color: "#c8b89a", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>contact@followmetravel.ma</a></div></div>
          </div>
        </div>

        {/* Top Destinations */}
        <div>
          <div style={styles.footerHeading}>Top Destinations</div>
          <ul style={styles.footerLinks}>
            {["Voyage au Maroc", "Voyage Emirate", "Turquie", "Egypte", "Malaisie & Indonésie", "Espagne"].map((l, i) => (
              <li key={i}><a href="#" style={styles.footerLink}>{l}</a></li>
            ))}
          </ul>
        </div>

        {/* À propos */}
        <div>
          <div style={styles.footerHeading}>À propos</div>
          <ul style={styles.footerLinks}>
            {["Qui Sommes Nous ?", "Conditions générale de vente", "MICE"].map((l, i) => (
              <li key={i}><a href="#" style={styles.footerLink}>{l}</a></li>
            ))}
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <div style={styles.footerHeading}>Newsletter</div>
          <p style={{ fontSize: "14px", color: "rgba(200,184,154,0.6)", fontFamily: "'DM Sans', sans-serif", marginBottom: "16px", lineHeight: "1.6" }}>
            Abonnez-vous pour recevoir les meilleures offres de voyage directement dans votre boîte mail.
          </p>
          <div style={styles.footerNewsletter}>
            <input
              type="email"
              placeholder="Votre adresse email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.footerInput}
            />
            <Button style={{ ...styles.themeBtn, padding: "12px 20px", flexShrink: 0 }}>→</Button>
          </div>
        </div>
      </div>

      <div style={styles.footerBottom}>
        <p style={styles.footerCopy}>© 2025 Follow Me Travel. Tous droits réservés.</p>
        <div style={{ display: "flex", gap: "20px" }}>
          {["Politique de confidentialité", "Conditions d'utilisation", "Politique des cookies"].map((l, i) => (
            <a key={i} href="#" style={{ fontSize: "13px", color: "rgba(200,184,154,0.5)", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  </footer>)
}
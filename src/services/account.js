// Compte et session — remplace services/appwrite.js (SDK Appwrite `Account`).
// `account` garde les noms de méthodes Appwrite qu'utilisent AuthContext et
// AuthCallback ; les helpers nommés sont ceux de l'ancien appwrite.js.
import { API_URL, request } from "./api";

export const account = {
  /** Utilisateur connecté ({ $id, name, email, labels, prefs… }) ; rejette (401) sinon. */
  get: () => request("GET", "/v1/account"),

  createEmailPasswordSession: (email, password) =>
    request("POST", "/v1/account/sessions/email", { body: { email, password } }),

  deleteSession: () => request("DELETE", "/v1/account/sessions/current"),

  /** Navigation pleine page vers Google ; l'API redirige ensuite vers success/failure. */
  createOAuth2Session: (provider, success, failure) => {
    const url = new URL(`${API_URL}/v1/account/sessions/oauth2/${provider}`);
    url.searchParams.set("success", success);
    url.searchParams.set("failure", failure);
    window.location.href = url.toString();
  },

  getPrefs: () => request("GET", "/v1/account/prefs"),

  updatePrefs: (prefs) => request("PATCH", "/v1/account/prefs", { body: { prefs } }),

  createRecovery: (email, url) => request("POST", "/v1/account/recovery", { body: { email, url } }),

  updateRecovery: (userId, secret, password) =>
    request("PUT", "/v1/account/recovery", { body: { userId, secret, password } }),
};

export const getUserData = () => account.get();

export const login = (email, password) => account.createEmailPasswordSession(email, password);

export const logout = () => account.deleteSession();

// Envoie l'email « réinitialiser votre mot de passe » — admin et site public
// (même système de comptes, l'admin a juste le label "admin"). `redirectUrl`
// doit être sur une origine de FRONT_ORIGINS côté API.
export const requestPasswordRecovery = (email, redirectUrl) => account.createRecovery(email, redirectUrl);

// Termine la réinitialisation depuis le lien de l'email : userId/secret sont
// dans la query string, comme avec Appwrite.
export const confirmPasswordRecovery = (userId, secret, password) =>
  account.updateRecovery(userId, secret, password);

export const getPrefs = () => account.getPrefs();

// Remplace l'objet prefs entier — les appelants fusionnent eux-mêmes avec
// les prefs actuelles, cette fonction ne modifie pas une clé isolée.
export const updatePrefs = (prefs) => account.updatePrefs(prefs);

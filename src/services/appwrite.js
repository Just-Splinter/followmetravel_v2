import { Account, Client } from "appwrite"

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);

export const getUserData = async () => {
  try {
    return await account.get()
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

export const login = async (email, password) => {
  try {
    return await account.createEmailPasswordSession(email, password)
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

export const logout = async () => {
  try {
    return await account.deleteSession('current')
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

export const register = async (email, password) => {
  try {
    return await account.create('unique()', email, password)
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

// Sends the "reset your password" email — used by both the admin login and
// the public site (same Account/session system, admin is just a user with
// the "admin" label). `redirectUrl` must be a URL Appwrite is configured to
// allow (Auth > Security > Redirect URLs in the console).
export const requestPasswordRecovery = async (email, redirectUrl) => {
  try {
    return await account.createRecovery(email, redirectUrl)
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

// Completes the reset from the link in that email: userId/secret come from
// the URL's query string, appended by Appwrite.
export const confirmPasswordRecovery = async (userId, secret, password) => {
  try {
    return await account.updateRecovery(userId, secret, password)
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

export const getPrefs = async () => {
  try {
    return await account.getPrefs()
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

// Appwrite replaces the whole prefs object on write — callers must merge
// with the current prefs themselves, this does not patch individual keys.
export const updatePrefs = async (prefs) => {
  try {
    return await account.updatePrefs(prefs)
  } catch (error) {
    throw new Error(error.message, { cause: error })
  }
}

export default client;
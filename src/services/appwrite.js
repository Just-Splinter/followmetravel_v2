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

export default client;
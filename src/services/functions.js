import { Functions } from "appwrite";
import { client } from "./appwrite";

class FunctionService {
  constructor(client) {
    this.functions = new Functions(client);
  }

  async execute(functionId, payload = {}, options = {}) {
    const {
      parseResponse = true,
    } = options;

    try {
      const execution = await this.functions.createExecution(
        functionId,
        JSON.stringify(payload)
      );

      if (!parseResponse) return execution;

      // Appwrite met souvent le résultat dans responseBody
      if (execution?.responseBody) {
        try {
          return JSON.parse(execution.responseBody);
        } catch {
          return execution.responseBody;
        }
      }

      return execution;
    } catch (error) {
      console.error(`[FunctionService] ${functionId} failed`, error);
      throw error;
    }
  }

  // helper optionnel (syntactic sugar)
  bind(functionId) {
    return (payload, options) =>
      this.execute(functionId, payload, options);
  }
}

const functionService = new FunctionService(client);

export default functionService;
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
      let body;
      if (execution?.responseBody) {
        try {
          body = JSON.parse(execution.responseBody);
        } catch {
          body = execution.responseBody;
        }
      }

      // createExecution() resolves even when the function itself crashed,
      // timed out, or errored — it only rejects on request-level failures
      // (auth, network, unknown function id). A crashed/failed run must be
      // surfaced as an error here, otherwise it silently returns whatever
      // scraps ended up in responseBody (often empty) and callers read it
      // as a non-error, non-success value with no diagnostic at all.
      const failed = execution?.status === "failed" || execution?.responseStatusCode >= 400;
      if (failed) {
        const message =
          (body && typeof body === "object" && body.message) ||
          (typeof body === "string" && body) ||
          `Function execution failed (status: ${execution?.status}, HTTP ${execution?.responseStatusCode})`;
        throw new Error(message);
      }

      return body ?? execution;
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
import { HttpException } from "@nestjs/common";

/**
 * Erreur au format Appwrite ({ message, code, type }) : le front lit
 * `err.message` partout et `err.cause.type` à quelques endroits (LoginPage),
 * on garde donc la même forme pour ne rien changer côté React.
 */
export class ApiError extends HttpException {
  constructor(code: number, type: string, message: string) {
    super({ message, code, type }, code);
  }
}

export const unauthorized = (message = "Authentification requise.") =>
  new ApiError(401, "user_unauthorized", message);

export const forbidden = (message = "Action non autorisée.") =>
  new ApiError(403, "user_unauthorized", message);

export const notFound = (type: string, message: string) => new ApiError(404, type, message);

export const badRequest = (message: string, type = "general_argument_invalid") =>
  new ApiError(400, type, message);

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./appwrite", () => ({ client: {} }));

const createExecution = vi.fn();
vi.mock("appwrite", () => ({
  Functions: vi.fn().mockImplementation(function () {
    this.createExecution = createExecution;
  }),
}));

// Imported after the mocks above so the module picks them up.
const { default: functionService } = await import("./functions");

describe("FunctionService.execute", () => {
  beforeEach(() => {
    createExecution.mockReset();
  });

  it("returns the parsed responseBody on a completed execution", async () => {
    createExecution.mockResolvedValue({
      status: "completed",
      responseStatusCode: 200,
      responseBody: JSON.stringify({ success: true, reservation: { $id: "r1" } }),
    });

    const result = await functionService.execute("fn-id", { a: 1 });

    expect(result).toEqual({ success: true, reservation: { $id: "r1" } });
  });

  it("throws when the execution status is 'failed', instead of returning silently", async () => {
    // Appwrite resolves createExecution() even when the function itself
    // crashed — it does not reject the promise. responseBody is frequently
    // empty in this case (see Models.Execution docs).
    createExecution.mockResolvedValue({
      status: "failed",
      responseStatusCode: 500,
      responseBody: "",
    });

    await expect(functionService.execute("fn-id", {})).rejects.toThrow();
  });

  it("throws with the function's own error message when the body carries one", async () => {
    createExecution.mockResolvedValue({
      status: "completed",
      responseStatusCode: 400,
      responseBody: JSON.stringify({ success: false, message: "Créneau complet" }),
    });

    await expect(functionService.execute("fn-id", {})).rejects.toThrow("Créneau complet");
  });

  it("still throws on a 5xx response even if Appwrite reports status 'completed'", async () => {
    createExecution.mockResolvedValue({
      status: "completed",
      responseStatusCode: 502,
      responseBody: "",
    });

    await expect(functionService.execute("fn-id", {})).rejects.toThrow();
  });

  it("propagates request-level failures (network, auth, unknown function id)", async () => {
    createExecution.mockRejectedValue(new Error("Function not found"));

    await expect(functionService.execute("fn-id", {})).rejects.toThrow("Function not found");
  });
});

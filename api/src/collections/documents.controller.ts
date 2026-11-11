import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { toCaller } from "../auth/users";
import { DocumentsService } from "./documents.service";
import { parseQueries } from "./query";

/**
 * Mêmes chemins que l'API Appwrite `databases`, sans l'id de base :
 * le front (services/database.js) garde create/get/list/update/delete.
 */
@Controller("v1/collections/:collection/documents")
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list(@Param("collection") collection: string, @Query("queries") queries: unknown, @Req() req: Request) {
    return this.docs.list(collection, parseQueries(queries), toCaller(req.user));
  }

  @Get(":id")
  get(@Param("collection") collection: string, @Param("id") id: string, @Req() req: Request) {
    return this.docs.get(collection, id, toCaller(req.user));
  }

  @Post()
  create(@Param("collection") collection: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.docs.create(collection, body.documentId, body.data, toCaller(req.user));
  }

  @Patch(":id")
  update(
    @Param("collection") collection: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.docs.update(collection, id, body.data ?? {}, toCaller(req.user));
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("collection") collection: string, @Param("id") id: string, @Req() req: Request) {
    await this.docs.delete(collection, id, toCaller(req.user));
  }
}

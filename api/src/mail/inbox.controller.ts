import { Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { unauthorized } from "../common/errors";
import { InboxService } from "./inbox.service";

/** Boîte de réception du client connecté (ses messages uniquement). */
@Controller("v1/inbox")
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@Req() req: Request) {
    if (!req.user) throw unauthorized();
    return this.inbox.list(req.user);
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@Req() req: Request, @Param("id") id: string) {
    if (!req.user) throw unauthorized();
    return this.inbox.markRead(req.user, id);
  }
}

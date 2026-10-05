import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../middleware/auth";
import { badRequest, unauthorized } from "../errors";
import { logger } from "../logger";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("用户名或密码格式不正确");
    const { username, password } = parsed.data;
    const user = await prisma.adminUser.findUnique({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      logger.warn("login_failed", { username });
      throw unauthorized("用户名或密码错误");
    }
    const token = signToken({ id: user.id, username: user.username });
    logger.info("login_success", { username });
    res.json({ token, username: user.username });
  } catch (err) {
    next(err);
  }
});

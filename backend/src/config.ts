export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: "12h",
  databaseUrl: process.env.DATABASE_URL || "mysql://root:root@localhost:3306/brandspec"
};

if (!config.jwtSecret) {
  // 开发兜底：允许启动但打印醒目警告；生产必须通过环境变量注入
  config.jwtSecret = "brandspec-dev-only-secret";
  process.env.BRANDSPEC_INSECURE_SECRET = "1";
}

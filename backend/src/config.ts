export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbType: (process.env.DB_TYPE ?? "mysql") as "mysql" | "sqljs",
  db: {
    host: process.env.DB_HOST ?? "db",
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "root",
    database: process.env.DB_NAME ?? "brand"
  },
  adminUser: process.env.ADMIN_USER ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "123456",
  tokenSecret: process.env.TOKEN_SECRET ?? "brand-spec-dev-secret",
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS ?? 12 * 3600)
};

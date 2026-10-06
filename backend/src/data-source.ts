import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { Asset, Brand, BrandVersion, Project, PublishEvent } from "./entities/entities";

export const ENTITIES = [Brand, BrandVersion, Project, Asset, PublishEvent];

export function createDataSource(override?: { type?: "mysql" | "sqljs" }): DataSource {
  const type = override?.type ?? config.dbType;
  if (type === "sqljs") {
    return new DataSource({
      type: "sqljs",
      autoSave: false,
      synchronize: true,
      logging: false,
      entities: ENTITIES
    });
  }
  return new DataSource({
    type: "mysql",
    host: config.db.host,
    port: config.db.port,
    username: config.db.username,
    password: config.db.password,
    database: config.db.database,
    synchronize: true,
    logging: false,
    entities: ENTITIES,
    charset: "utf8mb4"
  });
}

export const AppDataSource = createDataSource();

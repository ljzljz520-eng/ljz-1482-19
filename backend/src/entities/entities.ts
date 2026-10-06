import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn
} from "typeorm";

export type VersionStatus = "draft" | "published" | "archived";
export type BindingMode = "follow" | "pin";
export type ReviewStatus = "approved" | "needs_re_review";

@Entity("brands")
export class Brand {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  slug!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}

@Entity("brand_versions")
@Unique(["brandId", "versionNumber"])
export class BrandVersion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  @Index()
  brandId!: string;

  /** 发布时分配；草稿为 null（MySQL/SQLite 唯一索引均允许多个 NULL） */
  @Column({ type: "int", nullable: true })
  versionNumber!: number | null;

  @Column({ type: "varchar", length: 16, default: "draft" })
  status!: VersionStatus;

  @Column({ type: "simple-json" })
  tokens!: Record<string, string>;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  tokenHash!: string | null;

  @Column({ type: "text", nullable: true })
  compiledCss!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  cssHash!: string | null;

  /** 乐观锁：并发编辑 / 并发发布时版本不匹配即失败 */
  @VersionColumn()
  lockVersion!: number;

  @Column({ type: "varchar", length: 64, default: "system" })
  createdBy!: string;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @Column({ type: "datetime", nullable: true })
  publishedAt!: Date | null;
}

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  slug!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @Column({ type: "varchar", length: 64 })
  brandId!: string;

  /** follow: 跟随最新发布；pin: 固定到指定版本 */
  @Column({ type: "varchar", length: 8, default: "follow" })
  bindingMode!: BindingMode;

  @Column({ type: "varchar", length: 64, nullable: true })
  pinnedVersionId!: string | null;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}

@Entity("assets")
export class Asset {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  @Index()
  projectId!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  /** subtitle: 成片字幕；badge: 导出角标 */
  @Column({ type: "varchar", length: 16 })
  kind!: string;

  /** 该素材消费哪些令牌 */
  @Column({ type: "simple-json" })
  watchedTokens!: string[];

  /** 批准时解析后的令牌快照 —— 未复核前渲染只认快照，保证已批准成片不漂移 */
  @Column({ type: "simple-json" })
  tokenSnapshot!: Record<string, string>;

  @Column({ type: "varchar", length: 64, nullable: true })
  approvedVersionId!: string | null;

  @Column({ type: "varchar", length: 20, default: "approved" })
  reviewStatus!: ReviewStatus;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;
}

@Entity("publish_events")
export class PublishEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  @Index()
  brandId!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  versionId!: string | null;

  @Column({ type: "varchar", length: 64 })
  actor!: string;

  /** published | conflict | validation_failed | build_failed */
  @Column({ type: "varchar", length: 24 })
  result!: string;

  @Column({ type: "text", nullable: true })
  detail!: string | null;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}

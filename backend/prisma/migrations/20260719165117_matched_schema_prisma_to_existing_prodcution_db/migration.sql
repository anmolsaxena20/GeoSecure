/*
  Warnings:

  - You are about to drop the column `commodity` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "commodity";

-- CreateTable
CREATE TABLE "commodity_risk_scores" (
    "id" SERIAL NOT NULL,
    "commodity" VARCHAR(50) NOT NULL,
    "disruption_probability" INTEGER NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodity_risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "headline" TEXT NOT NULL,
    "url" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "raw_content" TEXT,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridor_risk_scores" (
    "id" SERIAL NOT NULL,
    "corridor_name" VARCHAR(100) NOT NULL,
    "disruption_probability" INTEGER NOT NULL,
    "risk_level" VARCHAR(20) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridor_risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "article_id" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "countries" JSONB,
    "commodities" JSONB,
    "transport_modes" JSONB,
    "impacts" JSONB,
    "recommendations" JSONB,
    "risk_score" DECIMAL,
    "risk_level" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CommodityToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CommodityToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "commodity_risk_scores_commodity_key" ON "commodity_risk_scores"("commodity");

-- CreateIndex
CREATE UNIQUE INDEX "articles_url_key" ON "articles"("url");

-- CreateIndex
CREATE UNIQUE INDEX "corridor_risk_scores_corridor_name_key" ON "corridor_risk_scores"("corridor_name");

-- CreateIndex
CREATE UNIQUE INDEX "events_unique_event" ON "events"("article_id", "event_type", "summary");

-- CreateIndex
CREATE INDEX "_CommodityToUser_B_index" ON "_CommodityToUser"("B");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommodityToUser" ADD CONSTRAINT "_CommodityToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "commodity_risk_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommodityToUser" ADD CONSTRAINT "_CommodityToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

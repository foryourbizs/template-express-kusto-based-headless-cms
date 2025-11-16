-- CreateTable
CREATE TABLE "public"."analytics_unique_visitors" (
    "id" BIGSERIAL NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT NOT NULL,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_unique_visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "visitorFingerprint" VARCHAR(64) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_unique_visitors_fingerprint_key" ON "public"."analytics_unique_visitors"("fingerprint");

-- CreateIndex
CREATE INDEX "analytics_unique_visitors_ipAddress_idx" ON "public"."analytics_unique_visitors"("ipAddress");

-- CreateIndex
CREATE INDEX "analytics_unique_visitors_firstVisitAt_idx" ON "public"."analytics_unique_visitors"("firstVisitAt");

-- CreateIndex
CREATE INDEX "analytics_events_visitorFingerprint_idx" ON "public"."analytics_events"("visitorFingerprint");

-- CreateIndex
CREATE INDEX "analytics_events_type_idx" ON "public"."analytics_events"("type");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "public"."analytics_events"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_visitorFingerprint_fkey" FOREIGN KEY ("visitorFingerprint") REFERENCES "public"."analytics_unique_visitors"("fingerprint") ON DELETE RESTRICT ON UPDATE CASCADE;

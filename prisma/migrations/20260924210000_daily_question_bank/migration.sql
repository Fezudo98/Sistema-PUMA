-- Add stable daily identity and booklet relation.
ALTER TABLE "Simulado" ADD COLUMN "apostilaId" TEXT REFERENCES "Apostila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Simulado" ADD COLUMN "dailyDate" TEXT;

-- Reusable question bank.
CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apostilaId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "alternativas" TEXT NOT NULL,
    "correta" INTEGER NOT NULL,
    "justificativa" TEXT NOT NULL,
    "tempoLimite" INTEGER NOT NULL DEFAULT 60,
    "topico" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'HISTORICAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "firstUsedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionBankItem_apostilaId_fkey" FOREIGN KEY ("apostilaId") REFERENCES "Apostila" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Persistent orchestration/observability state.
CREATE TABLE "DailyGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "apostilaId" TEXT NOT NULL,
    "scheduledFor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "lastError" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyGenerationJob_apostilaId_fkey" FOREIGN KEY ("apostilaId") REFERENCES "Apostila" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Question" ADD COLUMN "sourceBankItemId" TEXT REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Simulado_apostilaId_idx" ON "Simulado"("apostilaId");
CREATE UNIQUE INDEX "Simulado_tipo_apostilaId_dailyDate_key" ON "Simulado"("tipo", "apostilaId", "dailyDate");
CREATE INDEX "Question_sourceBankItemId_idx" ON "Question"("sourceBankItemId");
CREATE UNIQUE INDEX "QuestionBankItem_apostilaId_contentHash_key" ON "QuestionBankItem"("apostilaId", "contentHash");
CREATE INDEX "QuestionBankItem_apostilaId_status_lastUsedAt_idx" ON "QuestionBankItem"("apostilaId", "status", "lastUsedAt");
CREATE INDEX "QuestionBankItem_apostilaId_useCount_idx" ON "QuestionBankItem"("apostilaId", "useCount");
CREATE UNIQUE INDEX "DailyGenerationJob_jobType_apostilaId_scheduledFor_key" ON "DailyGenerationJob"("jobType", "apostilaId", "scheduledFor");
CREATE INDEX "DailyGenerationJob_status_updatedAt_idx" ON "DailyGenerationJob"("status", "updatedAt");

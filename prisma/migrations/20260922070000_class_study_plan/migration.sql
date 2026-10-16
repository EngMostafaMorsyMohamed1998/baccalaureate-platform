-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassStudyPlan" (
    "studentId" TEXT NOT NULL,
    "examDate" TEXT NOT NULL,
    "done" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassStudyPlan_pkey" PRIMARY KEY ("studentId")
);

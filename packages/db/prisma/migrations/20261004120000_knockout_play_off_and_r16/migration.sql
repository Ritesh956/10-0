-- European Nights now has a 36-club league phase feeding a play-off round and a Round of 16
-- ahead of the quarter-finals. BEFORE keeps the enum in bracket order (PO, R16, QF, SF, FINAL).
ALTER TYPE "KnockoutRound" ADD VALUE 'PO' BEFORE 'QF';
ALTER TYPE "KnockoutRound" ADD VALUE 'R16' BEFORE 'QF';

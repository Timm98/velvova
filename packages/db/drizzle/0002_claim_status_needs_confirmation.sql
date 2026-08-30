-- §16.2 nennt drei Zustände für eine Bewerbungsaussage:
-- supported, needs_confirmation, unsupported.
--
-- "weakened" beschrieb die Aussage. "needs_confirmation" beschreibt,
-- was die Person tun muss. Das ist der Unterschied zwischen einem
-- Befund und einer Handlungsanweisung — und in einem Dokument, das
-- verschickt wird, zählt die Handlungsanweisung.
ALTER TYPE "claim_status" RENAME VALUE 'weakened' TO 'needs_confirmation';

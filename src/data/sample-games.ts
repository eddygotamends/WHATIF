export interface SampleGame {
  id: string;
  title: string;
  subtitle: string;
  recommendedPly: number;
  pgn: string;
}

export const SAMPLE_GAMES: SampleGame[] = [
  {
    id: "sicilian-turning-point",
    title: "Sicilian Najdorf — Missed Counterplay",
    subtitle: "Result 1-0 · Opponent 1640 Elo · Rewind to ply 16 before ...Be7?",
    recommendedPly: 16,
    pgn: `[Event "Evening Club Rapid"]
[Site "Offline Archive"]
[Date "2025.10.14"]
[White "A. Vance"]
[Black "You"]
[Result "1-0"]
[WhiteElo "1640"]
[BlackElo "1595"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5 12. g5 b4 13. Ne2 Ne8 14. f4 a5 15. f5 a4 16. fxe6 axb3 17. exf7+ Rxf7 18. cxb3 Rxa2 19. Kb1 Qa8 20. Ng3 Ra1+ 21. Kc2 Qc6+ 22. Bc4 1-0`,
  },
  {
    id: "queens-gambit-turnaround",
    title: "Queen's Gambit Declined — Knight Outpost",
    subtitle: "Result 0-1 · Opponent 1820 Elo · Rewind to ply 18 before Nd5?",
    recommendedPly: 18,
    pgn: `[Event "Weekend Swiss Round 3"]
[Site "Offline Archive"]
[Date "2025.11.02"]
[White "You"]
[Black "M. Lindqvist"]
[Result "0-1"]
[WhiteElo "1775"]
[BlackElo "1820"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf6 19. Nxe6 fxe6 20. b4 c4 21. e4 Qe7 22. exd5 exd5 0-1`,
  },
  {
    id: "italian-draw-endgame",
    title: "Italian Game — Rook Endgame Precision",
    subtitle: "Result 1/2-1/2 · Select your side · Rewind to ply 24",
    recommendedPly: 24,
    pgn: `[Event "Classical League Round 5"]
[Site "Offline Archive"]
[Date "2026.01.19"]
[White "K. Patel"]
[Black "R. Novak"]
[Result "1/2-1/2"]
[WhiteElo "1510"]
[BlackElo "1540"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. a4 Ba7 8. Re1 O-O 9. Nbd2 h6 10. h3 Re8 11. Bb3 Be6 12. Bxe6 Rxe6 13. Nf1 d5 14. exd5 Qxd5 15. Be3 Rd8 16. Bxa7 Nxa7 17. d4 exd4 18. Rxe6 Qxe6 19. Nxd4 Qd5 20. Ne3 Qd7 21. Qf3 Nc6 22. Nxc6 Qxc6 23. Qxc6 bxc6 24. Rd1 Rxd1+ 25. Nxd1 1/2-1/2`,
  },
];

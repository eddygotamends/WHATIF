export interface LichessPerf {
  games: number;
  rating: number;
  rd: number;
  prog: number;
}

export interface LichessProfile {
  id: string;
  username: string;
  url: string;
  perfs: {
    bullet?: LichessPerf;
    blitz?: LichessPerf;
    rapid?: LichessPerf;
    classical?: LichessPerf;
    puzzle?: LichessPerf;
  };
  count?: {
    all: number;
    win: number;
    loss: number;
    draw: number;
  };
}

export interface LichessRecentGame {
  id: string;
  speed: string;
  perf: string;
  rated: boolean;
  status: string;
  winner?: "white" | "black";
  createdAt: number;
  lastMoveAt: number;
  pgn: string;
  opening?: { name: string; eco: string };
  players: {
    white: {
      user?: { name: string; id: string };
      rating?: number;
      ratingDiff?: number;
      aiLevel?: number;
    };
    black: {
      user?: { name: string; id: string };
      rating?: number;
      ratingDiff?: number;
      aiLevel?: number;
    };
  };
}

export interface LichessDailyPuzzle {
  game: {
    id: string;
    pgn: string;
    perf: { name: string };
    players: Array<{ name: string; color: "white" | "black"; rating: number }>;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    initialPly: number;
    solution: string[];
    themes: string[];
  };
}

export interface LichessTvChannel {
  channel: string;
  user: { name: string; id: string; title?: string };
  rating: number;
  gameId: string;
  color?: "white" | "black";
}

export interface LichessLiveGameInfo {
  gameId: string;
  myColor: "white" | "black";
  opponentName: string;
  opponentRating: number | null;
  speed: string;
  rated: boolean;
  initialFen: string;
  moves: string;
  wtime: number;
  btime: number;
  status: string;
  winner?: "white" | "black";
}

const TOKEN_STORAGE_KEY = "whatif-lichess-token";
const USERNAME_STORAGE_KEY = "whatif-lichess-username";
const LICHESS_CLIENT_ID = "whatif-studio-web";

export function getSavedLichessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLichessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedLichessUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLichessUsername(username: string | null): void {
  try {
    if (username) {
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
    } else {
      localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export async function loginWithLichessOAuth(): Promise<{
  token: string;
  profile: LichessProfile;
}> {
  const { verifier, challenge } = await generatePkce();
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const redirectUri = `${window.location.origin}/auth/lichess/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: LICHESS_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "preference:read challenge:read challenge:write board:play puzzle:read",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });

  const authUrl = `https://lichess.org/oauth?${params.toString()}`;
  const popup = window.open(authUrl, "lichess_oauth", "width=540,height=720");
  if (!popup) {
    throw new Error(
      "Popup blocked by browser. Allow popups or paste a Lichess Personal API token below."
    );
  }

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Lichess OAuth timed out."));
    }, 120000);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "LICHESS_OAUTH_CALLBACK") return;
      if (event.data.error) {
        cleanup();
        reject(new Error(`Lichess OAuth error: ${event.data.error}`));
        return;
      }
      if (event.data.state !== state || !event.data.code) {
        cleanup();
        reject(new Error("Invalid OAuth state received from Lichess."));
        return;
      }
      cleanup();
      resolve(event.data.code as string);
    };

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };

    window.addEventListener("message", onMessage);
  });

  const tokenRes = await fetch("https://lichess.org/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      client_id: LICHESS_CLIENT_ID,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;
  const profile = await fetchLichessAccount(token);
  saveLichessToken(token);
  saveLichessUsername(profile.username);
  return { token, profile };
}

export async function fetchLichessAccount(token: string): Promise<LichessProfile> {
  const res = await fetch("https://lichess.org/api/account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Lichess authentication failed (${res.status}).`);
  }
  return (await res.json()) as LichessProfile;
}

export async function fetchPublicLichessUser(
  username: string
): Promise<LichessProfile> {
  const res = await fetch(
    `https://lichess.org/api/user/${encodeURIComponent(username.trim())}`
  );
  if (!res.ok) {
    throw new Error(`Lichess user "${username}" not found (${res.status}).`);
  }
  return (await res.json()) as LichessProfile;
}

export async function fetchLichessRecentGames(
  username: string,
  max = 10,
  token?: string | null
): Promise<LichessRecentGame[]> {
  const headers: Record<string, string> = {
    Accept: "application/x-ndjson",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(
      username.trim()
    )}?max=${max}&pgnInJson=true&opening=true&clocks=false`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch games for "${username}" (${res.status}).`);
  }

  const text = await res.text();
  const games: LichessRecentGame[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      games.push(JSON.parse(trimmed) as LichessRecentGame);
    } catch {
      // skip malformed NDJSON line
    }
  }
  return games;
}

export async function fetchLichessDailyPuzzle(): Promise<LichessDailyPuzzle> {
  const res = await fetch("https://lichess.org/api/puzzle/daily");
  if (!res.ok) {
    throw new Error(`Failed to load Lichess daily puzzle (${res.status}).`);
  }
  return (await res.json()) as LichessDailyPuzzle;
}

export async function fetchLichessTvChannels(): Promise<LichessTvChannel[]> {
  const res = await fetch("https://lichess.org/api/tv/channels");
  if (!res.ok) {
    throw new Error(`Failed to fetch Lichess TV channels (${res.status}).`);
  }
  const raw = (await res.json()) as Record<
    string,
    { user: { name: string; id: string; title?: string }; rating: number; gameId: string; color?: "white" | "black" }
  >;
  return Object.entries(raw).map(([channel, info]) => ({
    channel,
    ...info,
  }));
}

export async function fetchLichessGamePgn(
  gameId: string,
  token?: string | null
): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `https://lichess.org/game/export/${encodeURIComponent(gameId)}?evals=false&clocks=false`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`Could not export game ${gameId} (${res.status}).`);
  }
  return res.text();
}

export async function createLichessSeek(
  token: string,
  options: {
    timeMinutes: number;
    incrementSeconds: number;
    rated: boolean;
    variant?: string;
    ratingRange?: string;
  },
  signal?: AbortSignal
): Promise<void> {
  const body = new URLSearchParams({
    rated: String(options.rated),
    time: String(options.timeMinutes),
    increment: String(options.incrementSeconds),
    variant: options.variant || "standard",
  });
  if (options.ratingRange) {
    body.set("ratingRange", options.ratingRange);
  }

  const res = await fetch("https://lichess.org/api/board/seek", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Lichess seek failed (${res.status}): ${errText}`);
  }
}

export async function challengeLichessAi(
  token: string,
  options: {
    level: number;
    timeMinutes: number;
    incrementSeconds: number;
    color?: "random" | "white" | "black";
  }
): Promise<string> {
  const body = new URLSearchParams({
    level: String(options.level),
    "clock.limit": String(options.timeMinutes * 60),
    "clock.increment": String(options.incrementSeconds),
    color: options.color || "random",
    variant: "standard",
  });

  const res = await fetch("https://lichess.org/api/challenge/ai", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI challenge failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function challengeLichessUser(
  token: string,
  username: string,
  options: {
    timeMinutes: number;
    incrementSeconds: number;
    rated: boolean;
  }
): Promise<string> {
  const body = new URLSearchParams({
    rated: String(options.rated),
    "clock.limit": String(options.timeMinutes * 60),
    "clock.increment": String(options.incrementSeconds),
    variant: "standard",
  });

  const res = await fetch(
    `https://lichess.org/api/challenge/${encodeURIComponent(username.trim())}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Challenge failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { challenge?: { id: string }; id?: string };
  return data.challenge?.id || data.id || "";
}

async function readNdjsonStream(
  url: string,
  token: string,
  onEvent: (data: Record<string, unknown>) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream error (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed) as Record<string, unknown>);
      } catch {
        // ignore keepalive / parse errors
      }
    }
  }
}

export function streamLichessAccountEvents(
  token: string,
  onEvent: (event: Record<string, unknown>) => void,
  signal: AbortSignal
): Promise<void> {
  return readNdjsonStream(
    "https://lichess.org/api/stream/event",
    token,
    onEvent,
    signal
  );
}

export function streamLichessBoardGame(
  token: string,
  gameId: string,
  onEvent: (event: Record<string, unknown>) => void,
  signal: AbortSignal
): Promise<void> {
  return readNdjsonStream(
    `https://lichess.org/api/board/game/stream/${encodeURIComponent(gameId)}`,
    token,
    onEvent,
    signal
  );
}

export async function sendLichessBoardMove(
  token: string,
  gameId: string,
  uci: string
): Promise<void> {
  const res = await fetch(
    `https://lichess.org/api/board/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(uci)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Move rejected by Lichess (${res.status}): ${errText}`);
  }
}

export async function resignLichessBoardGame(
  token: string,
  gameId: string
): Promise<void> {
  await fetch(
    `https://lichess.org/api/board/game/${encodeURIComponent(gameId)}/resign`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function abortLichessBoardGame(
  token: string,
  gameId: string
): Promise<void> {
  await fetch(
    `https://lichess.org/api/board/game/${encodeURIComponent(gameId)}/abort`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function fetchLichessNextPuzzle(
  angle?: string,
  token?: string | null
): Promise<LichessDailyPuzzle> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const query = angle ? `?angle=${encodeURIComponent(angle)}` : "";
  const res = await fetch(`https://lichess.org/api/puzzle/next${query}`, {
    headers,
  });
  if (!res.ok) {
    // Fallback to daily puzzle if next requires auth or rate-limits
    return fetchLichessDailyPuzzle();
  }
  return (await res.json()) as LichessDailyPuzzle;
}

export interface ExplorerMoveStat {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface OpeningExplorerResponse {
  white: number;
  draws: number;
  black: number;
  opening?: { eco: string; name: string } | null;
  moves: ExplorerMoveStat[];
}

export async function fetchLichessOpeningExplorer(
  fen: string
): Promise<OpeningExplorerResponse> {
  const params = new URLSearchParams({
    fen,
    topGames: "0",
    recentGames: "0",
    moves: "8",
  });
  const res = await fetch(`https://explorer.lichess.ovh/lichess?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Opening explorer unavailable (${res.status}).`);
  }
  return (await res.json()) as OpeningExplorerResponse;
}

export interface LichessChallengeItem {
  id: string;
  challenger: { id: string; name: string; rating?: number };
  destUser?: { id: string; name: string; rating?: number };
  variant: { key: string; name: string };
  rated: boolean;
  speed: string;
  timeControl: { show?: string; limit?: number; increment?: number };
}

export async function fetchLichessChallenges(token: string): Promise<{
  in: LichessChallengeItem[];
  out: LichessChallengeItem[];
}> {
  const res = await fetch("https://lichess.org/api/challenge", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch challenges (${res.status}).`);
  }
  return (await res.json()) as {
    in: LichessChallengeItem[];
    out: LichessChallengeItem[];
  };
}

export async function acceptLichessChallenge(
  token: string,
  challengeId: string
): Promise<void> {
  const res = await fetch(
    `https://lichess.org/api/challenge/${encodeURIComponent(challengeId)}/accept`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Could not accept challenge (${res.status}).`);
  }
}

export async function declineLichessChallenge(
  token: string,
  challengeId: string
): Promise<void> {
  await fetch(
    `https://lichess.org/api/challenge/${encodeURIComponent(challengeId)}/decline`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export interface LichessFriendUser {
  id: string;
  username: string;
  online?: boolean;
  playing?: boolean;
  perfs?: LichessProfile["perfs"];
}

export async function fetchLichessFollowing(
  token: string
): Promise<LichessFriendUser[]> {
  const res = await fetch("https://lichess.org/api/rel/following", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/x-ndjson",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to load friends (${res.status}).`);
  }
  const text = await res.text();
  const users: LichessFriendUser[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      users.push(JSON.parse(trimmed) as LichessFriendUser);
    } catch {
      // ignore malformed line
    }
  }
  return users;
}


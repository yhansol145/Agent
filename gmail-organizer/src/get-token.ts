import "dotenv/config";
import * as http from "node:http";
import { exec } from "node:child_process";
import { google } from "googleapis";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error(
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET가 .env에 없습니다. README의 'OAuth 세팅' 1~5단계를 먼저 끝내세요."
  );
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const oauth2 = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) {
    res.end(`Auth failed: ${err}`);
    console.error(`\n[error] OAuth 거부됨: ${err}`);
    process.exit(1);
  }
  if (!code) {
    res.statusCode = 400;
    res.end("No code in callback URL.");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.end(
        "refresh_token이 안 나왔습니다. https://myaccount.google.com/permissions 에서 이 앱의 권한을 해제한 뒤 다시 실행해주세요."
      );
      console.error(
        "\n[error] refresh_token이 없음. 이미 한 번 인증한 적 있어서 그래요. " +
          "https://myaccount.google.com/permissions 에서 권한 해제 후 다시 시도하세요."
      );
      process.exit(1);
    }
    res.end(
      "OK! 콘솔로 돌아가서 출력된 refresh_token을 .env에 붙여넣으세요. 이 창은 닫아도 됩니다."
    );
    console.log(`\n[refresh_token]\n${tokens.refresh_token}`);
    console.log(
      `\n위 값을 .env의 GOOGLE_REFRESH_TOKEN= 뒤에 붙여넣으세요. 끝나면 npx tsx src/index.ts "..." 로 실행 가능.`
    );
    server.close();
    process.exit(0);
  } catch (e) {
    res.end(`Error: ${(e as Error).message}`);
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `\n[get-token] 브라우저에서 Google 로그인 화면이 열립니다. 본인 계정 선택 → 권한 허용.\n`
  );
  console.log(`자동으로 안 열리면 이 URL을 직접 여세요:\n${authUrl}\n`);
  exec(`open "${authUrl}"`);
});

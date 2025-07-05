import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

let userToken = process.env.FB_USER_TOKEN!;
let longLivedToken: string | null = null;
let pageAccessToken: string | null = null;
let tokenExpiry: number = 0;
const fb_graph_url = "https://graph.facebook.com/v19.0";

const APP_ID = process.env.FB_APP_ID!;
const APP_SECRET = process.env.FB_APP_SECRET!;
const PAGE_ID = process.env.FB_PAGE_ID!;
let PAGE_ACCESS_TOKEN = process.env.FB_PAGE_TOKEN!;

interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PageData {
  id: string;
  name: string;
  access_token: string;
}

interface PageAccountsResponse {
  data: PageData[];
}

export const handler = async () => {
  try {
    const token = PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN : await ensureValidToken();
    //const token = await ensureValidToken();
    const res = await fetch(`${fb_graph_url}/${PAGE_ID}/events?access_token=${token}&fields=id,name,start_time,end_time,place,cover,description`);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unknown error" }),
    };
  }
};

async function ensureValidToken(): Promise<string> {
  const now = Date.now();
  if (!longLivedToken || now > tokenExpiry - 5 * 60 * 1000) {
    const { token, expiresIn } = await getLongLivedUserToken(userToken);
    longLivedToken = token;
    tokenExpiry = now + expiresIn * 1000;
    pageAccessToken = await getPageAccessToken(longLivedToken);
  }

  return pageAccessToken!;
}

async function getLongLivedUserToken(shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const url = `${fb_graph_url}/oauth/access_token?grant_type=fb_exchange_token` +
              `&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`;
  const res = await fetch(url);
  const data = await res.json() as GraphTokenResponse;
    console.log("Received long-lived user token data:", data);
  if (!data.access_token) {
    throw new Error("Unable to get long-lived user token");
  }
  console.log("Received the long-lived user token:", data.access_token);
  return {
    token: data.access_token,
    expiresIn: data.expires_in,
  };
}

async function getPageAccessToken(userAccessToken: string): Promise<string> {
  const url = `${fb_graph_url}/me/accounts?access_token=${userAccessToken}`;
  const res = await fetch(url);
  const data = await res.json() as PageAccountsResponse;
console.log("Received page accounts data:", data);
  const page = data.data.find((p) => p.id === PAGE_ID);
  if (!page) throw new Error("Page not found or access denied.");
    console.log("Received the page access token:", page.access_token);
  return page.access_token;
}

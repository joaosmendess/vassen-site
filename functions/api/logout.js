import { clearCookie, sameOrigin, json } from "../../lib/auth.js";

export const onRequestPost = ({ request }) =>
  sameOrigin(request) ? json({ ok: true }, 200, { "set-cookie": clearCookie }) : json({ error: "Origem inválida." }, 403);

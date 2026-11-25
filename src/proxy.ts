import { NextResponse, type NextRequest } from "next/server";

/**
 * Discord ouvre l'activité à la racine de l'adresse que le portail lui donne,
 * avec `frame_id` et `instance_id` dans la requête. La racine du hub est son
 * accueil : on y sert l'activité à la place. Une réécriture et non une
 * redirection — une redirection absolue sortirait du proxy de Discord, que sa
 * CSP referme.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("frame_id")) {
    const url = request.nextUrl.clone();
    url.pathname = "/discord";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };

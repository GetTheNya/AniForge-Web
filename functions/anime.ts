export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const animeId = url.searchParams.get('id');

  const userAgent = request.headers.get('user-agent') || '';
  
  const isBot = /discordbot|telegrambot|twitterbot|slackbot|facebookexternalhit|whatsapp/i.test(userAgent);

  if (!isBot || !animeId) {
    return context.next(); 
  }

  try {
    const query = `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          title { romaji english native }
          coverImage { large }
        }
      }
    `;

    const aniListRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: parseInt(animeId) } }),
    });

    const { data } = await aniListRes.json();
    const media = data?.Media;

    if (!media) return context.next();

    const title = media.title.english || media.title.romaji || media.title.native;
    const cover = media.coverImage.large;

    const response = await context.next();
    let html = await response.text();

    html = html.replace(
      '<title>AniForge — Anime Catalog</title>',
      `<title>${title} — AniForge</title>`
    );
    html = html.replace(
      '<meta property="og:title" content="AniForge — Anime Catalog" />',
      `<meta property="og:title" content="${title} — Anime Details" />`
    );
    html = html.replace(
      '<meta property="og:image" content="/AppIcon.png" />',
      `<meta property="og:image" content="${cover}" />`
    );
    html = html.replace(
      '</head>',
      `<meta name="twitter:card" content="summary_large_image" /></head>`
    );

    return new Response(html, {
      headers: response.headers,
    });
  } catch (err) {
    return context.next();
  }
}
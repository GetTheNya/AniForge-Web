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
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'AniForgeWebClient/1.0'
      },
      body: JSON.stringify({ query, variables: { id: parseInt(animeId) } }),
    });

    if (!aniListRes.ok) return context.next();

    const { data } = await aniListRes.json();
    const media = data?.Media;

    if (!media) return context.next();

    const title = media.title.english || media.title.romaji || media.title.native;
    const cover = media.coverImage.large;

    const response = await context.next();

    return new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`${title} — AniForge`);
        },
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', `View details and track the progress of the anime "${title}" on AniForge Web.`);
        },
      })
      .on('head', {
        element(el) {
          el.append(`<meta property="og:title" content="${title} — AniForge" />`, { html: true });
          el.append(`<meta property="og:description" content="Offline anime catalog, list tracking, and custom collections." />`, { html: true });
          el.append(`<meta property="og:image" content="${cover}" />`, { html: true });
          el.append(`<meta property="og:type" content="video.other" />`, { html: true });
          el.append(`<meta property="og:url" content="${request.url}" />`, { html: true });
          
          el.append(`<meta name="twitter:card" content="summary_large_image" />`, { html: true });
        },
      })
      .transform(response);

  } catch (err) {
    return context.next();
  }
}
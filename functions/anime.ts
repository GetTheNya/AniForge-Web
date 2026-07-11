export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const animeId = url.searchParams.get('id');
  const userAgent = request.headers.get('user-agent') || '';

  console.log(userAgent);
  
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

    return new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`${title} — AniForge`);
        },
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute('content', `${title} — Anime Details`);
        },
      })
      .on('meta[property="og:image"]', {
        element(el) {
          el.setAttribute('content', cover);
        },
      })
      .on('head', {
        element(el) {
          el.append(`<meta name="twitter:card" content="summary_large_image" />`, { html: true });
        },
      })

  } catch (err) {
    return context.next();
  }
}
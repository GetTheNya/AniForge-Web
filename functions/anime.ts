export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const animeId = url.searchParams.get('id');
  const userAgent = request.headers.get('user-agent') || '';

  console.log(userAgent);
  
  const isBot = /discordbot|telegrambot|twitterbot|slackbot|facebookexternalhit|whatsapp/i.test(userAgent);

  console.log(`Is Bot: ${isBot}`)

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

    if (!aniListRes.ok) {
        const errorText = await aniListRes.text();
  
        console.log(`❌ AniList API Error! Status: ${aniListRes.status}`);
        console.log(`❌ Text: ${errorText}`);
        return context.next();
    }

    const { data } = await aniListRes.json();
    const media = data?.Media;

    if (!media) {
        console.log(`not media`)
        return context.next();
    }

    const title = media.title.english || media.title.romaji || media.title.native;
    const cover = media.coverImage.large;

    const response = await context.next();  

    const rewriter = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`${title} — AniForge`);
        },
      })
      .on('head', {
        element(el) {
          el.prepend(`<meta property="og:title" content="${title} — AniForge" />`, { html: true });
          el.prepend(`<meta property="og:description" content="Offline anime catalog, list tracking, and custom collections." />`, { html: true });
          el.prepend(`<meta property="og:image" content="${cover}" />`, { html: true });
          el.prepend(`<meta property="og:type" content="video.other" />`, { html: true });
          el.prepend(`<meta property="og:url" content="${request.url}" />`, { html: true });
          
          el.prepend(`<meta name="twitter:card" content="summary_large_image" />`, { html: true });
        },
      })
      .transform(response);

      return rewriter;

  } catch (err) {
    console.log(`err: ${err}`)
    return context.next();
  }
}
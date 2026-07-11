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
    const kitsuUrl = `https://kitsu.io/api/edge/mappings?filter[externalSite]=anilist&filter[externalId]=${animeId}&include=item`;

    const kitsuRes = await fetch(kitsuUrl, {
        headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'User-Agent': 'AniForgeWebClient/1.0'
        }
    });

    if (!kitsuRes.ok) {
        const errorText = await kitsuRes.text();
  
        console.log(`❌ AniList API Error! Status: ${kitsuRes.status}`);
        console.log(`❌ Text: ${errorText}`);
        return context.next();
    }

    const json: any = await kitsuRes.json();
    const animeData = json.included?.[0]?.attributes;

    if (!animeData) {
        console.log(`❌ Kitsu cant find anime for AniList ID: ${animeId}`);
        return context.next();
    }

    const title = animeData.canonicalTitle || animeData.titles.en || animeData.titles.en_jp;
    const cover = animeData.posterImage?.large || animeData.posterImage?.original;

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
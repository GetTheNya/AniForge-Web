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
    const shardNumber = parseInt(animeId) % 100;
    const shardFile = shardNumber.toString().padStart(2, '0');

    const githubUrl = `https://raw.githubusercontent.com/GetTheNya/aniforge-metadata/main/main-info-chunks/${shardFile}.json`;

    const githubRes = await fetch(githubUrl);

    if (!githubRes.ok) {
      console.log(`❌ Shard ${shardFile}.json not found on GitHub.`);
      return context.next();
    }

    const chunk = await githubRes.json();
    const animeData = chunk[animeId];

    if (!animeData) {
        console.log(`❌ Anime with ID ${animeId} is missing from shard ${shardFile}.json`);
        return context.next();
    }

    const title = animeData.title;
    const cover = animeData.cover_large;

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
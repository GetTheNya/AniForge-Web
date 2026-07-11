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

    const myBucket = context.env.MY_BUCKET;

    const shardObject = await myBucket.get(`main-info-chunks/${shardFile}.json`);

    if (!shardObject) {
      console.log(`❌ Shard ${shardFile}.json doesnt found.`);
      return context.next();
    }

    const chunk = await shardObject.json();
    const animeData = chunk[animeId];

    if (!animeData) {
        console.log(`❌ Anime with ID ${animeId} is missing from shard ${shardFile}.json`);
        return context.next();
    }

    const title = animeData.title;
    const cover = animeData.cover_large;

    const description = `⭐ Rating: ${animeData.rating || 'N/A'} | 🎬 Format: ${animeData.type || 'N/A'} (${animeData.episodes || 'N/A'} ep.) \nView details and track progress in AniForge Web.`;

    const response = await context.next();  

    const isTelegram = /telegrambot/i.test(userAgent);
    const ogType = isTelegram ? 'website' : 'video.other';

    const rewriter = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(`${title} — AniForge`);
        },
      })
      .on('head', {
        element(el) {
          const metaTags = [
            `<meta name="twitter:card" data-dynamic="true" content="summary_large_image" />`,
            `<meta name="twitter:title" data-dynamic="true" content="${title} — AniForge" />`,
            `<meta name="twitter:description" data-dynamic="true" content="${description}" />`,
            cover ? `<meta name="twitter:image" data-dynamic="true" content="${cover}" />` : '',
            `<meta property="og:title" data-dynamic="true" content="${title} — AniForge" />`,
            `<meta property="og:description" data-dynamic="true" content="${description}" />`,
            cover ? `<meta property="og:image" data-dynamic="true" content="${cover}" />` : '',
            `<meta property="og:type" data-dynamic="true" content="${ogType}" />`,
            `<meta property="og:url" data-dynamic="true" content="${request.url}" />`
          ].filter(Boolean).join('\n');
          
          el.prepend(metaTags, { html: true });
        },
      })
      .on('meta[property="og:title"]:not([data-dynamic])', {
        element(el) {
          el.remove();
        },
      })
      .on('meta[property="og:image"]:not([data-dynamic])', {
        element(el) {
          el.remove();
        },
      })
      .on('meta[name="description"]:not([data-dynamic])', {
        element(el) {
          el.remove();
        },
      })
      .transform(response);

      return rewriter;

  } catch (err) {
    console.log(`err: ${err}`)
    return context.next();
  }
}
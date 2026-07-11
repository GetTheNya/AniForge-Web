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
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:title" content="${title} — AniForge" />`,
            `<meta name="twitter:description" content="${description}" />`,
            cover ? `<meta name="twitter:image" content="${cover}" />` : '',
            `<meta property="og:description" content="${description}" />`,
            `<meta property="og:type" content="${ogType}" />`,
            `<meta property="og:url" content="${request.url}" />`
          ].filter(Boolean).join('\n');
          
          el.prepend(metaTags, { html: true });
        },
      })
      .on('meta[property="og:title"]', {
        element(el) {
          el.setAttribute('content', `${title} — AniForge`);
        },
      })
      .on('meta[property="og:image"]', {
        element(el) {
          if (cover) {
            el.setAttribute('content', cover);
          } else {
            el.remove();
          }
        },
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', description);
        },
      })
      .transform(response);

      return rewriter;

  } catch (err) {
    console.log(`err: ${err}`)
    return context.next();
  }
}
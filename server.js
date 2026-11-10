import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Attempt to load .env file if supported in Node 20.6+
try {
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    process.loadEnvFile(path.join(__dirname, '.env'));
  }
} catch (err) {
  console.log('[Notice] .env not loaded or already configured via environment.');
}

const PORT = process.env.PORT || 3000;

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect against overly large payloads (limit to 10MB to accommodate base64 images)
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// Static file server handler
function serveStaticFile(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // API Route: GET /api/status - Check config and token status
  if (url.pathname === '/api/status' && req.method === 'GET') {
    const queryPageId = url.searchParams.get('pageId');
    const queryToken = url.searchParams.get('accessToken');
    const isMock = url.searchParams.get('mock') === 'true';

    if (isMock) {
      return sendJson(res, 200, {
        configured: true,
        valid: true,
        mock: true,
        page: {
          id: 'mock_demo_page_101',
          name: 'Demo Test Page (Simulated)',
          link: 'https://facebook.com',
          picture: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop'
        }
      });
    }

    const targetPageId = queryPageId || process.env.PAGE_ID || '';
    const targetToken = queryToken || process.env.PAGE_ACCESS_TOKEN || '';

    if (!targetPageId || !targetToken) {
      return sendJson(res, 200, {
        configured: false,
        source: queryPageId ? 'client' : (process.env.PAGE_ID ? 'server' : 'none'),
        pageId: targetPageId ? `${targetPageId.slice(0, 4)}...${targetPageId.slice(-4)}` : null,
        message: 'Page ID or Access Token is missing. Provide them in .env or the Settings panel.'
      });
    }

    try {
      // Validate credentials by fetching Page details from Meta Graph API
      const fbRes = await fetch(`https://graph.facebook.com/v21.0/${targetPageId}?fields=name,id,link,picture&access_token=${encodeURIComponent(targetToken)}`);
      const fbData = await fbRes.json();

      if (fbData.error) {
        return sendJson(res, 200, {
          configured: false,
          valid: false,
          error: fbData.error.message,
          errorType: fbData.error.type,
          errorCode: fbData.error.code,
        });
      }

      return sendJson(res, 200, {
        configured: true,
        valid: true,
        page: {
          id: fbData.id,
          name: fbData.name,
          link: fbData.link || `https://facebook.com/${fbData.id}`,
          picture: fbData.picture?.data?.url || null
        }
      });
    } catch (err) {
      return sendJson(res, 500, {
        configured: false,
        error: `Network error connecting to Meta Graph API: ${err.message}`
      });
    }
  }

  // API Route: GET /api/feed - Fetch recent published posts from Facebook Page
  if (url.pathname === '/api/feed' && req.method === 'GET') {
    const queryPageId = url.searchParams.get('pageId');
    const queryToken = url.searchParams.get('accessToken');
    const isMock = url.searchParams.get('mock') === 'true';

    if (isMock) {
      return sendJson(res, 200, {
        success: true,
        mock: true,
        data: [
          {
            id: 'mock_post_001',
            message: 'Welcome to our demo Facebook page! Check out our new product features.',
            created_time: new Date(Date.now() - 3600000).toISOString(),
            permalink_url: 'https://facebook.com'
          },
          {
            id: 'mock_post_002',
            message: 'Announcing our 2026 developer tools showcase. Excited to share with everyone!',
            created_time: new Date(Date.now() - 86400000).toISOString(),
            permalink_url: 'https://facebook.com'
          }
        ]
      });
    }

    const targetPageId = queryPageId || process.env.PAGE_ID;
    const targetToken = queryToken || process.env.PAGE_ACCESS_TOKEN;

    if (!targetPageId || !targetToken) {
      return sendJson(res, 400, { success: false, error: 'Missing credentials to fetch feed.' });
    }

    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/v21.0/${targetPageId}/feed?fields=id,message,created_time,permalink_url&limit=5&access_token=${encodeURIComponent(targetToken)}`
      );
      const fbData = await fbRes.json();

      if (fbData.error) {
        return sendJson(res, 400, { success: false, error: fbData.error.message });
      }

      return sendJson(res, 200, { success: true, data: fbData.data || [] });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // API Route: POST /api/post - Publish post to Facebook Page
  if (url.pathname === '/api/post' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const {
        message,
        link,
        imageUrl,
        pageId,
        accessToken,
        mockMode,
        scheduledPublishTime // Unix timestamp in seconds
      } = payload;

      // Handle Mock Mode simulation
      if (mockMode) {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate realistic network delay
        const mockId = `mock_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
        return sendJson(res, 200, {
          success: true,
          mock: true,
          id: mockId,
          url: `https://facebook.com`,
          targetPageId: pageId || 'mock_page_demo',
          publishedAt: new Date().toISOString(),
          isScheduled: !!scheduledPublishTime,
          scheduledPublishTime: scheduledPublishTime || null
        });
      }

      const targetPageId = (pageId && pageId.trim()) || process.env.PAGE_ID;
      const targetToken = (accessToken && accessToken.trim()) || process.env.PAGE_ACCESS_TOKEN;

      if (!targetPageId || !targetToken) {
        return sendJson(res, 400, {
          success: false,
          error: 'Missing Facebook credentials. Please set PAGE_ID and PAGE_ACCESS_TOKEN in .env or provide them in the request.'
        });
      }

      if (!message && !imageUrl) {
        return sendJson(res, 400, {
          success: false,
          error: 'A post message or an image URL is required to publish.'
        });
      }

      let fbEndpoint;
      const fbParams = new URLSearchParams();
      fbParams.append('access_token', targetToken);

      // Handle Post Scheduling if requested (Graph API requirement: published=false + scheduled_publish_time)
      if (scheduledPublishTime) {
        fbParams.append('published', 'false');
        fbParams.append('scheduled_publish_time', String(scheduledPublishTime));
      }

      // Determine whether this is a photo post or a standard feed post
      if (imageUrl && imageUrl.trim()) {
        fbEndpoint = `https://graph.facebook.com/v21.0/${targetPageId}/photos`;
        fbParams.append('url', imageUrl.trim());
        if (message && message.trim()) {
          fbParams.append('caption', message.trim());
        }
      } else {
        fbEndpoint = `https://graph.facebook.com/v21.0/${targetPageId}/feed`;
        if (message && message.trim()) {
          fbParams.append('message', message.trim());
        }
        if (link && link.trim()) {
          fbParams.append('link', link.trim());
        }
      }

      // Forward request to Meta Graph API
      const fbResponse = await fetch(fbEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: fbParams.toString(),
      });

      const fbResult = await fbResponse.json();

      if (!fbResponse.ok || fbResult.error) {
        console.error('[Meta Graph API Error]', fbResult.error);
        return sendJson(res, fbResponse.status >= 400 ? fbResponse.status : 400, {
          success: false,
          error: fbResult.error?.message || 'Failed to publish post to Facebook',
          details: fbResult.error,
        });
      }

      // Successful publish
      const createdId = fbResult.id || fbResult.post_id;
      return sendJson(res, 200, {
        success: true,
        id: createdId,
        url: `https://www.facebook.com/${createdId}`,
        targetPageId,
        publishedAt: new Date().toISOString(),
        isScheduled: !!scheduledPublishTime,
        scheduledPublishTime: scheduledPublishTime || null
      });

    } catch (err) {
      console.error('[Server Error in /api/post]', err);
      return sendJson(res, 500, {
        success: false,
        error: `Internal server error: ${err.message}`
      });
    }
  }

  // Fallback: Serve static front-end assets
  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  Facebook Poster Dashboard running on http://localhost:${PORT}`);
  console.log(`  Target Page ID: ${process.env.PAGE_ID || '(Not configured in .env - set in Dashboard UI)'}`);
  console.log(`=================================================\n`);
});

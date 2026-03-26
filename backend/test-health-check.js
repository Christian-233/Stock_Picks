const http = require('http');

// Give server time to start
setTimeout(() => {
  const options = {
    hostname: 'localhost',
    port: 5002,
    path: '/api/health-check',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('✅ Health Check Response:\n');
        console.log(JSON.stringify(json, null, 2));
        process.exit(0);
      } catch (e) {
        console.error('❌ Invalid JSON:', data);
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request error:', e.message);
    process.exit(1);
  });

  req.end();
}, 2000);

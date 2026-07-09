const http = require('http');

setTimeout(() => {
    http.get('http://localhost:3000/blog/understanding-postal-codes-in-sri-lanka', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', data.substring(0, 500)));
    }).on('error', err => console.log('Error:', err.message));
}, 3000);

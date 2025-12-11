import https from 'https';

const apiKey = "AIzaSyD-vPAZZ4F8CRuVds5det4d4CGp6DwnTug";
const model = "gemini-1.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

console.log(`Testing URL: ${url}`);

const data = JSON.stringify({
    contents: [{
        parts: [{ text: "Hello, explain how AI works in one sentence." }]
    }]
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Raw-Length': data.length
    }
};

const req = https.request(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:', responseBody);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();

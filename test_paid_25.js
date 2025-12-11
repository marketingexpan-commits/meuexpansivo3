import https from 'https';

const apiKey = "AIzaSyDwzZFsf7P5-tE9Itqga0nuqre_EExmhwA";
const model = "gemini-2.5-flash-preview-09-2025";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

console.log(`Testing PAID Key on Model: ${model}`);

const data = JSON.stringify({
    contents: [{
        parts: [{ text: "Hello, work please." }]
    }]
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
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

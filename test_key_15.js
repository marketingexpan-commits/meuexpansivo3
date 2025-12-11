import https from 'https';

const apiKey = "AIzaSyCB-YNCrnUJE_W7l4hNcwlEmtpSoCjSJIw";
const model = "gemini-1.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

console.log(`Testing with New Key on Model: ${model}`);

const data = JSON.stringify({
    contents: [{
        parts: [{ text: "Hello, are you functional?" }]
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

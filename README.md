# Student Support Chatbot (Practical 10)

Web chatbot for students, built with Kiro + Groq API.
Stack: Node.js (Express) backend, plain HTML/CSS/JS frontend.

## Run (Windows)
1. Install Node.js 18+ from nodejs.org
2. Get a free API key at https://console.groq.com/keys
3. In the project folder:
   ```
   npm install
   copy .env.example .env
   ```
4. Open `.env` and paste your key after `GROQ_API_KEY=`
5. `npm start`
6. Open http://localhost:3000 in Chrome

## Test
- Ask: "Explain recursion with an example"
- Ask: "Make a 7-day plan for my DBMS exam"
- Remove the key from `.env` and restart: the chat shows a clear "API key missing" message.
- Health check: http://localhost:3000/api/health

## Security
The API key lives only in `.env` on the server. It is never sent to the browser.
`.env` is in `.gitignore`. If a key is ever exposed, revoke it in the Groq console.

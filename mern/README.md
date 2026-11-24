# Campus Care — MERN implementation

This directory contains the separate MERN implementation. The original Django application remains unchanged at the repository root.

## Stack
- React + Vite frontend
- Node.js + Express API
- MongoDB + Mongoose
- Python FastAPI + PyTorch service (added in the AI phase)

## Local setup
1. Install Node.js 20.19+ or 22.12+.
2. Create a MongoDB database (Atlas or local MongoDB).
3. Copy `server/.env.example` to `server/.env` and set `MONGO_URI`.
4. In one terminal: `cd mern/server && npm install && npm run dev`.
5. In another terminal: `cd mern/client && npm install && npm run dev`.

Frontend: http://localhost:5173  
API health: http://localhost:5000/api/health

Never commit `.env`, database dumps, uploads, or real user data.

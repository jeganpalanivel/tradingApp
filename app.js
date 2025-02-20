const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
const corsOptions = {
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'], 
    credentials: true,  
};

// Apply CORS middleware globally
app.use(cors(corsOptions));


// API Base URLs for Different Exchanges
const API_URLS = {
    binance_spot: "https://api.binance.com/api/v3/klines",
    binance_futures: "https://fapi.binance.com/fapi/v1/klines",
    bybit: "https://api.bybit.com/v2/public/symbols",

    mexc: "https://api.mexc.com/api/v3/klines",
    kucoin: "https://api.kucoin.com/api/v1/market/candles"
};


// Function to Fetch OHLCV Data
const fetchOHLCVData = async (exchange, symbol, interval, limit) => {
    let url = API_URLS[exchange];
    let params = {};

    switch (exchange) {
        case "binance_spot":
        case "binance_futures":
        case "mexc":
            params = { symbol, interval, limit };
            break;

        case "bybit":
            params = { 
                symbol,  
                interval,  
                limit,  
                from: Math.floor(Date.now() / 1000) - limit * 60
            };
            
            break;

        case "kucoin":
            params = { 
                symbol, 
                type: interval, 
                startAt: Math.floor(Date.now() / 1000) - limit * 60,  
                endAt: Math.floor(Date.now() / 1000)  
            };
            break;

        default:
            return { error: "Unsupported exchange" };
    }

    try {
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching OHLCV from ${exchange}:`, error.response?.data || error.message);
        return { error: "Failed to fetch data" };
    }
};


// REST API Endpoint for OHLCV Data (Supports Binance, ByBit, MEXC, KuCoin)
app.get("/api/ohlcv/:exchange", async (req, res) => {
    let { symbol, interval, limit } = req.query;
    const { exchange } = req.params;

    limit = parseInt(limit, 10);
    if (!symbol || !interval || isNaN(limit) || limit <= 0) {
        return res.status(400).json({ error: "Invalid parameters. Ensure 'limit' is a positive number." });
    }

    const data = await fetchOHLCVData(exchange, symbol, interval, limit);
    res.json(data);
});

app.get('/api/proxy/mexc/exchangeInfo', async (req, res) => {
    try {
        const response = await axios.get('https://api.mexc.com/api/v3/exchangeInfo');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching from MEXC:', error);
        res.status(500).json({ error: 'Error fetching data from MEXC' });
    }
});

  
  // Proxy for Bybit
app.get('/api/proxy/bybit/symbols', async (req, res) => {
    try {
      const response = await axios.get('https://api.bybit.com/v2/public/symbols');
      res.json(response.data); // Send the response data from Bybit API
    } catch (error) {
      console.error('Error fetching from Bybit:', error);
      res.status(500).json({ error: 'Error fetching data from Bybit' });
    }
  });
  
  // Proxy for KuCoin
  app.get('/api/proxy/kucoin/tickers', async (req, res) => {
    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers');
      res.json(response.data); 
      
    } catch (error) {
      console.error('Error fetching from KuCoin:', error);
      res.status(500).json({ error: 'Error fetching data from KuCoin' });
    }
  });
  


// WebSocket Servers for Binance Real-time Data
const kucoinWSS = new WebSocket.Server({ port: 8083 });
const mexcWSS = new WebSocket.Server({ port: 8084 });

console.log(" KuCoin WebSocket Server running on ws://localhost:8083");
console.log(" MEXC WebSocket Server running on ws://localhost:8084");

// Function to connect to KuCoin WebSocket
const connectToKuCoin = (wsServer, symbol, reconnectDelay = 3000) => {
    const wsUrl = "wss://ws-api.kucoin.com/endpoint"; // Replace with actual KuCoin WS URL
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
        console.log(` Connected to KuCoin WebSocket for ${symbol}`);
        ws.send(JSON.stringify({
            type: "subscribe",
            topic: `/market/ticker:${symbol}`,
            response: true
        }));
    });

    ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.topic && message.data) {
            wsServer.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message.data));
                }
            });
        }
    });

    ws.on("close", () => {
        console.error(` Disconnected from KuCoin WebSocket for ${symbol}. Reconnecting...`);
        setTimeout(() => connectToKuCoin(wsServer, symbol, Math.min(reconnectDelay * 2, 60000)), reconnectDelay);
    });

    ws.on("error", (err) => console.error(" KuCoin WebSocket Error:", err));
};

// Function to connect to MEXC WebSocket
const connectToMEXC = (wsServer, symbol, reconnectDelay = 3000) => {
    const wsUrl = "wss://wbs.mexc.com/ws"; // MEXC WebSocket URL
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
        console.log(`🔗 Connected to MEXC WebSocket for ${symbol}`);
        ws.send(JSON.stringify({
            method: "SUBSCRIPTION",
            params: [`spot@ticker.${symbol}`], // Adjust topic format as needed
            id: 1
        }));
    });

    ws.on("message", (data) => {
        const message = JSON.parse(data);
        if (message.d) {
            wsServer.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message.d));
                }
            });
        }
    });

    ws.on("close", () => {
        console.error(` Disconnected from MEXC WebSocket for ${symbol}. Reconnecting...`);
        setTimeout(() => connectToMEXC(wsServer, symbol, Math.min(reconnectDelay * 2, 60000)), reconnectDelay);
    });

    ws.on("error", (err) => console.error(" MEXC WebSocket Error:", err));
};

// Manage WebSocket Connections for KuCoin & MEXC
const manageExchangeWebSocket = (wss, exchange) => {
    wss.on("connection", (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split("?")[1]);
        const symbol = urlParams.get("symbol")?.toUpperCase();

        if (!symbol) {
            ws.send(JSON.stringify({ error: "Missing 'symbol' parameter in WebSocket connection." }));
            ws.close();
            return;
        }

        console.log(`Client connected to ${exchange.toUpperCase()} WebSocket for ${symbol}`);

        if (exchange === "kucoin") {
            connectToKuCoin(wss, symbol);
        } else if (exchange === "mexc") {
            connectToMEXC(wss, symbol);
        }

        ws.on("close", () => {
            console.log(`Client disconnected from ${exchange.toUpperCase()} WebSocket for ${symbol}`);
        });
    });
};

// Start WebSocket Management
manageExchangeWebSocket(kucoinWSS, "kucoin");
manageExchangeWebSocket(mexcWSS, "mexc");

// Graceful Shutdown Handling
const shutdown = () => {
    console.log("\nShutting down servers...");
    spotWSS.close(() => console.log("Spot WebSocket Server closed."));
    futuresWSS.close(() => console.log("Futures WebSocket Server closed."));
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start Express Server
app.listen(PORT, () => {
    console.log(`REST API Server running on http://localhost:${PORT}`);
});

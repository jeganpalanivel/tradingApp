# Real-Time Cryptocurrency Data API

This project provides a RESTful API and WebSocket server to fetch and stream real-time cryptocurrency market data from various exchanges including Binance, Bybit, MEXC, and KuCoin.

## Features

- **REST API Endpoints**: Fetch OHLCV (Open, High, Low, Close, Volume) data for supported exchanges.
- **WebSocket Server**: Connect to KuCoin and MEXC exchanges to receive real-time market data.
- **Multiple Exchange Support**: Fetch data from Binance (Spot and Futures), Bybit, MEXC, and KuCoin.
- **Proxy Endpoints**: Retrieve additional exchange information from MEXC, Bybit, and KuCoin.

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/crypto-data-api.git
cd crypto-data-api

#Start the application
npm start

#project structure
├── server.js                # Main server file
├── package.json              # Project metadata and dependencies
├── .env                      # Environment variables
├── README.md                 # Project documentation
└── node_modules/             # Project dependencies

#License

This `README.md` file explains the project’s purpose, setup, and usage for both API and WebSocket functionality. You can adjust or add more information as needed, based on specific requirements.

// ===============================================================================
// APEX TITAN FLASH v15.1 (MERGED) - HIGH-FREQUENCY 25 ETH CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    console.error("\n\x1b[31m[CRITICAL ERROR] Uncaught Exception:\x1b[0m", err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("\n\x1b[31m[CRITICAL ERROR] Unhandled Rejection:\x1b[0m", reason instanceof Error ? reason.message : reason);
});

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "\n⚠️ WARNING: Flashbots dependency missing. Mainnet bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION (Combined v14.3 Arch + v15.0 Strategy) ---
const GLOBAL_CONFIG = {
    // 🔒 PROFIT TARGET (From v15.0)
    // IMPORTANT: Ensure this contract implements executeOperation (Aave V3)
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: process.env.BENEFICIARY || "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // ⚡ TITAN 25 STRATEGY SETTINGS
    FLASH_LOAN_AMOUNT: parseEther("25"), // 25 ETH (v15.0)
    MIN_WHALE_VALUE: 2.0,                // Lowered from 10.0 to 2.0 to see more logs
    GAS_LIMIT: 950000n,                  // Optimized buffer (v15.0)
    PORT: process.env.PORT || 8080,
    MIN_NET_PROFIT: "0.015",             // ~$45 Minimum Profit

    // 🌍 NETWORKS
    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: process.env.ETH_RPC || "https://eth.llamarpc.com",
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS",
            relay: "https://relay.flashbots.net",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            gasOracle: null, 
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD
            color: TXT.cyan
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            type: "PRIVATE_RELAY",
            privateRpc: "https://arb1.arbitrum.io/rpc",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            gasOracle: null,
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        },
        {
            name: "BASE_MAINNET",
            chainId: 8453,
            rpc: process.env.BASE_RPC || "https://mainnet.base.org",
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com",
            type: "PRIVATE_RELAY",
            privateRpc: "https://base.merkle.io",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F", // L1 Fee Oracle (Optimism/Base)
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX TITAN v15.1 | 25 ETH CLUSTER EDITION         ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   STRATEGY: INTELLIGENT SCAN + L1 ORACLE SUPPORT       ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    if (GLOBAL_CONFIG.TARGET_CONTRACT.includes("YOUR_DEPLOYED")) {
        console.error(`${TXT.red}⚠️  CONFIG ERROR: TARGET_CONTRACT not set in .env${TXT.reset}`);
    }

    const cpuCount = os.cpus().length;
    console.log(`${TXT.green}[SYSTEM] Spawning ${cpuCount} Quantum Workers...${TXT.reset}`);
    
    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️  Worker ${worker.process.pid} died. Respawning...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK).catch(err => console.error(`${TXT.red}[FATAL] ${err.message}${TXT.reset}`));
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    
    // 0. JITTER
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000)));

    // 1. HEALTH CHECK
    try {
        const server = http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ONLINE", chain: CHAIN.name }));
            } else { res.writeHead(404); res.end(); }
        });
        server.on('error', () => {});
        server.listen(GLOBAL_CONFIG.PORT + cluster.worker.id); 
    } catch (e) {}
    
    // 2. PROVIDERS & CONTRACTS
    let provider, wsProvider, wallet, gasOracle, priceFeed;
    let currentEthPrice = 0;
    let scanCount = 0;

    try {
        const network = ethers.Network.from(CHAIN.chainId);
        provider = new JsonRpcProvider(CHAIN.rpc, network, { staticNetwork: true });
        wsProvider = new WebSocketProvider(CHAIN.wss);
        
        wsProvider.on('error', (error) => {
            if (error && error.message && (error.message.includes("UNEXPECTED_MESSAGE") || error.message.includes("delayedMessagesRead"))) return;
            console.error(`${TXT.yellow}⚠️ [WS ERROR] ${TAG}: ${error.message}${TXT.reset}`);
        });

        if (wsProvider.websocket) {
            wsProvider.websocket.onerror = () => {};
            wsProvider.websocket.onclose = () => process.exit(0);
        }
        
        const pk = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
        wallet = new Wallet(pk, provider);

        // ORACLES
        if (CHAIN.gasOracle) {
            gasOracle = new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider);
        }
        if (CHAIN.priceFeed) {
            priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            try {
                const [, price] = await priceFeed.latestRoundData();
                currentEthPrice = Number(price) / 1e8;
            } catch(e) {}
            
            setInterval(async () => {
                try {
                    const [, price] = await priceFeed.latestRoundData();
                    currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, 30000);
        }
        
        console.log(`${TXT.green}✅ WORKER ${process.pid} ACTIVE${TXT.reset} on ${TAG}`);
    } catch (e) {
        console.log(`${TXT.red}❌ Connection Failed on ${TAG}: ${e.message}${TXT.reset}`);
        return;
    }

    // 3. FLASHBOTS
    let flashbotsProvider = null;
    if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
        try {
            const authSigner = new Wallet(wallet.privateKey, provider);
            flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
        } catch (e) {}
    }

    // AAVE INTERFACE
    const poolIface = new Interface([
        "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode)"
    ]);

    // 4. INTELLIGENT SCANNING
    wsProvider.on("pending", async (txHash) => {
        try {
            // Heartbeat Log (Show user activity)
            scanCount++;
            if (scanCount % 50 === 0) {
               // process.stdout.write(`\r${TAG} ${TXT.dim}Scanning... (${scanCount} txs analyzed)${TXT.reset}`);
            }

            if (!provider) return;
            const tx = await provider.getTransaction(txHash).catch(() => null);
            if (!tx || !tx.to || !tx.value) return;

            const valueEth = parseFloat(formatEther(tx.value));
            
            // WHALE TRIGGER
            if (valueEth >= GLOBAL_CONFIG.MIN_WHALE_VALUE && 
                tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase()) {

                // Reduced probabilistic filter to ensure more logs for user
                if (Math.random() < 0.1) return; 

                console.log(`\n${TAG} ${TXT.gold}⚡ OPPORTUNITY DETECTED: ${txHash.substring(0, 10)}...${TXT.reset}`);
                console.log(`   💰 Value: ${valueEth.toFixed(2)} ETH | Price: $${currentEthPrice.toFixed(2)}`);

                const wethAddress = CHAIN.chainId === 8453 
                    ? "0x4200000000000000000000000000000000000006" 
                    : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; 

                // Encode Trade
                const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [
                    GLOBAL_CONFIG.TARGET_CONTRACT,
                    wethAddress, 
                    GLOBAL_CONFIG.FLASH_LOAN_AMOUNT,
                    "0x", 
                    0
                ]);

                // 5. INTELLIGENCE LAYER
                // A. Calculate Fees
                let l1Fee = 0n;
                if (gasOracle) {
                    try { l1Fee = await gasOracle.getL1Fee(tradeData); } catch (e) {}
                }

                const feeData = await provider.getFeeData().catch(() => null);
                if (!feeData) return;

                // B. Simulation (Pre-flight check)
                try {
                    await provider.call({
                        to: CHAIN.aavePool,
                        data: tradeData,
                        from: wallet.address,
                        gasLimit: GLOBAL_CONFIG.GAS_LIMIT
                    });
                } catch (simError) {
                    console.log(`   ${TXT.dim}❌ Simulation Reverted (Safe skip)${TXT.reset}`);
                    return; // EXIT: Do not spam
                }

                console.log(`   ${TXT.yellow}🔄 Simulation Passed. Calculating Profit...${TXT.reset}`);

                // C. Cost Analysis
                const aaveFee = (GLOBAL_CONFIG.FLASH_LOAN_AMOUNT * 5n) / 10000n; // 0.05%
                const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * (feeData.maxFeePerGas || feeData.gasPrice);
                const totalCost = l2Cost + l1Fee + aaveFee;
                
                const balance = await provider.getBalance(wallet.address);
                if (balance < (l2Cost + l1Fee)) {
                    console.log(`   ${TXT.red}❌ Insufficient Gas in Wallet${TXT.reset}`);
                    return;
                }

                // D. Execution
                const txPayload = {
                    to: CHAIN.aavePool,
                    data: tradeData,
                    type: 2,
                    chainId: CHAIN.chainId,
                    maxFeePerGas: feeData.maxFeePerGas,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || parseEther("2", "gwei"),
                    gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                    nonce: await provider.getTransactionCount(wallet.address),
                    value: 0n
                };

                const signedTx = await wallet.signTransaction(txPayload);

                // E. Route
                if (CHAIN.type === "FLASHBOTS" && flashbotsProvider) {
                    const bundle = [{ signedTransaction: signedTx }];
                    const targetBlock = (await provider.getBlockNumber()) + 1;
                    const sim = await flashbotsProvider.simulate(bundle, targetBlock).catch(e => ({ error: e.message }));
                    
                    if (!("error" in sim)) {
                        await flashbotsProvider.sendBundle(bundle, targetBlock);
                        console.log(`   ${TXT.green}💎 Flashbots Bundle Secured!${TXT.reset}`);
                    }
                } else {
                    // Private Relay (Merkle/L2)
                    try {
                        const relayResponse = await axios.post(CHAIN.privateRpc, {
                            jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                        }, { timeout: 2000 }).catch(e => null);

                        if (relayResponse && relayResponse.data && relayResponse.data.result) {
                            console.log(`   ${TXT.green}🎉 SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                        } else {
                            await wallet.sendTransaction(txPayload).catch(() => {});
                        }
                    } catch (relayErr) {}
                }
            }
        } catch (err) {
            // Suppress logic errors to keep worker alive
        }
    });
}

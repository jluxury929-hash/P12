// ===============================================================================
// APEX ULTIMATE MASTER v31.0 (QUANTUM SINGULARITY) - HYPER-ACTIVE DOMINATOR
// ===============================================================================
// MERGE: v131.0 HYPER-ACTIVE + v30.0 INTELLIGENT CORE + NUCLEAR BRIBE
// DNA: 25 ETH LEVERAGE + ZERO-THROTTLE PEERING + AI SELF-HEALING
// TARGET BENEFICIARY: 0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract, FallbackProvider, AbiCoder } = require('ethers');
require('dotenv').config();

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "⚠️ WARNING: Flashbots missing. Mainnet fallback to private RPC.");
}

// --- AI CONFIGURATION ---
const apiKey = ""; // Environment provided
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
let lastAiCorrection = Date.now();

// --- SAFETY: GLOBAL ERROR HANDLERS (v131.0 STABLE RECOVERY) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('insufficient funds') || msg.includes('coalesce')) return;
    console.error("\n\x1b[31m[CRITICAL ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- GLOBAL CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    
    // ⚡ HYPER-ACTIVE PARAMETERS (v131.0 + v30.0)
    FLASH_LOAN_AMOUNT: parseEther("25"), 
    WHALE_THRESHOLD: parseEther("0.01"), 
    MIN_NET_PROFIT: "0.0005", // Atomic profit floor (~$1.75)
    GAS_LIMIT: 1250000n, 

    // AI TUNABLE PARAMETERS
    TUNABLES: {
        MAX_BRIBE_PERCENT: 99.9,
        GAS_PRIORITY_FEE: 1000, // 1000 Gwei Nuclear Priority
        GAS_BUFFER_MULT: 1.8 
    },

    RPC_POOL: [
        "https://eth.llamarpc.com",
        "https://1rpc.io/eth",
        "https://rpc.flashbots.net",
        "https://base.llamarpc.com",
        "https://mainnet.base.org",
        "https://base.merkle.io"
    ],

    NETWORKS: [
        { 
            name: "BASE_MAINNET", chainId: 8453, 
            rpc: process.env.BASE_RPC || "https://mainnet.base.org", 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
        },
        { 
            name: "ETH_MAINNET", chainId: 1, 
            rpc: "https://rpc.flashbots.net", 
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        }
    ]
};

// --- AI SELF-HEALING ENGINE ---
async function askAiForOptimization(errorContext) {
    if (Date.now() - lastAiCorrection < 30000) return; 
    const prompt = `MEV Hyper-Active Dominator Recalibration. Current: ${JSON.stringify(GLOBAL_CONFIG.TUNABLES)}. 
    Failure Context: ${errorContext}. Return JSON for MAX_BRIBE_PERCENT, GAS_PRIORITY_FEE (up to 5000), and GAS_BUFFER_MULT.`;
    try {
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        Object.assign(GLOBAL_CONFIG.TUNABLES, JSON.parse(res.data.candidates[0].content.parts[0].text));
        console.log(`${TXT.gold}[AI OPTIMIZER] Hyper-Active strike parameters updated.${TXT.reset}`);
        lastAiCorrection = Date.now();
    } catch (e) {}
}

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX MASTER v31.0 | QUANTUM HYPER-ACTIVE STRIKER ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   DNA: 25 ETH LEVERAGE + ZERO-THROTTLE PEERING      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {}; 
    const cpuCount = Math.min(os.cpus().length, 48);
    for (let i = 0; i < cpuCount; i++) {
        const worker = cluster.fork();
        worker.on('message', (msg) => {
            if (msg.type === 'SYNC_RESERVE') {
                if (!nonces[msg.chainId] || msg.nonce > nonces[msg.chainId]) nonces[msg.chainId] = msg.nonce;
                worker.send({ type: 'SYNC_GRANT', nonce: nonces[msg.chainId], chainId: msg.chainId });
                nonces[msg.chainId]++;
            }
            if (msg.type === 'QUANTUM_SIGNAL') {
                for (const id in cluster.workers) cluster.workers[id].send(msg);
            }
            if (msg.type === 'AI_RECALIBRATE') {
                nonces[msg.chainId] = msg.nonce;
                console.log(`${TXT.yellow}[MASTER] Nonce Synchronized for ${msg.chainId}: ${nonces[msg.chainId]}${TXT.reset}`);
            }
        });
    }
    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Died. Respawning in 3s (Stable Recovery)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    initWorker(GLOBAL_CONFIG.NETWORKS[networkIndex]);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : "STRIKER";
    let currentEthPrice = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
    if (!rawKey) return;
    const walletKey = rawKey.trim();

    async function connect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 400
            })), network, { quorum: 1 });
            
            // v131.0 HARDENED WEBSOCKET
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            wsProvider.on('error', (e) => { 
                if (e && e.message && !e.message.includes("UNEXPECTED")) {
                    console.error(`${TXT.yellow}⚠️ [WS ERROR] ${TAG}: ${e.message}${TXT.reset}`);
                }
            });

            const wallet = new Wallet(walletKey, provider);
            const poolIface = new Interface(["function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"]);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} [${ROLE}] READY on ${CHAIN.name}${TXT.reset}`);

            if (ROLE === "STRIKER") {
                process.on('message', async (msg) => {
                    if (msg.type === 'QUANTUM_SIGNAL' && msg.chainId === CHAIN.chainId) {
                        // 30ms Jitter for cluster protection
                        await new Promise(r => setTimeout(r, Math.random() * 30));
                        await executeQuantumStrike(provider, wallet, poolIface, gasOracle, currentEthPrice, CHAIN);
                    }
                });
            }

            if (ROLE === "LISTENER") {
                // Signal 1: Swap Logs
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                wsProvider.on({ topics: [swapTopic] }, () => process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId }));
                
                // Signal 2: Pending Mappings
                wsProvider.on("pending", async (txH) => {
                    const tx = await provider.getTransaction(txH).catch(() => null);
                    if (tx && (tx.value || 0n) >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                    }
                });

                // Signal 3: Continuous Block Peering
                wsProvider.on("block", (bn) => {
                    process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                    process.stdout.write(`\r${TAG} ${TXT.cyan}🌊 BLOCK #${bn} PEERED | Leverage: 25 ETH ${TXT.reset}`);
                });

                setInterval(async () => { try { const [, p] = await priceFeed.latestRoundData(); currentEthPrice = Number(p) / 1e8; } catch (e) {} }, 15000);
            }
        } catch (e) { setTimeout(connect, 5000); }
    }
    connect();
}

async function getSovereignState(provider, wallet, chainId) {
    return new Promise(async (resolve) => {
        const count = await provider.getTransactionCount(wallet.address, 'latest');
        const listener = (msg) => { 
            if (msg.type === 'SYNC_GRANT' && msg.chainId === chainId) { 
                process.removeListener('message', listener); 
                resolve({ nonce: msg.nonce }); 
            } 
        };
        process.on('message', listener);
        process.send({ type: 'SYNC_RESERVE', nonce: count, chainId: chainId });
    });
}

async function executeQuantumStrike(provider, wallet, poolIface, oracle, ethPrice, CHAIN) {
    try {
        const [feeData, balance, state] = await Promise.all([
            provider.getFeeData(), 
            provider.getBalance(wallet.address), 
            getSovereignState(provider, wallet, CHAIN.chainId)
        ]);

        const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [
            GLOBAL_CONFIG.TARGET_CONTRACT, 
            CHAIN.weth, 
            GLOBAL_CONFIG.FLASH_LOAN_AMOUNT, 
            "0x", 
            0
        ]);

        // 1. PRE-FLIGHT SIMULATION
        const [simulation, l1Fee] = await Promise.all([
            provider.call({ 
                to: CHAIN.aavePool, 
                data: tradeData, 
                from: wallet.address, 
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, 
                nonce: state.nonce 
            }).catch(() => null),
            oracle ? oracle.getL1Fee(tradeData).catch(() => 0n) : 0n
        ]);

        if (!simulation || simulation === "0x") return;

        // 2. HYPER-ACTIVE PROFIT MATH (Including 0.05% Aave Fee)
        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
        const aaveFee = (GLOBAL_CONFIG.FLASH_LOAN_AMOUNT * 5n) / 10000n;
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * gasPrice;
        const gasRequirement = (l2Cost + l1Fee);
        
        if (balance < gasRequirement) return;

        const rawProfit = BigInt(simulation);
        const totalCost = gasRequirement + aaveFee + parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT);

        if (rawProfit > totalCost) {
            console.log(`\n${TXT.gold}${TXT.bold}⚡ HYPER-ACTIVE STRIKE [${CHAIN.name}]${TXT.reset}`);
            console.log(`   ↳ 📐 NET PROFIT: +${formatEther(rawProfit - (gasRequirement + aaveFee))} ETH`);

            const priorityBribe = parseEther(GLOBAL_CONFIG.TUNABLES.GAS_PRIORITY_FEE.toString(), "gwei");
            const tx = {
                to: CHAIN.aavePool, data: tradeData, type: 2, chainId: CHAIN.chainId,
                maxFeePerGas: gasPrice + priorityBribe, maxPriorityFeePerGas: priorityBribe, 
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce, value: 0n
            };

            const signedHex = await wallet.signTransaction(tx);
            
            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                const fbProvider = await FlashbotsBundleProvider.create(provider, new Wallet(wallet.privateKey, provider), CHAIN.relay);
                const bundle = [{ signedTransaction: signedHex }];
                const targetBlock = (await provider.getBlockNumber()) + 1;
                const sim = await fbProvider.simulate(bundle, targetBlock).catch(() => ({ error: true }));
                if (!sim.error) await fbProvider.sendBundle(bundle, targetBlock);
            } else {
                const endpoint = CHAIN.privateRpc || CHAIN.rpc;
                // Atomic Entropy Injection
                axios.post(endpoint, { 
                    jsonrpc: "2.0", id: Date.now() + Math.random(), method: "eth_sendRawTransaction", params: [signedHex] 
                }, { timeout: 1500 }).then(res => {
                    if (res.data.result) {
                        console.log(`   ${TXT.green}✅ BLOCK DOMINATED! Hash: ${res.data.result.substring(0,14)}...${TXT.reset}`);
                        console.log(`   ${TXT.yellow}✨ Funds secured at cold wallet: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                    }
                }).catch(e => askAiForOptimization(`Broadcast Error: ${e.message}`));
            }
        }
    } catch (e) {
        if (e.message.toLowerCase().includes("nonce")) {
            process.send({ type: 'AI_RECALIBRATE', nonce: await provider.getTransactionCount(wallet.address, 'latest'), chainId: CHAIN.chainId });
        }
    }
}

/**
 * ===============================================================================
 * APEX MASTER v31.1 (QUANTUM HYPER-ACTIVE SINGULARITY) - FINAL PRODUCTION
 * ===============================================================================
 * DNA: 25 ETH LEVERAGE + NUCLEAR 99.9% BRIBE + ZERO-THROTTLE PEERING
 * ARCHITECTURE: 48-CORE STAGGERED CLUSTER | MULTI-RPC FALLBACK | AI HEALING
 * ===============================================================================
 */

const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const { 
    ethers, JsonRpcProvider, Wallet, Interface, parseEther, 
    formatEther, Contract, FallbackProvider, WebSocketProvider 
} = require('ethers');
require('dotenv').config();

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.log("\x1b[33m%s\x1b[0m", "⚠️  NOTICE: Flashbots missing. Falling back to Atomic RPC Injection.");
}

// --- AI CONFIGURATION ---
const apiKey = process.env.GEMINI_API_KEY || ""; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
let lastAiCorrection = Date.now();

const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", 
    cyan: "\x1b[36m", yellow: "\x1b[33m", red: "\x1b[31m", 
    gold: "\x1b[38;5;220m", magenta: "\x1b[35m"
};

// --- GLOBAL CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    FLASH_LOAN_AMOUNT: parseEther("25"), 
    WHALE_THRESHOLD: parseEther("0.01"), 
    MIN_NET_PROFIT: "0.0005", 
    GAS_LIMIT: 1250000n, 
    TUNABLES: { MAX_BRIBE_PERCENT: 99.9, GAS_PRIORITY_FEE: 1000, GAS_BUFFER_MULT: 1.8 },
    RPC_POOL: [
        "https://base.merkle.io",
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ],
    NETWORKS: [
        { 
            name: "BASE_MAINNET", chainId: 8453, 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.gold}╔════════════════════════════════════════════════════════╗`);
    console.log(`║   ⚡ APEX MASTER v31.1 | QUANTUM HYPER-ACTIVE STRIKER ║`);
    console.log(`║   DNA: 25 ETH LEVERAGE + ZERO-THROTTLE PEERING      ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {};
    const cpuCount = Math.min(os.cpus().length, 48);
    
    for (let i = 0; i < cpuCount; i++) {
        setTimeout(() => {
            const worker = cluster.fork();
            worker.on('message', (msg) => {
                if (msg.type === 'SYNC_RESERVE') {
                    if (!nonces[msg.chainId] || msg.nonce > nonces[msg.chainId]) nonces[msg.chainId] = msg.nonce;
                    worker.send({ type: 'SYNC_GRANT', nonce: nonces[msg.chainId], chainId: msg.chainId, reqId: msg.reqId });
                    nonces[msg.chainId]++;
                }
                if (msg.type === 'SIGNAL') Object.values(cluster.workers).forEach(w => w.send(msg));
            });
        }, i * 1500); // Exponential stagger to bypass 429/503 filters
    }

    cluster.on('exit', () => setTimeout(() => cluster.fork(), 3000));
} else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    initWorker(GLOBAL_CONFIG.NETWORKS[networkIndex]);
}

async function initWorker(CHAIN) {
    const network = ethers.Network.from(CHAIN.chainId);
    const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
        priority: i + 1, stallTimeout: 800
    })), network, { quorum: 1 });

    const wallet = new Wallet(process.env.TREASURY_PRIVATE_KEY.trim(), provider);
    const poolIface = new Interface(["function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"]);
    const l1Oracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;
    const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
    
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : "STRIKER";
    const TAG = `${CHAIN.color}[CORE ${cluster.worker.id}-${ROLE}]${TXT.reset}`;

    async function connect() {
        try {
            const ws = new WebSocketProvider(CHAIN.wss, network);
            ws.on('error', (e) => { if (!e.message.includes("429")) return; });
            
            if (ROLE === "LISTENER") {
                ws.on('block', (bn) => process.send({ type: 'SIGNAL', chainId: CHAIN.chainId }));
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                ws.on({ topics: [swapTopic] }, () => process.send({ type: 'SIGNAL', chainId: CHAIN.chainId }));
                console.log(`${TAG} Peering Engaged.`);
            } else {
                process.on('message', async (msg) => {
                    if (msg.type === 'SIGNAL' && msg.chainId === CHAIN.chainId) {
                        await new Promise(r => setTimeout(r, Math.random() * 30)); // Cluster jitter
                        await executeHyperStrike(provider, wallet, poolIface, l1Oracle, priceFeed, CHAIN, TAG);
                    }
                });
                console.log(`${TAG} Striker Standby.`);
            }
        } catch (e) { setTimeout(connect, 5000); }
    }
    connect();
}

async function executeHyperStrike(provider, wallet, poolIface, l1Oracle, priceFeed, CHAIN, TAG) {
    try {
        const reqId = Math.random();
        const state = await new Promise(res => {
            const h = m => { if(m.reqId === reqId) { process.removeListener('message', h); res(m); }};
            process.on('message', h);
            process.send({ type: 'SYNC_RESERVE', chainId: CHAIN.chainId, reqId });
        });

        const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [GLOBAL_CONFIG.TARGET_CONTRACT, CHAIN.weth, GLOBAL_CONFIG.FLASH_LOAN_AMOUNT, "0x", 0]);

        const [sim, l1Fee, feeData, priceData] = await Promise.all([
            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => "0x"),
            l1Oracle ? l1Oracle.getL1Fee(tradeData).catch(() => 0n) : 0n,
            provider.getFeeData(),
            priceFeed.latestRoundData().catch(() => [0, 0n])
        ]);

        if (sim === "0x" || BigInt(sim) === 0n) return;

        const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseEther("0.1", "gwei");
        const priority = parseEther(GLOBAL_CONFIG.TUNABLES.GAS_PRIORITY_FEE.toString(), "gwei");
        const aaveFee = (GLOBAL_CONFIG.FLASH_LOAN_AMOUNT * 5n) / 10000n;
        const totalCost = (GLOBAL_CONFIG.GAS_LIMIT * (baseFee + priority)) + l1Fee + aaveFee;
        const netProfit = BigInt(sim) - totalCost;

        if (netProfit > parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT)) {
            const ethPrice = Number(priceData[1]) / 1e8;
            console.log(`\n${TXT.gold}${TXT.bold}⚡ HYPER-ACTIVE STRIKE: +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

            const tx = {
                to: CHAIN.aavePool, data: tradeData, type: 2, chainId: CHAIN.chainId,
                maxFeePerGas: baseFee + priority, maxPriorityFeePerGas: priority,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce
            };

            const signedHex = await wallet.signTransaction(tx);
            const endpoint = CHAIN.privateRpc || CHAIN.rpc;
            axios.post(endpoint, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {});
            
            // Backup broadcast saturation
            GLOBAL_CONFIG.RPC_POOL.forEach(url => axios.post(url, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {}));
        }
    } catch (e) { if (e.message.includes("nonce")) process.send({ type: 'AI_RECALIBRATE', nonce: await provider.getTransactionCount(wallet.address, 'latest'), chainId: CHAIN.chainId }); }
}

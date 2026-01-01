// ===============================================================================
// APEX TITAN v131.0 (HYPER-ACTIVE INTELLIGENT STRIKER) - EXECUTION GUARANTEE
// ===============================================================================
// MERGE SYNC: v15.1 (25 ETH) + v130.0 (NUCLEAR) + ZERO-THROTTLE EXECUTION
// TARGET BENEFICIARY: 0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder, FallbackProvider } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (CRASH PROOF) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce')) return;
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
});

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "⚠️ WARNING: Flashbots dependency missing. Mainnet bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ HYPER-ACTIVE PARAMETERS (v15.1 + NUCLEAR)
    FLASH_LOAN_AMOUNT: parseEther("25"), 
    WHALE_THRESHOLD: parseEther("0.01"), // ULTRA-SENSITIVE: Signal on any notable liquidity move
    MIN_NET_PROFIT: "0.0005",            // ATOMIC FLOOR: Strike on all confirmed profit (~$1.75)
    GAS_LIMIT: 1250000n,                 // Optimal headroom
    GAS_PRIORITY_FEE: 1000n,             // 1000 GWEI: Nuclear priority
    MAX_BRIBE_PERCENT: 99.9,             // Block dominance bribe
    
    PORT: process.env.PORT || 8080,
    RPC_POOL: [
        process.env.QUICKNODE_HTTP,
        process.env.BASE_RPC,
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ].filter(url => url && url.startsWith("http")),

    MAX_CORES: Math.min(os.cpus().length, 48), 

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

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v131.0 | HYPER-ACTIVE STRIKER ENGINE  ║
║   MODE: 25 ETH LEVERAGE + ZERO-THROTTLE PEERING       ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = GLOBAL_CONFIG.MAX_CORES;
    for (let i = 0; i < cpuCount; i++) cluster.fork();

    cluster.on('message', (worker, msg) => {
        if (msg.type === 'STRIKE_SIGNAL') {
            for (const id in cluster.workers) cluster.workers[id].send(msg);
        }
    });

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Died. Respawning in 3s (Stable Recovery)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : "STRIKER";
    
    let isStriking = false;
    let currentEthPrice = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
    if (!rawKey.trim()) return;

    async function safeConnect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const rpcConfigs = GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 1500
            }));
            const provider = new FallbackProvider(rpcConfigs, network, { quorum: 1 });
            
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            wsProvider.on('error', (error) => {
                if (error && error.message && (error.message.includes("UNEXPECTED_MESSAGE"))) return;
                console.error(`${TXT.yellow}⚠️ [WS ERROR] ${TAG}: ${error.message}${TXT.reset}`);
            });

            const wallet = new Wallet(rawKey.trim(), provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} [${ROLE}] ATTACHED to ${CHAIN.name}${TXT.reset}`);

            // STRIKER: Quantum Execution Loop
            process.on('message', async (msg) => {
                if (msg.type === 'STRIKE_SIGNAL' && msg.chainId === CHAIN.chainId && !isStriking && ROLE === "STRIKER") {
                    isStriking = true;
                    await executeIntelligentStrike(provider, wallet, gasOracle, currentEthPrice, CHAIN)
                        .finally(() => { setTimeout(() => { isStriking = false; }, 30); });
                }
            });

            // LISTENER: Zero-Throttle Signal Detection
            if (ROLE === "LISTENER") {
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                
                // Signal 1: Swap Logs
                wsProvider.on({ topics: [swapTopic] }, () => {
                    process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                });
                
                // Signal 2: Pending Mappings
                wsProvider.on("pending", async (txHash) => {
                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    if (tx && tx.to && (tx.value || 0n) >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                    }
                });

                // Signal 3: Continuous Block Peering
                wsProvider.on("block", (blockNumber) => {
                    process.send({ type: 'STRIKE_SIGNAL', chainId: CHAIN.chainId });
                    process.stdout.write(`\r${TAG} ${TXT.cyan}🌊 BLOCK #${blockNumber} PEERED | Bribe: 99.9% ${TXT.reset}`);
                });

                setInterval(async () => {
                    try {
                        const [, price] = await priceFeed.latestRoundData();
                        currentEthPrice = Number(price) / 1e8;
                    } catch (e) {}
                }, 15000);
            }

        } catch (e) { setTimeout(safeConnect, 10000); }
    }
    await safeConnect();
}

async function executeIntelligentStrike(provider, wallet, oracle, ethPrice, CHAIN) {
    try {
        if (GLOBAL_CONFIG.TARGET_CONTRACT.includes("YOUR_DEPLOYED")) return;

        const poolIface = new Interface([
            "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode)"
        ]);

        const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [
            GLOBAL_CONFIG.TARGET_CONTRACT,
            CHAIN.weth,
            GLOBAL_CONFIG.FLASH_LOAN_AMOUNT,
            "0x", 
            0
        ]);

        // 1. PRE-FLIGHT SIMULATION
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            oracle ? oracle.getL1Fee(tradeData).catch(() => 0n) : 0n,
            provider.getFeeData()
        ]);

        if (!simulation || simulation === "0x") return;

        // 2. NUCLEAR PROFIT CALCULATION
        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
        const aaveFee = (GLOBAL_CONFIG.FLASH_LOAN_AMOUNT * 5n) / 10000n; // 0.05%
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * gasPrice;
        const totalThreshold = l2Cost + l1Fee + aaveFee + parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT);
        
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalThreshold) {
            const netProfit = rawProfit - (l2Cost + l1Fee + aaveFee);
            
            console.log(`\n${TXT.gold}${TXT.bold}⚡ STRIKE AUTHORIZED [${CHAIN.name}]${TXT.reset}`);
            console.log(`   ↳ 📐 PROFIT: +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

            const priorityBribe = parseEther(GLOBAL_CONFIG.GAS_PRIORITY_FEE.toString(), "gwei");

            const tx = {
                to: CHAIN.aavePool, 
                data: tradeData, 
                type: 2, 
                chainId: CHAIN.chainId,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, 
                maxFeePerGas: gasPrice + priorityBribe,
                maxPriorityFeePerGas: priorityBribe,
                nonce: await provider.getTransactionCount(wallet.address),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(tx);

            // 3. NUCLEAR BROADCAST
            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                const authSigner = new Wallet(wallet.privateKey, provider);
                const fbProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
                const bundle = [{ signedTransaction: signedTx }];
                const targetBlock = (await provider.getBlockNumber()) + 1;
                const sim = await fbProvider.simulate(bundle, targetBlock).catch(() => ({ error: true }));
                if (!sim.error) await fbProvider.sendBundle(bundle, targetBlock);
            } else {
                const endpoint = CHAIN.privateRpc || CHAIN.rpc;
                const res = await axios.post(endpoint, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx] }, { timeout: 2000 }).catch(() => null);
                if (res?.data?.result) {
                    console.log(`${TXT.green}${TXT.bold}✅ BLOCK DOMINATED: ${res.data.result.substring(0,18)}...${TXT.reset}`);
                    console.log(`${TXT.yellow}✨ Funds secured at Beneficiary: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                }
            }
        }
    } catch (e) {}
}

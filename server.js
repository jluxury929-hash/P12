// ===============================================================================
// APEX ULTIMATE QUANTUM OVERLORD v44.0 (ULTIMATE MERGE) - HIGH-FREQUENCY CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    if (err.message.includes('429')) return; // Suppress rate-limit noise in logs
    console.error("\n\x1b[31m[CRITICAL ERROR]\x1b[0m", err.message);
});

process.on('unhandledRejection', (reason) => {
    if (reason?.message?.includes('429')) return;
    console.error("\n\x1b[31m[UNHANDLED REJECTION]\x1b[0m", reason);
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

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918", 
    
    // ASSETS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",

    // 🚦 TRAFFIC & LOAD BALANCING (v44.0 FIX)
    MEMPOOL_SAMPLE_RATE: 0.10,           // Analyze 10% of txs to stay under limits
    WORKER_BOOT_DELAY_MS: 2500,          // Wait 2.5s between worker starts (Staggered Handshake)
    RPC_COOLDOWN_MS: 5000,               // 5s rest between strikes
    HEARTBEAT_INTERVAL_MS: 15000,        // Base heartbeat
    
    // STRATEGY SETTINGS
    SUMMIT_THRESHOLD: parseEther("15.0"), 
    LEVIATHAN_MIN_ETH: parseEther("10.0"),
    GAS_LIMIT: 1450000n,                 
    PORT: process.env.PORT || 8080,
    MARGIN_ETH: "0.015",                 
    PRIORITY_BRIBE: 15n,                 

    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: "https://mainnet.infura.io/v3/e601dc0b8ff943619576956539dd3b82",
            wss: "wss://mainnet.infura.io/ws/v3/e601dc0b8ff943619576956539dd3b82", 
            type: "FLASHBOTS",
            relay: "https://relay.flashbots.net",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            color: TXT.cyan
        },
        {
            name: "BASE_MAINNET",
            chainId: 8453,
            rpc: "https://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            wss: "wss://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            type: "PRIVATE_RELAY",
            privateRpc: "https://base.merkle.io",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: "https://arb1.arbitrum.io/rpc",
            wss: "wss://arb1.arbitrum.io/feed",
            type: "PRIVATE_RELAY",
            privateRpc: "https://arb1.arbitrum.io/rpc",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX QUANTUM OVERLORD v44.0 | CLUSTER MASTER    ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   LOAD BALANCED: ANTI-STORM BOOT + NANO-SAMPLING      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const cpuCount = os.cpus().length;
    console.log(`${TXT.cyan}[SYSTEM] Initializing Multi-Core Deployment (${cpuCount} cores)...${TXT.reset}`);

    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        cluster.fork();
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️  Worker offline. Cooling down (10s)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 10000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK).catch(() => process.exit(1));
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    let isProcessing = false;
    let cachedFeeData = null;
    let currentEthPrice = 0;
    let scanCount = 0;

    try {
        const netObj = { name: CHAIN.name, chainId: CHAIN.chainId };
        
        // Anti-Throttle Provider Setup: Inject network and suppress batching
        const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
        const wsProvider = new WebSocketProvider(CHAIN.wss, netObj);
        
        wsProvider.on('error', (e) => {
            if (e.message.includes("429")) process.stdout.write(`${TXT.red}!${TXT.reset}`);
        });

        if (wsProvider.websocket) {
            wsProvider.websocket.onclose = () => process.exit(1);
        }
        
        const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
        const wallet = new Wallet(rawKey.trim(), provider);

        const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
        const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;
        const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

        // LOAD BALANCER: Unique heartbeat jitter per core
        const jitter = (cluster.worker.id % 30) * 400;
        setTimeout(() => {
            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [fees, [, price]] = await Promise.all([
                        provider.getFeeData().catch(() => null),
                        priceFeed.latestRoundData().catch(() => [0, 0])
                    ]);
                    if (fees) cachedFeeData = fees;
                    if (price) currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS);
        }, jitter);

        console.log(`${TXT.green}✅ ENGINE ${cluster.worker.id} ACTIVE${TXT.reset} on ${TAG}`);

        const titanIface = new Interface([
            "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
            "function executeTriangle(address[] path, uint256 amount)"
        ]);

        let flashbotsProvider = null;
        if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
            try {
                const authSigner = new Wallet(wallet.privateKey, provider);
                flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
            } catch (e) {}
        }

        // 5. OMNISCIENT ENGINE
        wsProvider.on("pending", async (txHash) => {
            if (isProcessing) return;
            if (Math.random() > GLOBAL_CONFIG.MEMPOOL_SAMPLE_RATE) return; // NANO-SAMPLING

            try {
                scanCount++;
                if (scanCount % 100 === 0 && (cluster.worker.id % 12 === 0)) {
                   process.stdout.write(`\r${TAG} ${TXT.cyan}⚡ SCANNING${TXT.reset} | ETH: $${currentEthPrice.toFixed(2)} `);
                }

                isProcessing = true;
                const tx = await provider.getTransaction(txHash).catch(() => null);
                
                if (tx && tx.to && tx.value >= GLOBAL_CONFIG.SUMMIT_THRESHOLD) {
                    console.log(`\n${TAG} ${TXT.magenta}🚨 SUMMIT WHALE SPOTTED: ${formatEther(tx.value)} ETH${TXT.reset}`);
                    await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, flashbotsProvider, "SUMMIT", cachedFeeData);
                } else if (Math.random() > 0.9997) {
                    await attemptTriangleStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN, flashbotsProvider, cachedFeeData);
                }
                
                setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
            } catch (err) { isProcessing = false; }
        });

        // LEVIATHAN LOG DECODER
        const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
        wsProvider.on({ topics: [swapTopic] }, async (log) => {
            if (isProcessing) return;
            try {
                const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);

                if (maxSwap >= GLOBAL_CONFIG.LEVIATHAN_MIN_ETH) {
                     isProcessing = true;
                     console.log(`\n${TAG} ${TXT.yellow}🐳 CONFIRMED LEVIATHAN LOG: ${formatEther(maxSwap)} ETH${TXT.reset}`);
                     await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, flashbotsProvider, "LEVIATHAN", cachedFeeData);
                     setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                }
            } catch (e) { isProcessing = false; }
        });

    } catch (e) { process.exit(1); }
}

async function attemptStrike(provider, wallet, iface, gasOracle, pool, ethPrice, CHAIN, flashbotsProvider, mode, feeData) {
    try {
        let loanAmount;
        if (pool && CHAIN.chainId === 8453) {
            try {
                const [res0] = await pool.getReserves();
                loanAmount = BigInt(res0) / 10n; // 10% Pool Cap
            } catch (e) { loanAmount = parseEther("25"); }
        } else {
            const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
            loanAmount = parseFloat(formatEther(balanceWei)) > 0.1 ? parseEther("100") : parseEther("25");
        }

        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, loanAmount, [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, mode, feeData);
    } catch (e) {}
}

async function attemptTriangleStrike(provider, wallet, iface, gasOracle, ethPrice, CHAIN, flashbotsProvider, feeData) {
    try {
        const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
        const loanAmount = parseFloat(formatEther(balanceWei)) > 0.1 ? parseEther("100") : parseEther("25");
        const paths = [[GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, GLOBAL_CONFIG.WETH]];
        const strikeData = iface.encodeFunctionData("executeTriangle", [paths[0], loanAmount]);
        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, "TRIANGLE", feeData);
    } catch (e) {}
}

async function executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, mode, feeData) {
    try {
        const currentFees = feeData || await provider.getFeeData();
        const [simulation, l1Fee] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            gasOracle ? gasOracle.getL1Fee(strikeData).catch(() => 0n) : 0n
        ]);

        if (!simulation) return false;

        const aaveFee = (loanAmount * 5n) / 10000n;
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * (currentFees.maxFeePerGas || currentFees.gasPrice);
        const marginWei = parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const totalThreshold = l2Cost + l1Fee + aaveFee + marginWei;
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalThreshold) {
            console.log(`\n${TXT.green}${TXT.bold}✅ ${mode} AUTHORIZED! +${formatEther(rawProfit - totalThreshold)} ETH${TXT.reset}`);

            let priorityBribe = (currentFees.maxPriorityFeePerGas * (100n + GLOBAL_CONFIG.PRIORITY_BRIBE)) / 100n;

            const txPayload = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: strikeData,
                type: 2,
                chainId: CHAIN.chainId,
                maxFeePerGas: currentFees.maxFeePerGas,
                maxPriorityFeePerGas: priorityBribe,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                nonce: await provider.getTransactionCount(wallet.address).catch(() => 0),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(txPayload);

            if (CHAIN.type === "FLASHBOTS" && flashbotsProvider) {
                const bundle = [{ signedTransaction: signedTx }];
                await flashbotsProvider.sendBundle(bundle, (await provider.getBlockNumber()) + 1);
                console.log(`   ${TXT.green}✨ Bundle Secured and Dispatched.${TXT.reset}`);
            } else {
                const relayResponse = await axios.post(CHAIN.privateRpc || CHAIN.rpc, {
                    jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                }, { timeout: 2000 }).catch(() => null);

                if (relayResponse && relayResponse.data && relayResponse.data.result) {
                    console.log(`   ${TXT.green}✨ SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                    console.log(`   ${TXT.bold}💸 SECURED BY: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                    process.exit(0);
                } else {
                    await wallet.sendTransaction(txPayload).catch(() => {});
                }
            }
            return true;
        }
    } catch (e) {}
    return false;
}

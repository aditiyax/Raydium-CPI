import {Connection,clusterApiUrl,Keypair, PublicKey,Transaction} from "@solana/web3.js";
import {createMint,getMint, mintTo,getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID,} from '@solana/spl-token';
import { MarketV2,MAINNET_PROGRAM_ID, Liquidity, BNDivCeil,TxVersion, SPL_ACCOUNT_LAYOUT, TokenAccount, TokenAmount, Token, Percent } from '@raydium-io/raydium-sdk';
import {
    ApiPoolInfoV4,
    LIQUIDITY_STATE_LAYOUT_V4,
    MARKET_STATE_LAYOUT_V3,
    Market,
    SPL_MINT_LAYOUT,
    LiquidityPoolKeys, 
    jsonInfo2PoolKeys,
  } from '@raydium-io/raydium-sdk'; 
import Decimal from "decimal.js"; // Assuming Decimal is used for priceLimity

const BN = require('bn.js');

const connection=new Connection(clusterApiUrl('devnet'),'confirmed');

const market=async()=>{
    
    const payer=Keypair.generate();
    //Keypair.fromSecretKey()
    const targetMarketId=Keypair.generate().publicKey;  

    //token created :
    
    let token1=await createMint(
        connection,
        payer,
        payer.publicKey,
        null,
        9
    );
    
    
    let token2=await createMint(
        connection, 
        payer,
        payer.publicKey,
        null,
        9
    );

    const mintInfo1=await getMint(
        connection,
        token1,
    )

    const mintInfo2=await getMint(
        connection,
        token2,
    );

    const Token1Ata=await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        token1,
        payer.publicKey,
    );

    const Token2Ata=await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        token2,
        payer.publicKey
    )
    
    await mintTo(connection, payer, token1, Token1Ata.address, payer.publicKey, 1000000000); // 1000 tokens
    await mintTo(connection, payer, token2, Token2Ata.address, payer.publicKey, 1000000000); 

    const SOL = new PublicKey('So11111111111111111111111111111111111111112');
    
    const startTime = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; 
    const walletAccount=await getWalletTokenAccount(connection,payer.publicKey);
    
    
    // Pool Created :
    const makeTxVersion=TxVersion.V0;
   const makeCreatePool= Liquidity.makeCreatePoolV4InstructionV2Simple({
     connection,
     programId:MAINNET_PROGRAM_ID.AmmV4,
     marketInfo:{
        marketId: targetMarketId,
        programId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
     },
     baseMintInfo:{mint:token1,decimals:9},
     quoteMintInfo:{mint:SOL,decimals:9},
     baseAmount:new BN(10000),
     quoteAmount:new BN(10000),
     startTime: new BN(Math.floor(startTime)),
    ownerInfo: {
      feePayer: payer.publicKey,
      wallet: payer.publicKey,
      tokenAccounts:walletAccount,
      useSOLBalance: true,
    },
    associatedOnly: false,
    checkCreateATAOwner: true,
    makeTxVersion,
    feeDestinationId: new PublicKey('7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'), // only mainnet use this
   })

    
   // Add Liquidity 
   const poolKeys = await connection.getAccountInfo(makeCreatePool);
   if (!poolKeys) return;

const targetPoolInfo = await formatAmmKeysById(makeCreatePool.toString());
//   assert(targetPoolInfo, 'cannot find the target pool')
  //const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

   const extraPoolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
   const { maxAnotherAmount, anotherAmount, liquidity } = Liquidity.computeAnotherAmount({
     poolKeys,
     poolInfo: { ...targetPoolInfo, ...extraPoolInfo },
     amount: new TokenAmount(new Token(TOKEN_PROGRAM_ID,token1,9,'krishan','krishan'),100),
     anotherCurrency: new Token(TOKEN_PROGRAM_ID,SOL,9,'SOL','SOL'),
     slippage: new Percent(1,100),
   })
 
   console.log('will add liquidity info', {
     liquidity: liquidity.toString(),
     liquidityD: new Decimal(liquidity.toString()).div(10 ** extraPoolInfo.lpDecimals),
   })
 
   // -------- step 2: make instructions --------
   const addLiquidityInstructionResponse = await Liquidity.makeAddLiquidityInstructionSimple({
     connection,
     poolKeys,
     userKeys: {
       owner: payer.publicKey,
       payer: payer.publicKey,
       tokenAccounts: walletAccount,
     },
     amountInA: new TokenAmount(new Token(TOKEN_PROGRAM_ID,token1,9,'krishan','krishan'),100),
     amountInB: maxAnotherAmount,
     fixedSide: 'a',
     makeTxVersion,
   })   


//   const POOL_ADDRESS = new PublicKey("8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj");


//const poolKeys: LiquidityPoolKeysV4 =await Liquidity.fetchInfo({ connection, POOL_ADDRESS });
// You should have the tokenA and tokenB accounts ready for swapping

console.log(poolKeys);

const fromTokenAccount = mintInfo1.address;
const toTokenAccount = mintInfo2.address;

// Parameters for the swap function
const amountIn = new BN(1000000); // Amount of input tokens to swap
const minimumAmountOut = new BN(1); // Minimum amount of output tokens expected
const priceLimit = new Decimal(0); // Optional: Set if needed
const remainingAccounts: PublicKey[] = []; // Any additional accounts if necessary

// Owner information
const ownerInfo = {
    feePayer: payer.publicKey,
    wallet: payer.publicKey,
    tokenAccounts: [
        {
            // Example TokenAccount structure
            mint: token1,
            owner: payer.publicKey,
            address: fromTokenAccount,
        },
        {
            mint:SOL,
            owner: payer.publicKey,
            address: toTokenAccount,
        }
    ],
    useSOLBalance: false // Set to true if using SOL instead of an SPL token
};

const swapInstruction = await Liquidity.makeSwapInstruction({
    
    poolKeys,
    userKeys: {
        owner: payer.publicKey,
        tokenAccountIn: fromTokenAccount,
        tokenAccountOut: toTokenAccount,
        //payer: payer.publicKey,
    },
    amountIn,
    amountOut: minimumAmountOut,
    fixedSide: "in" // Assuming you are swapping a fixed amount of input tokens
});

// const swapInstruction = await Liquidity.makeSwapInstruction({
//     connection,
//     poolKeys,
//     userKeys: {
//         owner: payer.publicKey,
//         from: fromTokenAccount,
//         to: toTokenAccount,
//         payer: payer.publicKey,
//     },
//     amountIn,
//     amountOutMin: minimumAmountOut,
//     fixedSide: "in" // Assuming you are swapping a fixed amount of input tokens
// });


// const transaction = new Transaction().add(swapInstruction.innerTransactions[0]);
const transaction = new Transaction().add(swapInstruction.innerTransaction[0]);

const transactionSignature = await connection.sendTransaction(
    transaction,
    [payer],
    { skipPreflight: false, preflightCommitment: "confirmed" }
);

console.log("Swap transaction signature:", transactionSignature);

   
}

market();


async function getWalletTokenAccount(connection: Connection, wallet: PublicKey): Promise<TokenAccount[]> {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
    });
    return walletTokenAccount.value.map((i) => ({
      pubkey: i.pubkey,
      programId: i.account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
  }


  async function formatAmmKeysById(id: string): Promise<ApiPoolInfoV4> {
    const account = await connection.getAccountInfo(new PublicKey(id))
    if (account === null) throw Error(' get id info error ')
    const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data)
  
    const marketId = info.marketId
    const marketAccount = await connection.getAccountInfo(marketId)
    if (marketAccount === null) throw Error(' get market info error')
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)
  
    const lpMint = info.lpMint
    const lpMintAccount = await connection.getAccountInfo(lpMint)
    if (lpMintAccount === null) throw Error(' get lp mint info error')
    const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data)
  
    return {
      id,
      baseMint: info.baseMint.toString(),
      quoteMint: info.quoteMint.toString(),
      lpMint: info.lpMint.toString(),
      baseDecimals: info.baseDecimal.toNumber(),
      quoteDecimals: info.quoteDecimal.toNumber(),
      lpDecimals: lpMintInfo.decimals,
      version: 4,
      programId: account.owner.toString(),
      authority: Liquidity.getAssociatedAuthority({ programId: account.owner }).publicKey.toString(),
      openOrders: info.openOrders.toString(),
      targetOrders: info.targetOrders.toString(),
      baseVault: info.baseVault.toString(),
      quoteVault: info.quoteVault.toString(),
      withdrawQueue: info.withdrawQueue.toString(),
      lpVault: info.lpVault.toString(),
      marketVersion: 3,
      marketProgramId: info.marketProgramId.toString(),
      marketId: info.marketId.toString(),
      marketAuthority: Market.getAssociatedAuthority({ programId: info.marketProgramId, marketId: info.marketId }).publicKey.toString(),
      marketBaseVault: marketInfo.baseVault.toString(),
      marketQuoteVault: marketInfo.quoteVault.toString(),
      marketBids: marketInfo.bids.toString(),
      marketAsks: marketInfo.asks.toString(),
      marketEventQueue: marketInfo.eventQueue.toString(),
      lookupTableAccount: PublicKey.default.toString()
    }
}


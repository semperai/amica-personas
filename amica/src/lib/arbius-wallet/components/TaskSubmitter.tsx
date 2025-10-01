import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { CID } from 'multiformats/cid';
import { base58btc } from 'multiformats/bases/base58';
import { base32 } from 'multiformats/bases/base32';
import { Buffer } from 'buffer';

// Import functions from deterministicWalletUtils
import { initDeterministicWallet, getDeterministicWalletBalances } from '../utils/deterministicWalletUtils';

// Add type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    } | undefined;
  }
}

interface TaskSubmitterProps {
  routerAddress: string;
  modelAddress: string;
  hideHeader?: boolean;
}

// Engine contract address
const ENGINE_ADDRESS = '0x9b51Ef044d3486A1fB0A2D55A6e0CeeAdd323E66';

// AIUS token address
const AIUS_TOKEN_ADDRESS = '0x4a24B101728e07A52053c13FB4dB2BcF490CAbc3';

// Engine ABI (minimal, just for solutions query)
const ENGINE_ABI = [
  'function solutions(bytes32 taskId) view returns (address validator, uint256 blocktime, bool claimed, bytes cid)'
];

// Token ABI (minimal, just for allowance and approve)
const TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const TaskSubmitter: React.FC<TaskSubmitterProps> = ({ routerAddress, modelAddress, hideHeader }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [deterministicWallet, setDeterministicWallet] = useState<ethers.Wallet | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiusBalance, setAiusBalance] = useState<string>('0');
  const [aiusAllowance, setAiusAllowance] = useState<string>('0');
  
  // Add state for task tracking
  const [taskId, setTaskId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [solution, setSolution] = useState<{
    validator: string;
    blocktime: bigint;
    claimed: boolean;
    cid: string;
    decodedCid: string;
    ipfsLink: string | null;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [ipfsContent, setIpfsContent] = useState<string | null>(null);

  // Add effect to check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!window.ethereum) return;

      try {
        // Check if we have a cached connection
        const cachedAddress = localStorage.getItem('walletAddress');
        if (cachedAddress) {
          // Request accounts to see if we're still connected
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0 && accounts[0].toLowerCase() === cachedAddress.toLowerCase()) {
            // We're still connected, restore the connection
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            setUserAddress(address);
            setIsConnected(true);

            // Initialize deterministic wallet
            const wallet = await initDeterministicWallet(
              ethers,
              address,
              (message: string) => signer.signMessage(message),
              provider
            );
            setDeterministicWallet(wallet);
            
            // Check AIUS balance and allowance
            await checkAiusTokens();
          } else {
            // Clear cached address if it doesn't match
            localStorage.removeItem('walletAddress');
          }
        }
      } catch (err) {
        console.error('Error checking existing connection:', err);
        localStorage.removeItem('walletAddress');
      }
    };

    checkExistingConnection();
  }, []);

  // Initialize Web3 and provider
  const initWeb3 = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    return { provider, signer, address };
  };

  // Check AIUS balance and allowance
  const checkAiusTokens = async () => {
    if (!deterministicWallet?.address || !window.ethereum || !userAddress) return;
    
    try {
      console.log('Checking AIUS tokens:');
      console.log('- Token contract address:', AIUS_TOKEN_ADDRESS);
      
      // Create provider directly from window.ethereum for allowance check
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContractForAllowance = new ethers.Contract(
        AIUS_TOKEN_ADDRESS,
        TOKEN_ABI,
        provider // Use a generic provider for allowance check against deterministic wallet
      );
      
      // Get AIUS balance for deterministic wallet using the utility function
      // The utility function requires the ethers library, and the deterministic wallet instance
      // Ensure deterministicWallet is not null and has a provider
      if (deterministicWallet && deterministicWallet.provider) {
        const balances = await getDeterministicWalletBalances(ethers, deterministicWallet);
        setAiusBalance(balances.aius);
        console.log('- Deterministic Wallet AIUS Balance (from util):', balances.aius, 'Address:', deterministicWallet.address);
      } else {
        console.warn('Deterministic wallet or its provider is not available for balance check.');
        // Optionally set balance to 0 or handle as an error
        setAiusBalance('0');
      }
      
      // Also check main wallet balance for debugging
      if (userAddress) {
        try {
          // Use the same tokenContractForAllowance which is connected to a provider
          const mainWalletBalance = await tokenContractForAllowance.balanceOf(userAddress);
          console.log('- Main Wallet AIUS Balance:', ethers.formatEther(mainWalletBalance), 'Address:', userAddress);
        } catch (err) {
          console.error('Error checking main wallet balance:', err);
        }
      }
      
      // Get allowance for router (deterministic wallet is the owner, router is the spender)
      const allowance = await tokenContractForAllowance.allowance(
        deterministicWallet.address, // owner is the deterministic wallet
        routerAddress                 // spender is the router
      );
      const formattedAllowance = ethers.formatEther(allowance);
      setAiusAllowance(formattedAllowance);
      console.log('- AIUS Allowance for router:', formattedAllowance);
      
      // The utility function returns balances, not the raw balance BigInt needed for comparison elsewhere
      // We'll rely on the state `aiusBalance` (string) and parse it where needed, or adjust logic
      // For now, let's return an object similar to what was expected before, focusing on allowance
      // The raw balance BigInt isn't directly returned by the new util structure
      const currentBalanceBigInt = ethers.parseEther(aiusBalance || "0"); // Use state which is updated from util

      return { balance: currentBalanceBigInt, allowance };
    } catch (err) {
      console.error('Error checking AIUS tokens:', err);
      setError(`Failed to check AIUS tokens: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };
  
  // Approve AIUS tokens for router
  const approveAiusTokens = async () => {
    if (!deterministicWallet) return false;
    
    try {
      // Create token contract instance
      const tokenContract = new ethers.Contract(
        AIUS_TOKEN_ADDRESS,
        TOKEN_ABI,
        deterministicWallet
      );
      
      // Max uint256 value for approval
      const maxUint256 = ethers.MaxUint256;
      
      // Call approve function
      const tx = await tokenContract.approve(routerAddress, maxUint256);
      await tx.wait();
      
      // Update allowance state
      const { allowance } = await checkAiusTokens() || { allowance: BigInt(0) };
      
      return true;
    } catch (err) {
      console.error('Error approving AIUS tokens:', err);
      return false;
    }
  };

  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      setError(null);
      
      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }
      
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check which network we're connected to
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      console.log('Connected to network:', network.name, 'Chain ID:', network.chainId.toString());
      
      // Arbitrum One chainId is 42161
      if (network.chainId !== 42161n) {
        console.log('Not connected to Arbitrum. Attempting to switch...');
        try {
          // Try to switch to Arbitrum
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa4b1' }], // 42161 in hex
          });
        } catch (switchError: any) {
          // If the chain hasn't been added to MetaMask, add it
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0xa4b1',
                    chainName: 'Arbitrum One',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                    blockExplorerUrls: ['https://arbiscan.io/'],
                  },
                ],
              });
            } catch (addError) {
              throw new Error('Failed to add Arbitrum network to MetaMask');
            }
          } else {
            throw new Error('Failed to switch to Arbitrum network');
          }
        }
        
        // Verify we're now on Arbitrum
        const updatedNetwork = await provider.getNetwork();
        if (updatedNetwork.chainId !== 42161n) {
          throw new Error('Please switch to Arbitrum network in MetaMask and try again');
        }
        console.log('Successfully switched to Arbitrum');
      }
      
      // initWeb3 returns { provider, signer, address }. 
      // We already have 'provider', so we only need 'signer' and 'address'.
      const { signer, address } = await initWeb3(); 
      setUserAddress(address);
      setIsConnected(true);

      // Store the address in localStorage
      localStorage.setItem('walletAddress', address);

      // Initialize deterministic wallet using the imported function
      const wallet = await initDeterministicWallet(
        ethers,
        address,
        (message: string) => signer.signMessage(message),
        provider
      );
      setDeterministicWallet(wallet);
      
      // Check AIUS balance and allowance
      await checkAiusTokens();

    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      // Clear stored address on error
      localStorage.removeItem('walletAddress');
    }
  };

  // Add effect to handle account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Disconnected
        setIsConnected(false);
        setUserAddress('');
        setDeterministicWallet(null);
        localStorage.removeItem('walletAddress');
      } else {
        // Account changed
        const newAddress = accounts[0];
        setUserAddress(newAddress);
        localStorage.setItem('walletAddress', newAddress);
        // Re-initialize deterministic wallet
        connectWallet();
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, []);

  // Memoize decodeCid
  const decodeCid = useCallback((cidHex: string): string => {
    if (!cidHex || cidHex === '0x') {
      console.log('decodeCid - empty or invalid hex input:', cidHex);
      return '';
    }
    try {
      const hex = cidHex.startsWith('0x') ? cidHex.slice(2) : cidHex;
      if (hex.length === 0) {
          console.log('decodeCid - hex string is empty after stripping 0x:', cidHex);
          return cidHex; 
      }
      const bytes = Buffer.from(hex, 'hex');
      if (bytes.length === 0) {
          console.log('decodeCid - resulting bytes array is empty for hex:', hex);
          return cidHex; 
      }
      const cid = CID.decode(bytes);
      if (cid.version === 0) {
        const cidV0String = cid.toString();
        console.log('decodeCid - CIDv0 decoded:', cidV0String);
        return cidV0String;
      } else {
        const cidV1String = cid.toString(base32);
        console.log('decodeCid - CIDv1 decoded to base32:', cidV1String);
        return cidV1String;
      }
    } catch (e: any) {
      console.error('decodeCid - error during decoding:', e.message, 'for input:', cidHex);
      return cidHex;
    }
  }, []); // decodeCid is pure and doesn't depend on component state/props

  // Memoize getIpfsLink
  const getIpfsLink = useCallback((cidHex: string): string | null => {
    const cid = decodeCid(cidHex); // Uses memoized decodeCid
    if (!cid) return null;
    
    console.log('getIpfsLink - input hex:', cidHex);
    console.log('getIpfsLink - decoded CID:', cid);
    
    if (modelAddress === '0x6cb3eed9fe3f32da1910825b98bd49d537912c99410e7a35f30add137fd3b64c') {
      const link = `https://arbius.mypinata.cloud/ipfs/${cid}/output.txt`;
      console.log('getIpfsLink - generated link:', link);
      return link;
    } else {
      const link = `https://ipfs.arbius.org/ipfs/${cid}/out-1.png`;
      console.log('getIpfsLink - generated link:', link);
      return link;
    }
  }, [modelAddress, decodeCid]); // Depends on modelAddress prop and memoized decodeCid

  // Memoize checkSolution
  const checkSolution = useCallback(async (taskIdToCheck: string) => {
    if (!taskIdToCheck || !deterministicWallet?.provider) return null;
    
    try {
      const engineContract = new ethers.Contract(
        ENGINE_ADDRESS,
        ENGINE_ABI,
        deterministicWallet.provider
      );
      console.log('Checking solution for task ID:', taskIdToCheck);
      const result = await engineContract.solutions(taskIdToCheck);
      console.log('Solution check result:', result);
      const [validator, blocktime, claimed, cid] = result;
      
      console.log('Solution components:');
      console.log('- Validator:', validator);
      console.log('- Blocktime:', blocktime?.toString());
      console.log('- Claimed:', claimed);
      console.log('- CID (raw hex):', cid);
      
      if (!cid || cid === '0x') {
        console.log('No CID yet, still waiting...');
        return null;
      }
      
      const decodedCidStr = decodeCid(cid); // Uses memoized decodeCid
      console.log('- CID (decoded):', decodedCidStr);
      const ipfsLinkStr = getIpfsLink(cid); // Uses memoized getIpfsLink
      console.log('- IPFS Link:', ipfsLinkStr);
      
      return {
        validator,
        blocktime,
        claimed,
        cid,
        decodedCid: decodedCidStr,
        ipfsLink: ipfsLinkStr
      };
    } catch (err) {
      console.error('Error checking solution:', err);
      return null;
    }
  }, [deterministicWallet, decodeCid, getIpfsLink]); // Depends on state and other memoized functions

  // Memoize startPolling
  const startPolling = useCallback(async (taskIdToPoll: string) => {
    if (!taskIdToPoll) return; // Note: async function returns Promise<undefined> here
    
    console.log('Starting to poll for solution with task ID:', taskIdToPoll);
    setIsPolling(true);
    
    let intervalId: NodeJS.Timeout | undefined = undefined;
    let timeoutId: NodeJS.Timeout | undefined = undefined;

    intervalId = setInterval(async () => {
      console.log('Polling for solution for task:', taskIdToPoll);
      const result = await checkSolution(taskIdToPoll); // Uses memoized checkSolution
      
      if (result) {
        console.log('Solution found for task:', taskIdToPoll, result);
        setSolution(result);
        setIsPolling(false);
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId); // Also clear the main timeout
      }
    }, 5000);
    
    timeoutId = setTimeout(() => {
      console.log('Polling stopped after timeout for task:', taskIdToPoll);
      if (intervalId) clearInterval(intervalId);
      setIsPolling(false); 
    }, 10 * 60 * 1000);
    
    // This cleanup function is what the promise returned by startPolling resolves to.
    // It's useful if the polling needs to be stopped externally before it completes naturally.
    return () => {
      console.log('Cleanup function from startPolling promise being called for task:', taskIdToPoll);
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      // Setting isPolling to false here could be tricky if a new poll has already started.
      // The natural stop (solution found/timeout) already handles setIsPolling.
    };
  }, [checkSolution, setSolution, setIsPolling]); // Pass stable setters and memoized checkSolution

  // Effect to start polling when taskId changes
  useEffect(() => {
    let activePollCleanup: (() => void) | null = null;

    if (taskId) {
      startPolling(taskId).then(cleanupFunc => {
        // Store the cleanup function for this specific polling instance.
        // This is useful if the taskId changes again before this poll naturally ends.
        activePollCleanup = cleanupFunc;
      });
    }
    
    // This cleanup runs if taskId changes or component unmounts.
    return () => {
      if (activePollCleanup) {
        console.log('useEffect cleanup: Stopping polling for previous task via its cleanup function.');
        activePollCleanup();
      }
    };
  }, [taskId, startPolling]); // `startPolling` is now memoized

  // Add polling for balance updates
  useEffect(() => {
    if (deterministicWallet?.address) {
      checkAiusTokens(); // Initial check
      const interval = setInterval(checkAiusTokens, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [deterministicWallet?.address]);

  // Fetch IPFS content when solution is found
  useEffect(() => {
    if (solution && solution.ipfsLink) {
      fetch(solution.ipfsLink)
        .then(res => res.text())
        .then(setIpfsContent)
        .catch(err => setIpfsContent(`Error fetching IPFS content: ${err}`));
    } else {
      setIpfsContent(null);
    }
  }, [solution]);

  // Effect to update the page title with a count of polling attempts
  useEffect(() => {
    let pollingCount = 0;
    let titleIntervalId: NodeJS.Timeout | null = null;
    
    if (isPolling && taskId) {
      // Update document title with polling count
      titleIntervalId = setInterval(() => {
        pollingCount++;
        document.title = `Polling (${pollingCount})... | Task Submitter`;
      }, 5000); // Matches polling interval for consistency, but can be different
    } else {
      document.title = 'Task Submitter';
    }
    
    return () => {
      if (titleIntervalId) clearInterval(titleIntervalId);
      document.title = 'Task Submitter'; // Ensure title resets on cleanup
    };
  }, [isPolling, taskId]);

  // Submit task
  const submitTask = async () => {
    if (!deterministicWallet || !prompt) return;

    try {
      setIsSubmitting(true);
      setError(null);
      
      // Format the prompt according to the required template
      const formattedPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|> You are a helpful assistant, keep the response very short and concise.<|eot_id|><|start_header_id|>user<|end_header_id|> ${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;
      
      // Reset task state
      setTaskId(null);
      setTxHash(null);
      setSolution(null);

      // Check if we're on Arbitrum network
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      if (network.chainId !== 42161n) {
        throw new Error('Please switch to Arbitrum network in MetaMask before submitting');
      }
      
      // Check AIUS balance and allowance
      const tokenInfo = await checkAiusTokens();
      if (!tokenInfo) {
        throw new Error('Failed to check AIUS tokens');
      }
      
      const { balance, allowance } = tokenInfo;
      
      // Define model fee - Metabaron model fee is 0.01 AIUS
      const modelFee = ethers.parseEther('0.01');
      
      if (balance < modelFee) {
        throw new Error(`Insufficient AIUS balance. You have ${ethers.formatEther(balance)} AIUS, but need at least 0.01 AIUS`);
      }
      
      // Approve tokens if needed
      if (allowance < modelFee) {
        console.log('Insufficient allowance, approving AIUS tokens...');
        const approved = await approveAiusTokens();
        if (!approved) {
          throw new Error('Failed to approve AIUS tokens');
        }
        console.log('AIUS tokens approved successfully');
      }
      
      const web3 = new Web3(window.ethereum as any);
      const input = JSON.stringify({ prompt: formattedPrompt });
      const bytes = web3.utils.utf8ToHex(input);

      // Use the correct router address
      const checksummedRouterAddress = '0xecAba4E6a4bC1E3DE3e996a8B2c89e8B0626C9a1';
      
      // Convert model address to bytes32
      // Make sure it's properly padded to 32 bytes
      let modelAddressBytes = modelAddress;
      if (modelAddressBytes.startsWith('0x')) {
        modelAddressBytes = modelAddressBytes.slice(2);
      }
      // Ensure it's 64 characters (32 bytes) without 0x prefix
      if (modelAddressBytes.length < 64) {
        modelAddressBytes = modelAddressBytes.padStart(64, '0');
      }
      // Add 0x prefix back
      modelAddressBytes = '0x' + modelAddressBytes;
      
      console.log('Model address:', modelAddress);
      console.log('Model address bytes (padded):', modelAddressBytes);

      // Get account balance
      const ethBalance = await deterministicWallet.provider!.getBalance(deterministicWallet.address);
      console.log('ETH balance:', ethers.formatEther(ethBalance), 'ETH on', network.name);
      
      // Incentive is 0 for token payments
      const incentive = BigInt(0);
      
      // Get gas price with buffer
      const feeData = await deterministicWallet.provider!.getFeeData();
      const gasPrice = feeData.gasPrice!;
      const bufferedGasPrice = gasPrice * 120n / 100n;
      console.log('Gas Price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
      console.log('Buffered Gas Price:', ethers.formatUnits(bufferedGasPrice, 'gwei'), 'gwei');

      // Create a new instance of the deterministic wallet connected to the provider
      const connectedWallet = new ethers.Wallet(deterministicWallet.privateKey, deterministicWallet.provider);
      console.log('Connected wallet address:', connectedWallet.address);

      // Verify token contract and balance
      const tokenContract = new ethers.Contract(
        AIUS_TOKEN_ADDRESS,
        TOKEN_ABI,
        connectedWallet
      );

      // Double check balance and allowance
      const finalBalance = await tokenContract.balanceOf(connectedWallet.address);
      const finalAllowance = await tokenContract.allowance(connectedWallet.address, routerAddress);
      console.log('Final balance check - Balance:', ethers.formatEther(finalBalance), 'Allowance:', ethers.formatEther(finalAllowance));

      if (finalBalance < modelFee) {
        throw new Error(`Insufficient AIUS balance. You have ${ethers.formatEther(finalBalance)} AIUS, but need at least 0.01 AIUS`);
      }

      if (finalAllowance < modelFee) {
        throw new Error(`Insufficient allowance. You have ${ethers.formatEther(finalAllowance)} AIUS allowance, but need at least 0.01 AIUS`);
      }

      // Create router contract instance
      const routerContract = new ethers.Contract(
        routerAddress,
        [
          'function submitTask(uint8 version_, address owner_, bytes32 model_, uint256 fee_, bytes input_, uint256 incentive_, uint256 gas_) returns (bytes32)',
          'function submitTaskWithToken(uint8 version_, address owner_, bytes32 model_, uint256 fee_, bytes input_, uint256 incentive_, address token_, uint256 amountInMax_, uint256 gas_) returns (bytes32)'
        ],
        connectedWallet
      );

      console.log('Submitting task with parameters:');
      console.log('- Version:', 0);
      console.log('- Owner:', connectedWallet.address);
      console.log('- Model:', modelAddressBytes);
      console.log('- Fee:', ethers.formatEther(modelFee));
      console.log('- Input:', bytes);
      console.log('- Incentive:', ethers.formatEther(incentive));
      console.log('- GasPrice:', ethers.formatUnits(gasPrice, 'gwei'));
      console.log('- Using direct submitTask method (no token swap)');

      try {
        // First approve the router to spend AIUS tokens if needed
        // This is necessary even though we've already approved it before
        console.log('Ensuring router has approval to spend AIUS tokens...');
        const tokenContract = new ethers.Contract(
          AIUS_TOKEN_ADDRESS,
          TOKEN_ABI,
          connectedWallet
        );
        
        if (finalAllowance < modelFee) {
          const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
          await approveTx.wait();
          console.log('Approval transaction confirmed');
        } else {
          console.log('Router already has sufficient approval');
        }

        // Submit task directly through contract using the direct method
        console.log('Calling submitTask...');
        const tx = await routerContract.submitTask(
          0, // version
          connectedWallet.address, // owner
          modelAddressBytes, // model
          modelFee, // fee
          bytes, // input
          incentive, // incentive
          gasPrice // gasPrice
        );

        console.log('Transaction sent:', tx.hash);
        setTxHash(tx.hash);
        
        // Wait for transaction receipt
        const receipt = await tx.wait();
        console.log('Transaction receipt:', receipt);
        
        // Extract task ID from events
        let taskIdFromEvents = null;
        if (receipt && receipt.logs) {
          console.log('Transaction logs:', receipt.logs);
          
          for (const log of receipt.logs) {
            console.log('Checking log:', log);
            console.log('Log topics:', log.topics);
            
            if (log.topics && log.topics.length > 0) {
              // The first topic is the event signature
              const eventSignature = log.topics[0];
              console.log('Event signature:', eventSignature);
              
              // For debugging, log all topics
              for (let i = 0; i < log.topics.length; i++) {
                console.log(`Topic ${i}:`, log.topics[i]);
              }
              
              // The task ID is typically the first indexed parameter in the event
              // It's usually in topics[1] if it's the first indexed parameter
              if (log.topics.length > 1) {
                // Found a potential task ID
                taskIdFromEvents = log.topics[1];
                console.log('Found potential task ID:', taskIdFromEvents);
                
                // Verify it looks like a task ID (should be 32 bytes/64 chars)
                if (taskIdFromEvents && 
                    !taskIdFromEvents.startsWith('0x000000000000000000000000') &&
                    taskIdFromEvents.length === 66) {
                  console.log('Valid task ID format confirmed:', taskIdFromEvents);
                  break;
                } else {
                  console.log('Invalid task ID format, continuing search');
                  taskIdFromEvents = null;
                }
              }
            }
          }
        }
        
        if (taskIdFromEvents) {
          console.log('Final task ID:', taskIdFromEvents);
          setTaskId(taskIdFromEvents);
          // Start polling for solution
          startPolling(taskIdFromEvents);
        } else {
          console.error('Could not find task ID in transaction logs');
          
          // Fallback to transaction hash as a potential task ID
          const potentialTaskId = tx.hash;
          console.log('Using transaction hash as fallback task ID:', potentialTaskId);
          setTaskId(potentialTaskId);
          startPolling(potentialTaskId);
        }
      } catch (error) {
        console.error('Detailed error:', error);
        if (error instanceof Error) {
          if (error.message.includes('EXCESSIVE_INPUT_AMOUNT')) {
            throw new Error('The amount of AIUS tokens is too high for the current liquidity. Please try with a smaller amount or wait for more liquidity.');
          } else if (error.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            throw new Error('The output amount would be too low. Please try with a higher slippage tolerance.');
          }
        }
        throw error;
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transfer AIUS tokens from main wallet to deterministic wallet
  const transferAiusTokens = async () => {
    if (!deterministicWallet || !userAddress) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Get signer for main wallet
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      console.log('Transferring AIUS tokens:');
      console.log('- From main wallet:', signerAddress);
      console.log('- To deterministic wallet:', deterministicWallet.address);
      
      // Create token contract instance with the main wallet signer
      const tokenContract = new ethers.Contract(
        AIUS_TOKEN_ADDRESS,
        TOKEN_ABI,
        signer
      );
      
      // Verify the contract has the transfer function
      if (typeof tokenContract.transfer !== 'function') {
        console.error('Contract does not have transfer function:', tokenContract);
        throw new Error('Token contract missing transfer function');
      }
      
      // Amount to transfer (0.02 AIUS)
      const transferAmount = ethers.parseEther('0.02');
      console.log('- Amount:', ethers.formatEther(transferAmount), 'AIUS');
      
      // Check main wallet balance first
      const mainWalletBalance = await tokenContract.balanceOf(signerAddress);
      console.log('- Main wallet balance:', ethers.formatEther(mainWalletBalance), 'AIUS');
      
      if (mainWalletBalance < transferAmount) {
        throw new Error(`Insufficient AIUS in main wallet. You have ${ethers.formatEther(mainWalletBalance)} AIUS, but need at least 0.02 AIUS to transfer.`);
      }
      
      // Transfer tokens
      console.log('Sending transfer transaction...');
      const tx = await tokenContract.transfer(deterministicWallet.address, transferAmount);
      console.log('Transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      // Update balances
      await checkAiusTokens();
      
      return true;
    } catch (err) {
      console.error('Error transferring AIUS tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to transfer AIUS tokens');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {!hideHeader && (
        <h1 className="text-2xl font-bold mb-4">Inference</h1>
      )}
      
      {!isConnected ? (
        <button
          onClick={connectWallet}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Connected: {userAddress}
            {Number(aiusBalance) > 0 && (
              <span className="ml-2">
                (AIUS Balance: {parseFloat(aiusBalance).toFixed(4)})
              </span>
            )}
          </div>
          
          {deterministicWallet && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-medium text-blue-800">Deterministic Wallet</h3>
              <p className="text-sm text-blue-700 break-all">
                Address: {deterministicWallet.address}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                AIUS Balance: {parseFloat(aiusBalance).toFixed(4)}
              </p>
            </div>
          )}
          
          {Number(aiusBalance) < 0.01 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-700">
                Your deterministic wallet needs AIUS tokens. Your main wallet has tokens, but they need to be transferred.
              </p>
              <button
                onClick={transferAiusTokens}
                disabled={isSubmitting}
                className="mt-2 bg-yellow-500 text-white px-4 py-1 rounded text-sm hover:bg-yellow-600"
              >
                Transfer 0.02 AIUS to Deterministic Wallet
              </button>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-2 border rounded"
              rows={4}
              placeholder="Enter your prompt..."
            />
          </div>

          <button
            onClick={submitTask}
            disabled={isSubmitting || !prompt || Number(aiusBalance) < 0.01}
            className={`px-4 py-2 rounded ${
              isSubmitting || !prompt || Number(aiusBalance) < 0.01
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Task'}
          </button>

          {Number(aiusBalance) < 0.01 && (
            <div className="text-red-500 text-sm mt-2">
              Deterministic wallet has insufficient AIUS tokens. You need at least 0.01 AIUS.
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}
          
          {/* Show transaction info */}
          {txHash && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <h3 className="font-semibold">Transaction</h3>
              <div className="text-sm break-all">
                Hash: <a 
                  href={`https://arbiscan.io/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {txHash}
                </a>
              </div>
              
              {taskId && (
                <div className="text-sm break-all mt-1">
                  Task ID: {taskId}
                  <div className="mt-1">
                    <a 
                      href={`https://arbiscan.io/address/${ENGINE_ADDRESS}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View Engine Contract
                    </a>
                  </div>
                </div>
              )}
              
              {isPolling && !solution && (
                <div className="mt-2">
                  <div className="text-orange-500">
                    Polling for solution... This may take a few minutes.
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    AI processing takes time. Your task is in queue with validators.
                  </div>
                  <div className="flex items-center mt-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                    <span className="text-sm text-gray-600">Waiting for validators...</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Show solution when available */}
          {solution && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
              <h3 className="font-semibold text-green-700">Solution Found!</h3>
              
              <div className="mt-2">
                <div className="text-sm">
                  <span className="font-medium">CID:</span> {solution.decodedCid}
                </div>
                
                <div className="text-xs text-gray-500 mt-1">
                  <span className="font-medium">Raw CID (hex):</span> {solution.cid}
                </div>
                
                {solution.ipfsLink && (
                  <div className="mt-2">
                    <a 
                      href={solution.ipfsLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Result on IPFS
                    </a>
                    {ipfsContent && (
                      <div className="mt-2 p-2 bg-gray-50 border rounded text-sm whitespace-pre-wrap">
                        <strong>Output.txt contents:</strong>
                        <br />
                        {ipfsContent}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-2 text-xs text-gray-500">
                  Validator: {solution.validator}
                  <br />
                  Block Time: {new Date(Number(solution.blocktime) * 1000).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskSubmitter; 
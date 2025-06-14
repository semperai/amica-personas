export interface DeploymentAddresses {
  amicaToken: string;
  personaFactory: string;
  bridgeWrapper?: string;
  erc20Implementation: string;
  bridgedAmicaAddress?: string;
}

export interface Deployment {
  chainId: number;
  chainName: string;
  addresses: DeploymentAddresses;
  blockNumber: number;
  timestamp: string;
  deployer: string;
  gasUsed?: string;
  transactionHashes?: {
    amicaToken?: string;
    personaFactory?: string;
    bridgeWrapper?: string;
    erc20Implementation?: string;
  };
}


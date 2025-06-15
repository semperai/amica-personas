export interface DeploymentAddresses {
  amicaToken: string;
  personaFactory: string;
  erc20Implementation: string;
  bridgeWrapper?: string;
  bridgedAmicaAddress?: string;
  stakingRewards?: string;
}

// Extended interface for deployment with implementation addresses
export interface ExtendedDeploymentAddresses extends DeploymentAddresses {
  amicaTokenImpl?: string;
  personaFactoryImpl?: string;
  proxyAdmin?: string;
  [key: string]: string | undefined; // Allow indexing
}

export interface Deployment {
  chainId: number;
  chainName: string;
  addresses: DeploymentAddresses;
  blockNumber: number;
  timestamp: string;
  deployer: string;
  transactionHashes: {
    [key: string]: string;
  };
}

export interface DeploymentSummary {
  timestamp: string;
  mainnetAmicaToken: string;
  deployments: {
    [network: string]: {
      chainId: number;
      [key: string]: any;
    };
  };
  bridgedTokens: {
    [network: string]: string;
  };
}

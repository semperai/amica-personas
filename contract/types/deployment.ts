// types/deployment.ts

export interface DeploymentAddresses {
  amicaToken: string;
  amicaTokenImpl: string;
  personaFactory: string;
  personaFactoryImpl: string;
  personaFactoryViewer: string;
  proxyAdmin: string;
  personaToken: string;
  feeReductionSystem: string;
}

export interface UpgradeHistory {
  timestamp: string;
  fromImpl: string;
  toImpl: string;
  upgrader: string;
}

export interface Deployment {
  chainId: number;
  chainName: string;
  addresses: DeploymentAddresses;
  blockNumber: number;
  timestamp: string;
  deployer: string;
  transactionHashes?: {
    [key: string]: string;
  };
  upgradeHistory?: UpgradeHistory[];
}

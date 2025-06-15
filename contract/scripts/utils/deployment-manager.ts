import * as fs from "fs";
import * as path from "path";
import { Deployment } from "../../types/deployment";

export class DeploymentManager {
  private deploymentsDir: string;

  constructor() {
    this.deploymentsDir = path.join(__dirname, "../../deployments");
    this.ensureDeploymentDir();
  }

  private ensureDeploymentDir(): void {
    if (!fs.existsSync(this.deploymentsDir)) {
      fs.mkdirSync(this.deploymentsDir, { recursive: true });
    }
  }

  private getDeploymentFilePath(chainId: number): string {
    return path.join(this.deploymentsDir, `${chainId}.json`);
  }

  async saveDeployment(deployment: Deployment): Promise<void> {
    const filePath = this.getDeploymentFilePath(deployment.chainId);
    const deployments = await this.loadDeployments(deployment.chainId);

    deployments.push(deployment);

    fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
    console.log(`\n💾 Deployment saved to: ${filePath}`);
  }

  async loadDeployments(chainId: number): Promise<Deployment[]> {
    const filePath = this.getDeploymentFilePath(chainId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading deployments for chain ${chainId}:`, error);
      return [];
    }
  }

  async getLatestDeployment(chainId: number): Promise<Deployment | null> {
    const deployments = await this.loadDeployments(chainId);
    return deployments.length > 0 ? deployments[deployments.length - 1] : null;
  }

  async getAllDeployments(): Promise<{ [chainId: string]: Deployment[] }> {
    const result: { [chainId: string]: Deployment[] } = {};

    if (!fs.existsSync(this.deploymentsDir)) {
      return result;
    }

    const files = fs.readdirSync(this.deploymentsDir);

    for (const file of files) {
      if (file.endsWith(".json") && !file.includes("agent-tokens") && !file.includes("summary")) {
        const chainId = path.basename(file, ".json");
        if (!isNaN(Number(chainId))) {
          result[chainId] = await this.loadDeployments(Number(chainId));
        }
      }
    }

    return result;
  }
}

import * as fs from "fs";
import * as path from "path";
import { Deployment } from "../types/deployment";

export class DeploymentManager {
  private deploymentsPath: string;

  constructor(deploymentsPath: string = "./deployments") {
    this.deploymentsPath = deploymentsPath;
    this.ensureDeploymentDirectory();
  }

  private ensureDeploymentDirectory() {
    if (!fs.existsSync(this.deploymentsPath)) {
      fs.mkdirSync(this.deploymentsPath, { recursive: true });
    }
  }

  private getFilePath(chainId: number): string {
    return path.join(this.deploymentsPath, `${chainId}.json`);
  }

  async saveDeployment(deployment: Deployment): Promise<void> {
    const filePath = this.getFilePath(deployment.chainId);
    
    // Load existing deployments
    const deployments = await this.loadDeployments(deployment.chainId);
    
    // Add new deployment
    deployments.push(deployment);
    
    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2));
    
    console.log(`Deployment saved to ${filePath}`);
  }

  async loadDeployments(chainId: number): Promise<Deployment[]> {
    const filePath = this.getFilePath(chainId);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  }

  async getLatestDeployment(chainId: number): Promise<Deployment | null> {
    const deployments = await this.loadDeployments(chainId);
    
    if (deployments.length === 0) {
      return null;
    }
    
    return deployments[deployments.length - 1];
  }

  async getAllDeployments(): Promise<Record<number, Deployment[]>> {
    const allDeployments: Record<number, Deployment[]> = {};
    
    const files = fs.readdirSync(this.deploymentsPath);
    
    for (const file of files) {
      if (file.endsWith(".json")) {
        const chainId = parseInt(file.replace(".json", ""));
        allDeployments[chainId] = await this.loadDeployments(chainId);
      }
    }
    
    return allDeployments;
  }
}

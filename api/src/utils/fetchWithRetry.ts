import { env } from "@/utils/envConfig";

const TRACK_N = 10;
const speed = new Map<string, number[]>();

export async function fetchWithRetry(
  urls: string | string[],
  options: any,
  retries = env.MAX_RETRIES,
): Promise<Response> {
  let url = "";
  if (typeof urls === "string") {
    url = urls;
  } else {
    url = urls[0];
  }

  try {
    const start = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - start;

    if (!speed.has(url)) {
      speed.set(url, [duration]);
    } else {
      speed.get(url)!.push(duration);
      if (speed.get(url)!.length > TRACK_N) {
        speed.get(url)!.shift();
      }
    }

    const averageSpeed = speed.get(url)!.reduce((a, b) => a + b) / speed.get(url)!.length;

    console.log(`Request to ${url} took ${duration}ms (average: ${averageSpeed}ms)`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying ${url} attempts left: ${retries - 1}`);
      await new Promise((resolve) => setTimeout(resolve, env.RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    } else {
      throw error;
    }
  }
}

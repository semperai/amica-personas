import type { NextFunction, Request, Response } from "express";
import { type Client, connect } from "ts-postgres";
import { authMetrics } from "@/metrics";
import { env } from "@/utils/envConfig";

type PlanType = "anon" | "free" | "pro";

const PER_DAY = 24 * 60 * 60 * 1000;
const _ANON_API_KEY = "default";

let client: Client | null = null;

// for users with an organization
const apiKeyToOrganizationCache = new Map<string, string>();

// key could be ip or organizationId
const accountInfoCache = new Map<
  string,
  {
    plan: PlanType;
    credits: number; // this is credits remaining
    ts: number; // last time we synced
    lastAddedCredits: number; // time we last added credits to account
  }
>();

async function spendCredits(
  ip: string,
  apiKey: string,
  spend: number,
): Promise<{
  plan: PlanType;
  credits: number; // remaining
  ts: number; // last sync
}> {
  // this gets sent to people if database fails
  const failResponse: {
    plan: PlanType;
    credits: number;
    ts: number;
  } = {
    plan: "pro",
    credits: 1000,
    ts: +new Date(),
  };

  async function syncWithDatabase(_creditsUsed: number) {
    if (!client) {
      client = await connect();
    }

    await using stmt = await client.prepare(`
      SELECT
        COALESCE(o."credits", 0) AS credits,
        o.id AS organizationId,
        o."billingPlan" AS "billingPlan"
      FROM "ApiKey" a
      LEFT JOIN "Organization" o ON a."organizationId" = o.id
      WHERE a."hashedKey" = $1

      UNION ALL

      SELECT
        0 as credits,
        NULL as "organizationId",
        NULL as "billingPlan"
      WHERE NOT EXISTS (
          SELECT 1
          FROM "ApiKey"
          WHERE "hashedKey" = $1
      )
      LIMIT 1
    `);

    for await (const obj of stmt.execute([apiKey])) {
      // console.log("found result", obj);

      let newCredits = 0;
      let addNewCredits = false;
      let lastAddedCredits = 0;
      if (!accountInfoCache.has(obj.organizationid)) {
        addNewCredits = true;
        // console.log("add new credits from no cache");
      } else if (accountInfoCache.get(obj.organizationid)!.lastAddedCredits < +new Date() - PER_DAY) {
        addNewCredits = true;
        // console.log("add new credits from time");
      }

      if (addNewCredits) {
        // console.log("add new credits", obj.billingPlan, newCredits);
        if (obj.billingPlan === "free") newCredits = env.FREE_CREDITS_PER_DAY - spend;
        if (obj.billingPlan === "pro") newCredits = env.PRO_CREDITS_PER_DAY - spend;
        lastAddedCredits = +new Date();
      } else {
        const existing = accountInfoCache.get(obj.organizationid);
        if (!existing) {
          // console.log("why would this happen");
          newCredits = 10;
        } else {
          newCredits = existing.credits - spend;
          lastAddedCredits = existing.lastAddedCredits;
        }
      }

      accountInfoCache.set(obj.organizationid, {
        credits: newCredits,
        plan: obj.billingPlan,
        ts: +new Date(),
        lastAddedCredits,
      });

      /*
      // update database with cached credits from accountInfoCache
      await using ustmt = await client.prepare(`
        UPDATE "Organization"
        SET credits = $2
        WHERE id = $1
      `);
      await ustmt.execute([obj.organizationid, newCredits]);
      */

      return {
        organizationId: obj.organizationid,
        plan: obj.billingPlan,
        credits: newCredits,
        ts: +new Date(),
      };
    }

    // no organization associated with apikey
    // ie.. bad api key
    // console.log("no organization associated with apikey");
    return null;
  }

  // this means the user does not have an account / is anon
  if (apiKey === env.ANON_API_KEY) {
    // console.log("default api key");

    if (!accountInfoCache.has(ip)) {
      // console.log("no info cache");

      accountInfoCache.set(ip, {
        plan: "anon",
        credits: env.ANON_CREDITS_PER_DAY - spend,
        ts: +new Date(),
        lastAddedCredits: +new Date(),
      });
    } else {
      // console.log("info cache found");

      const existing = accountInfoCache.get(ip);
      accountInfoCache.set(ip, {
        plan: "anon",
        credits: existing!.credits - spend,
        ts: +new Date(),
        lastAddedCredits: existing!.lastAddedCredits,
      });

      if (existing!.lastAddedCredits < +new Date() - PER_DAY) {
        accountInfoCache.set(ip, {
          plan: "anon",
          credits: env.ANON_CREDITS_PER_DAY - spend,
          ts: +new Date(),
          lastAddedCredits: +new Date(),
        });
      }
    }

    return accountInfoCache.get(ip)!;
  }

  // if we make it here, the user has included an api key

  // but, we do not yet have it cached
  if (!apiKeyToOrganizationCache.has(apiKey)) {
    // console.log("not found in api key cache");

    try {
      // console.log("first sync");
      const sync = await syncWithDatabase(0);
      // console.log("sync results from first sync", sync);

      // no organization found for api key (invalid api key)
      if (!sync || !sync.organizationId) {
        console.warn("invalid api key found");
        // TODO there is a DOS risk here...
        // someone could just use bad api keys and cause db queries
        // we should block them from api for some time if they continue to use bad key
        return {
          plan: "anon",
          credits: -1,
          ts: +new Date(),
        };
      }

      // console.log("we made it here", sync);
      apiKeyToOrganizationCache.set(apiKey, sync.organizationId);

      accountInfoCache.set(sync.organizationId, {
        credits: sync.credits,
        plan: sync.plan,
        ts: +new Date(),
        lastAddedCredits: +new Date(),
      });
    } catch (e) {
      console.error(e);

      // if database read fails we should handle gracefully by giving some allotment
      return failResponse;
    }
  }

  // if we make it here, the apikey is already stored in cache
  // so we can see if it needs to be resynced or otherwise just use in-memory cache

  const organizationId = apiKeyToOrganizationCache.get(apiKey);
  if (!organizationId) {
    console.error(`this should never happen (api: ${apiKey} org: ${organizationId})`);

    // we just return this since something broken..
    return failResponse;
  }

  let info = accountInfoCache.get(organizationId);
  if (!info) {
    console.error(`wtf ${organizationId}`);
    return failResponse;
  }

  // resync since cache is stale
  if (info.ts < +Date.now() - env.CACHE_STALE_TIME) {
    const _existing = accountInfoCache.get(organizationId);

    try {
      const synced = await syncWithDatabase(spend);
      info = {
        ...synced!,
        lastAddedCredits: +new Date(),
      };
    } catch {
      // failed db sync..
      console.error(`failed db sync ${organizationId}`);
      return failResponse;
    }
  }

  // update cache
  accountInfoCache.set(organizationId, {
    ...info,
    // apply spend
    credits: info.credits - spend,
  });

  // console.log("made it to end");

  return {
    plan: info.plan,
    credits: info.credits - spend,
    ts: info.ts,
  };
}

const authorizationCheck = (spend: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let apiKey = "";
    if (!authHeader) {
      apiKey = "default";
    } else if (authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.split("Bearer ")[1];
    } else {
      res.status(401).send("Invalid authorization header");
      return;
    }

    if (!req.ip) {
      res.status(401).send("Invalid IP address");
      return;
    }

    spendCredits(req.ip, apiKey, spend).then((info) => {
      console.log("account info", info);
      res.locals.accountInfo = info;
      res.header("X-Credits-Remaining", info.credits.toString());
      res.header("X-Plan", info.plan);
      authMetrics.labels(info.plan, req.path).inc();
      next();
    });

    // // Simulate credit usage (replace with actual logic)
    // const creditsUsed = Math.floor(Math.random() * 10) + 1;
    // creditUsageMetrics.labels(routeName, tier).inc(creditsUsed);
  };
};

export default authorizationCheck;

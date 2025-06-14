import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { getChainName } from './config/chains'

// Initialize Express app
const app = express()
app.use(cors())
app.use(express.json())

// GraphQL endpoint from your Subsquid indexer
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'http://localhost:4350/graphql'

// Types
interface GraphQLResponse<T = any> {
  data?: T
  errors?: Array<{ message: string }>
}

interface PersonaQuery {
  sort?: string
  limit?: string
  offset?: string
  search?: string
  graduated?: string
  creator?: string
  chainId?: string
}

interface Persona {
  id: string
  tokenId: string
  name: string
  symbol: string
  creator: string
  erc20Token: string
  pairToken: string
  pairCreated: boolean
  pairAddress?: string
  totalVolume24h: string
  totalVolumeAllTime: string
  totalTrades24h: number
  totalTradesAllTime: number
  uniqueTraders24h: number
  uniqueTradersAllTime: number
  isGraduated: boolean
  createdAt: string
  chain: {
    id: string
    name: string
  }
  metadata?: Array<{
    key: string
    value: string
  }>
}

// Helper to query GraphQL
async function queryGraphQL<T = any>(query: string, variables: any = {}): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  
  const result = await response.json() as GraphQLResponse<T>
  
  if (result.errors) {
    throw new Error(result.errors[0].message)
  }
  
  if (!result.data) {
    throw new Error('No data returned from GraphQL')
  }
  
  return result.data
}

// Error handler middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err)
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  })
}

// Sorting options
enum SortBy {
  VOLUME_24H = 'totalVolume24h_DESC',
  VOLUME_ALL_TIME = 'totalVolumeAllTime_DESC',
  TRADES_24H = 'totalTrades24h_DESC',
  TRADERS_24H = 'uniqueTraders24h_DESC',
  CREATED_AT = 'createdAt_DESC',
  NAME = 'name_ASC'
}

// API Routes

// Get all supported chains
app.get('/api/chains', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      query GetChains {
        chains {
          id
          name
          amicaToken
          factoryAddress
          bridgeWrapperAddress
          totalPersonas
          totalVolume
        }
      }
    `
    
    const data = await queryGraphQL<{ chains: any[] }>(query)
    res.json(data.chains)
  } catch (error) {
    next(error)
  }
})

// Get personas across all chains or specific chain
app.get('/api/personas', async (req: Request<{}, {}, {}, PersonaQuery>, res: Response, next: NextFunction) => {
  try {
    const {
      sort = SortBy.VOLUME_24H,
      limit = '20',
      offset = '0',
      search = '',
      graduated = null,
      creator = null,
      chainId = null
    } = req.query
    
    // Build where clause
    const whereConditions: string[] = []
    if (search) {
      whereConditions.push(`name_containsInsensitive: "${search}"`)
    }
    if (graduated !== null) {
      whereConditions.push(`isGraduated_eq: ${graduated}`)
    }
    if (creator) {
      whereConditions.push(`creator_eq: "${creator.toLowerCase()}"`)
    }
    if (chainId) {
      whereConditions.push(`chain: { id_eq: "${chainId}" }`)
    }
    
    const whereClause = whereConditions.length > 0 
      ? `where: { ${whereConditions.join(', ')} }`
      : ''
    
    const query = `
      query GetPersonas {
        personas(
          orderBy: ${sort}
          limit: ${limit}
          offset: ${offset}
          ${whereClause}
        ) {
          id
          tokenId
          name
          symbol
          creator
          erc20Token
          pairToken
          pairCreated
          pairAddress
          totalVolume24h
          totalVolumeAllTime
          totalTrades24h
          totalTradesAllTime
          uniqueTraders24h
          uniqueTradersAllTime
          isGraduated
          createdAt
          chain {
            id
            name
          }
          metadata {
            key
            value
          }
        }
        
        personasConnection(${whereClause}) {
          totalCount
        }
      }
    `
    
    const data = await queryGraphQL<{
      personas: Persona[]
      personasConnection: { totalCount: number }
    }>(query)
    
    res.json({
      personas: data.personas,
      total: data.personasConnection.totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    next(error)
  }
})

// Get single persona details
app.get('/api/personas/:chainId/:tokenId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chainId, tokenId } = req.params
    const id = `${chainId}-${tokenId}`
    
    const query = `
      query GetPersona($id: String!) {
        persona(id: $id) {
          id
          tokenId
          name
          symbol
          creator
          erc20Token
          pairToken
          pairCreated
          pairAddress
          totalVolume24h
          totalVolumeAllTime
          totalTrades24h
          totalTradesAllTime
          uniqueTraders24h
          uniqueTradersAllTime
          totalDeposited
          tokensSold
          graduationThreshold
          isGraduated
          createdAt
          chain {
            id
            name
          }
          metadata {
            key
            value
          }
        }
      }
    `
    
    const data = await queryGraphQL<{ persona: Persona | null }>(query, { id })
    
    if (!data.persona) {
      return res.status(404).json({ error: 'Persona not found' })
    }
    
    res.json(data.persona)
  } catch (error) {
    next(error)
  }
})

// Get persona trading history
app.get('/api/personas/:chainId/:tokenId/trades', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chainId, tokenId } = req.params
    const { limit = '50', offset = '0' } = req.query
    const id = `${chainId}-${tokenId}`
    
    const query = `
      query GetTrades($id: String!, $limit: Int!, $offset: Int!) {
        trades(
          where: { persona: { id_eq: $id } }
          orderBy: timestamp_DESC
          limit: $limit
          offset: $offset
        ) {
          id
          trader
          amountIn
          amountOut
          feeAmount
          timestamp
          block
          txHash
        }
        
        tradesConnection(where: { persona: { id_eq: $id } }) {
          totalCount
        }
      }
    `
    
    const data = await queryGraphQL<{
      trades: any[]
      tradesConnection: { totalCount: number }
    }>(query, {
      id,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    })
    
    res.json({
      trades: data.trades,
      total: data.tradesConnection.totalCount
    })
  } catch (error) {
    next(error)
  }
})

// Get volume chart data
app.get('/api/personas/:chainId/:tokenId/volume-chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chainId, tokenId } = req.params
    const { days = '30' } = req.query
    const id = `${chainId}-${tokenId}`
    
    const query = `
      query GetVolumeChart($id: String!, $days: Int!) {
        dailyVolumes(
          where: { persona: { id_eq: $id } }
          orderBy: date_DESC
          limit: $days
        ) {
          date
          volume
          trades
          uniqueTraders
        }
      }
    `
    
    const data = await queryGraphQL<{
      dailyVolumes: Array<{
        date: string
        volume: string
        trades: number
        uniqueTraders: number
      }>
    }>(query, {
      id,
      days: parseInt(days as string)
    })
    
    // Fill in missing days with zero values
    const chartData: any[] = []
    const volumeMap = new Map(
      data.dailyVolumes.map((dv) => [dv.date.split('T')[0], dv])
    )
    
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    
    for (let i = 0; i < parseInt(days as string); i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const volume = volumeMap.get(dateStr) || {
        date: dateStr,
        volume: '0',
        trades: 0,
        uniqueTraders: 0
      }
      
      chartData.unshift(volume)
    }
    
    res.json(chartData)
  } catch (error) {
    next(error)
  }
})

// Get global statistics
app.get('/api/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      query GetGlobalStats {
        globalStats(id: "global") {
          totalPersonas
          totalVolume24h
          totalVolumeAllTime
          totalBridgedVolume
          totalChains
          lastUpdated
        }
        
        chains {
          id
          name
          totalPersonas
          totalVolume
        }
        
        recentPersonas: personas(
          orderBy: createdAt_DESC
          limit: 10
        ) {
          id
          name
          symbol
          createdAt
          chain {
            name
          }
        }
        
        topVolume24h: personas(
          orderBy: totalVolume24h_DESC
          limit: 5
        ) {
          id
          name
          totalVolume24h
          chain {
            name
          }
        }
      }
    `
    
    const data = await queryGraphQL(query)
    
    res.json({
      global: data.globalStats,
      chainBreakdown: data.chains,
      recentPersonas: data.recentPersonas,
      topVolume24h: data.topVolume24h
    })
  } catch (error) {
    next(error)
  }
})

// Get bridge activity
app.get('/api/bridge/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user = null, limit = '50', offset = '0' } = req.query
    
    const whereClause = user 
      ? `where: { user_eq: "${(user as string).toLowerCase()}" }`
      : ''
    
    const query = `
      query GetBridgeActivity {
        bridgeActivities(
          ${whereClause}
          orderBy: timestamp_DESC
          limit: ${limit}
          offset: ${offset}
        ) {
          id
          user
          action
          amount
          timestamp
          txHash
          chain {
            id
            name
          }
        }
        
        bridgeActivitiesConnection(${whereClause}) {
          totalCount
        }
      }
    `
    
    const data = await queryGraphQL(query)
    
    res.json({
      activities: data.bridgeActivities,
      total: data.bridgeActivitiesConnection.totalCount
    })
  } catch (error) {
    next(error)
  }
})

// Get AMICA token deposits
app.get('/api/amica/deposits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token = null, limit = '50', offset = '0' } = req.query
    
    const whereClause = token 
      ? `where: { token_eq: "${(token as string).toLowerCase()}" }`
      : ''
    
    const query = `
      query GetAmicaDeposits {
        amicaTokenDeposits(
          ${whereClause}
          orderBy: timestamp_DESC
          limit: ${limit}
          offset: ${offset}
        ) {
          id
          depositor
          token
          amount
          timestamp
          txHash
          chain {
            id
            name
          }
        }
        
        amicaTokenDepositsConnection(${whereClause}) {
          totalCount
        }
      }
    `
    
    const data = await queryGraphQL(query)
    
    res.json({
      deposits: data.amicaTokenDeposits,
      total: data.amicaTokenDepositsConnection.totalCount
    })
  } catch (error) {
    next(error)
  }
})

// Get cross-chain leaderboard
app.get('/api/leaderboard/global', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period = '24h', metric = 'volume' } = req.query
    
    let orderBy: string
    if (period === '24h') {
      orderBy = metric === 'volume' ? 'totalVolume24h_DESC' : 'totalTrades24h_DESC'
    } else {
      orderBy = metric === 'volume' ? 'totalVolumeAllTime_DESC' : 'totalTradesAllTime_DESC'
    }
    
    const query = `
      query GetGlobalLeaderboard {
        personas(
          orderBy: ${orderBy}
          limit: 100
          where: { ${period === '24h' ? 'totalVolume24h_gt: "0"' : 'totalVolumeAllTime_gt: "0"'} }
        ) {
          id
          name
          symbol
          creator
          totalVolume24h
          totalVolumeAllTime
          totalTrades24h
          totalTradesAllTime
          uniqueTraders24h
          uniqueTradersAllTime
          isGraduated
          chain {
            id
            name
          }
        }
      }
    `
    
    const data = await queryGraphQL<{ personas: Persona[] }>(query)
    
    res.json(data.personas)
  } catch (error) {
    next(error)
  }
})

// Get trending personas (based on volume growth)
app.get('/api/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get personas with highest 24h volume relative to their all-time average
    const query = `
      query GetTrending {
        personas(
          where: { 
            totalVolume24h_gt: "0"
            totalTradesAllTime_gt: 10
          }
          orderBy: totalVolume24h_DESC
          limit: 20
        ) {
          id
          name
          symbol
          creator
          totalVolume24h
          totalVolumeAllTime
          totalTrades24h
          totalTradesAllTime
          uniqueTraders24h
          createdAt
          isGraduated
          chain {
            id
            name
          }
        }
      }
    `
    
    const data = await queryGraphQL<{ personas: Persona[] }>(query)
    
    // Calculate growth scores
    const trending = data.personas.map((persona) => {
      const daysActive = Math.max(1, 
        Math.floor((Date.now() - new Date(persona.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      )
      const avgDailyVolume = BigInt(persona.totalVolumeAllTime) / BigInt(daysActive)
      const currentDailyVolume = BigInt(persona.totalVolume24h)
      
      // Growth multiplier (how many times the average is current volume)
      const growthMultiplier = avgDailyVolume > 0n
        ? Number(currentDailyVolume * 100n / avgDailyVolume) / 100
        : 0
      
      return {
        ...persona,
        growthMultiplier,
        daysActive
      }
    })
    
    // Sort by growth multiplier
    trending.sort((a, b) => b.growthMultiplier - a.growthMultiplier)
    
    res.json(trending)
  } catch (error) {
    next(error)
  }
})

// Search personas across all chains
app.get('/api/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q = '', chainId = null } = req.query
    
    if (!q || (q as string).length < 2) {
      return res.json([])
    }
    
    const chainFilter = chainId ? `chain: { id_eq: "${chainId}" }` : ''
    
    const query = `
      query SearchPersonas($search: String!) {
        byName: personas(
          where: { 
            name_containsInsensitive: $search
            ${chainFilter}
          }
          orderBy: totalVolume24h_DESC
          limit: 10
        ) {
          id
          name
          symbol
          totalVolume24h
          isGraduated
          chain {
            id
            name
          }
        }
        
        bySymbol: personas(
          where: { 
            symbol_containsInsensitive: $search
            ${chainFilter}
          }
          orderBy: totalVolume24h_DESC
          limit: 10
        ) {
          id
          name
          symbol
          totalVolume24h
          isGraduated
          chain {
            id
            name
          }
        }
      }
    `
    
    const data = await queryGraphQL<{
      byName: Persona[]
      bySymbol: Persona[]
    }>(query, { search: q })
    
    // Combine and deduplicate results
    const combined = [...data.byName, ...data.bySymbol]
    const unique = Array.from(
      new Map(combined.map(p => [p.id, p])).values()
    )
    
    res.json(unique.slice(0, 20))
  } catch (error) {
    next(error)
  }
})

// Get user portfolio across chains
app.get('/api/users/:address/portfolio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params
    const userAddress = address.toLowerCase()
    
    const query = `
      query GetUserPortfolio($user: String!) {
        # Get personas created by user
        createdPersonas: personas(
          where: { creator_eq: $user }
          orderBy: createdAt_DESC
        ) {
          id
          name
          symbol
          totalVolumeAllTime
          isGraduated
          chain {
            id
            name
          }
        }
        
        # Get user's trades
        trades: trades(
          where: { trader_eq: $user }
          orderBy: timestamp_DESC
          limit: 100
        ) {
          persona {
            id
            name
            symbol
          }
          amountIn
          amountOut
          timestamp
          chain {
            id
            name
          }
        }
        
        # Get bridge activities
        bridgeActivities: bridgeActivities(
          where: { user_eq: $user }
          orderBy: timestamp_DESC
        ) {
          action
          amount
          timestamp
          chain {
            id
            name
          }
        }
      }
    `
    
    const data = await queryGraphQL(query, { user: userAddress })
    
    // Calculate portfolio stats
    const tradedPersonas = new Set(data.trades.map((t: any) => t.persona.id))
    const totalVolume = data.trades.reduce((sum: bigint, t: any) => sum + BigInt(t.amountIn), 0n)
    const totalBridged = data.bridgeActivities
      .filter((a: any) => a.action === 'WRAP')
      .reduce((sum: bigint, a: any) => sum + BigInt(a.amount), 0n)
    
    res.json({
      createdPersonas: data.createdPersonas,
      tradedPersonasCount: tradedPersonas.size,
      totalTradeVolume: totalVolume.toString(),
      totalBridgedVolume: totalBridged.toString(),
      recentTrades: data.trades.slice(0, 10),
      bridgeActivities: data.bridgeActivities
    })
  } catch (error) {
    next(error)
  }
})

// Health check with chain status
app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = `
      query HealthCheck {
        chains {
          id
          name
          totalPersonas
        }
        
        _meta {
          block {
            number
            timestamp
          }
        }
      }
    `
    
    const data = await queryGraphQL(query)
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      chains: data.chains,
      indexerBlock: data._meta?.block
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Apply error handler
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Multichain API server running on port ${PORT}`)
  console.log(`GraphQL endpoint: ${GRAPHQL_ENDPOINT}`)
})

// Export for testing
export default app

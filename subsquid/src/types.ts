import { Store as TypeormStore } from '@subsquid/typeorm-store'

export type Store = TypeormStore
export type Context = {
  store: Store
  log: {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }
  _chain: {
    client: {
      call: (method: string, params: any[]) => Promise<any>
    }
  }
  blocks: any[]
}

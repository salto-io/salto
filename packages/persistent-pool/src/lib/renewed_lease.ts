import { types } from '@salto/lowerdash'
import { Pool, LeaseUpdateOpts, Lease, InstanceId } from '../types'

const poolFuncs: (keyof Pool)[] = ['lease', 'return']
const isPool = (
  o: Pool | (() => Promise<Pool>)
): o is Pool => poolFuncs.every((f: keyof Pool) => typeof (o as Pool)[f] === 'function')

export type RenewedLeaseOpts<T> = {
  poolOrFactory: Pool | (() => Promise<Pool>)
  lease: Lease<T>
  timeout: number
  renewMargin: number
}

export default class RenewedLease<T> extends types.Bean<RenewedLeaseOpts<T>>
  implements Lease<T> {
  timeoutId: NodeJS.Timeout | undefined

  constructor(opts: RenewedLeaseOpts<T>) {
    super(opts)
    this.timeoutId = this.renewTimeout()
  }

  private pool(): Promise<Pool> {
    return isPool(this.poolOrFactory)
      ? Promise.resolve(this.poolOrFactory)
      : this.poolOrFactory()
  }

  get value(): T {
    return this.lease.value
  }

  get id(): InstanceId {
    return this.lease.id
  }

  private renewTimeout(): NodeJS.Timeout {
    return setTimeout(this.renew.bind(this), this.timeout - this.renewMargin)
  }

  private async renew(): Promise<void> {
    const pool = await this.pool()
    await pool.updateTimeout(this.lease.id, this.timeout)
    this.timeoutId = this.renewTimeout()
  }

  async return(opts?: LeaseUpdateOpts): Promise<void> {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined
    }

    const pool = await this.pool()
    return pool.return(this.lease.id, opts)
  }
}

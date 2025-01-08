/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { types } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { Pool, LeaseUpdateOpts, Lease, InstanceId, InstanceNotLeasedError } from '../types'

const log = logger(module)

const poolFuncs: (keyof Pool)[] = ['lease', 'return']
const isPool = (o: Pool | (() => Promise<Pool>)): o is Pool =>
  poolFuncs.every((f: keyof Pool) => typeof (o as Pool)[f] === 'function')

export type RenewedLeaseOpts<T> = {
  poolOrFactory: Pool | (() => Promise<Pool>)
  lease: Lease<T>
  timeout: number
  renewMargin: number
}

export default class RenewedLease<T> extends types.Bean<RenewedLeaseOpts<T>> implements Lease<T> {
  timeoutId: NodeJS.Timeout | undefined

  constructor(opts: RenewedLeaseOpts<T>) {
    super(opts)
    this.timeoutId = this.renewTimeout()
  }

  private pool(): Promise<Pool> {
    return isPool(this.poolOrFactory) ? Promise.resolve(this.poolOrFactory) : this.poolOrFactory()
  }

  get value(): T {
    return this.lease.value
  }

  get id(): InstanceId {
    return this.lease.id
  }

  private renewTimeout(): NodeJS.Timeout {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return setTimeout(this.renew.bind(this), this.timeout - this.renewMargin)
  }

  private async renew(): Promise<void> {
    const pool = await this.pool()
    try {
      await pool.updateTimeout(this.lease.id, this.timeout)
      this.timeoutId = this.renewTimeout()
    } catch (e) {
      if (!(e instanceof InstanceNotLeasedError)) {
        throw e
      }
      log.warn('lease returned by unknown entity, stops renew interval')
    }
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

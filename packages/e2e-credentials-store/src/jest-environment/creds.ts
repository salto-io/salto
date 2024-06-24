/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { hostname } from 'os'
import { retry } from '@salto-io/lowerdash'
import { Logger } from '@salto-io/logging'
import { Pool, dynamoDbRepo, RenewedLease, Lease } from '@salto-io/persistent-pool'
import humanizeDuration from 'humanize-duration'
import REPO_PARAMS from '../repo_params'
import createEnvUtils from '../process_env'
import { SuspendCredentialsError } from '../types'
import IntervalScheduler from './interval_scheduler'

const { retryStrategies } = retry

export type CredsSpec<TCreds extends {}> = {
  envHasCreds(env: NodeJS.ProcessEnv): boolean
  fromEnv(env: NodeJS.ProcessEnv): TCreds
  validate(creds: TCreds): Promise<void>
  typeName: string
  globalProp: string
}

export type CredsLease<TCreds extends {}> = Lease<TCreds> & {
  return?: () => Promise<void>
}

const CREDS_INTERVAL_ID = 'waiting for creds'

const LEASE_TIMEOUT = 1000 * 60 * 5
const LEASE_UPDATE_MARGIN = 1000 * 60

const LEASE_PARAMS: Parameters<Pool['waitForLease']> = [
  LEASE_TIMEOUT,
  retryStrategies.intervals({ maxRetries: 40, interval: 1000 * 15 }),
]

const creds = <TCreds extends {}>(
  spec: CredsSpec<TCreds>,
  env: NodeJS.ProcessEnv,
  logger: Logger,
  runningTasksPrinter: IntervalScheduler,
): Promise<CredsLease<TCreds>> => {
  const clientId = [env.JEST_WORKER_ID, env.CIRCLE_BUILD_URL ?? hostname()].filter(x => x).join(';')

  const pool = async (): Promise<Pool<TCreds>> => {
    const repo = await dynamoDbRepo({ ...REPO_PARAMS, clientId })
    return repo.pool<TCreds>(spec.typeName)
  }

  const fromPool = async (): Promise<CredsLease<TCreds>> => {
    const p = await pool()

    const tryLease = async (): Promise<Lease<TCreds>> => {
      const lease = await p.waitForLease(...LEASE_PARAMS)
      try {
        await spec.validate(lease.value)
        logger.info('env %s using %s account %s', env.JEST_WORKER_ID, spec.typeName, lease.id)
        return lease
      } catch (e) {
        if (e instanceof SuspendCredentialsError) {
          logger.error(e)
          await p.suspend(lease.id, e.reason.message, e.timeout)
          return tryLease()
        }
        throw e
      }
    }
    try {
      runningTasksPrinter.schedule(CREDS_INTERVAL_ID)
      const lease = new RenewedLease<TCreds>({
        poolOrFactory: pool,
        lease: await tryLease(),
        timeout: LEASE_TIMEOUT,
        renewMargin: LEASE_UPDATE_MARGIN,
      })
      return lease
    } finally {
      runningTasksPrinter.unschedule(CREDS_INTERVAL_ID)
    }
  }
  const fromEnv = async (): Promise<CredsLease<TCreds>> => {
    const lease = {
      id: 'from environment variables',
      value: spec.fromEnv(env),
    }
    await spec.validate(lease.value)
    return lease
  }

  const envUtils = createEnvUtils(env)
  return envUtils.bool('USE_CRED_POOL') || !spec.envHasCreds(env) ? fromPool() : Promise.resolve(fromEnv())
}

export default <TCreds extends {}>(
  credsSpec: CredsSpec<TCreds>,
  logger: Logger,
  credsLeaseUpdateInterval = 30000,
): Promise<CredsLease<TCreds>> =>
  creds(
    credsSpec,
    process.env,
    logger,
    new IntervalScheduler((id, startTime) => {
      const duration = humanizeDuration(Date.now() - startTime.getTime(), { round: true })
      logger.warn('Still leasing credentials (%s): %s', duration, id)
    }, credsLeaseUpdateInterval),
  )

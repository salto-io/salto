import { hostname } from 'os'
import { retry } from '@salto/lowerdash'
import {
  Pool, dynamoDbRepo, RenewedLease, Lease,
} from '@salto/persistent-pool'
import REPO_PARAMS from '../repo_params'
import createEnvUtils from './process_env'

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

const LEASE_TIMEOUT = 1000 * 60 * 5
const LEASE_UPDATE_MARGIN = 1000 * 60

const LEASE_PARAMS: Parameters<Pool['waitForLease']> = [
  LEASE_TIMEOUT,
  retryStrategies.intervals({ maxRetries: 40, interval: 1000 * 15 }),
]

export default <TCreds extends {}>(
  spec: CredsSpec<TCreds>,
  env: NodeJS.ProcessEnv = process.env
): Promise<CredsLease<TCreds>> => {
  const clientId = [
    env.JEST_WORKER_ID,
    env.CIRCLE_BUILD_URL ?? hostname(),
  ].filter(x => x).join(';')

  const pool = async (): Promise<Pool<TCreds>> => {
    const repo = await dynamoDbRepo({ ...REPO_PARAMS, clientId })
    return repo.pool<TCreds>(spec.typeName)
  }

  const fromPool = async (): Promise<CredsLease<TCreds>> => {
    const p = await pool()
    const lease = await p.waitForLease(...LEASE_PARAMS)

    return new RenewedLease<TCreds>({
      poolOrFactory: pool,
      lease,
      timeout: LEASE_TIMEOUT,
      renewMargin: LEASE_UPDATE_MARGIN,
    })
  }

  const fromEnv = (): CredsLease<TCreds> => ({
    id: 'from environment variables',
    value: spec.fromEnv(env),
  })

  const envUtils = createEnvUtils(env)

  return envUtils.bool('USE_CRED_POOL') || !spec.envHasCreds(env)
    ? fromPool()
    : Promise.resolve(fromEnv())
}

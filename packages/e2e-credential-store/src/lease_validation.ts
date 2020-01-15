import { InstanceId, Pool } from '@salto/persistent-pool'
import { SuspendCredentialsError } from './types'

export const validateAndSuspend = async <TCreds extends {}>(
  pool: Pool,
  id: InstanceId,
  creds: TCreds,
  validate: (creds: TCreds) => Promise<void>
): Promise<void> => {
  try {
    await validate(creds)
  } catch (e) {
    if (e instanceof SuspendCredentialsError) {
      await pool.suspend(id, e.reason.message, e.timeout)
    }
    throw e
  }
}

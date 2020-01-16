import { Global } from '@jest/types'
import NodeEnvironment from 'jest-environment-node'
import { JestEnvironment } from '@jest/environment'
import { Event } from 'jest-circus'
import humanizeDuration from 'humanize-duration'
import { logger, Logger } from '@salto/logging'
import creds, { CredsSpec, CredsLease } from './creds'
import IntervalScheduler from './interval_scheduler'
import { extractStatus } from './circus_events'

const STILL_RUNNING_WARN_INTERVAL = 1000 * 30
const CREDS_INTERVAL_ID = 'waiting for creds'

export type CredsNodeEnvironmentOpts<TCreds> = {
  logBaseName: string
  credsSpec: CredsSpec<TCreds>
}

export default <TCreds>({
  logBaseName,
  credsSpec,
}: CredsNodeEnvironmentOpts<TCreds>
): typeof JestEnvironment => class extends NodeEnvironment {
  protected readonly log: Logger
  protected readonly runningTasksPrinter: IntervalScheduler
  credsLease: CredsLease<TCreds> | undefined

  constructor(
    ...args: ConstructorParameters<typeof NodeEnvironment>
  ) {
    super(...args)
    this.log = logger([logBaseName, process.env.JEST_WORKER_ID].filter(x => x).join('/'))
    this.runningTasksPrinter = new IntervalScheduler(
      (id, startTime) => {
        const duration = humanizeDuration(Date.now() - startTime.getTime(), { round: true })
        this.log.warn('Still running (%s): %s', duration, id)
      },
      STILL_RUNNING_WARN_INTERVAL,
    )
  }

  async setup(): Promise<void> {
    await super.setup()

    this.runningTasksPrinter.schedule(CREDS_INTERVAL_ID)
    this.credsLease = await creds(credsSpec, process.env, this.log)
      .finally(() => this.runningTasksPrinter.unschedule(CREDS_INTERVAL_ID))
    this.global[credsSpec.globalProp as keyof Global.Global] = this.credsLease.value
    this.log.warn(`setup, using creds: ${this.credsLease.id}`)
  }

  async teardown(): Promise<void> {
    delete this.global[credsSpec.globalProp as keyof Global.Global]
    if (this.credsLease !== undefined) {
      await this.credsLease.return?.()
      this.log.warn(`teardown, returned creds ${this.credsLease?.id}`)
      this.credsLease = undefined
    }

    this.runningTasksPrinter.clear()

    await super.teardown()
  }

  handleTestEvent(event: Event): void {
    const { id, type, status } = extractStatus(event) ?? {}

    if (!id) return

    this.log.log(status === 'failure' ? 'error' : 'info', '%s %s: %s', type, status, id)

    if (status === 'start') {
      this.runningTasksPrinter.schedule(id)
    } else {
      this.runningTasksPrinter.unschedule(id)
    }
  }
}

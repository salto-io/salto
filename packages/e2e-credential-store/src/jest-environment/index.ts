/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Global } from '@jest/types'
import NodeEnvironment from 'jest-environment-node'
import { Event } from 'jest-circus'
import humanizeDuration from 'humanize-duration'
import { logger, Logger } from '@salto-io/logging'
import creds, { CredsSpec, CredsLease } from './creds'
import IntervalScheduler from './interval_scheduler'
import { extractStatus } from './circus_events'

const STILL_RUNNING_WARN_INTERVAL = 1000 * 30
const CREDS_INTERVAL_ID = 'waiting for creds'

export type CredsNodeEnvironmentOpts<TCreds> = {
  logBaseName: string
  credsSpec: CredsSpec<TCreds>
}

export type JestEnvironmentConstructorArgs = ConstructorParameters<typeof NodeEnvironment>

export class CredsJestEnvironment<TCreds> extends NodeEnvironment {
  protected readonly log: Logger
  protected readonly runningTasksPrinter: IntervalScheduler
  protected readonly credsSpec: CredsSpec<TCreds>
  credsLease: CredsLease<TCreds> | undefined

  constructor(
    { logBaseName, credsSpec }: CredsNodeEnvironmentOpts<TCreds>,
    ...args: JestEnvironmentConstructorArgs
  ) {
    super(...args)
    this.credsSpec = credsSpec
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
    try {
      this.credsLease = await creds(this.credsSpec, process.env, this.log)
    } finally {
      this.runningTasksPrinter.unschedule(CREDS_INTERVAL_ID)
    }

    this.global[this.credsSpec.globalProp as keyof Global.Global] = this.credsLease.value
    this.log.warn(`setup, using creds: ${this.credsLease.id}`)
  }

  async teardown(): Promise<void> {
    delete this.global[this.credsSpec.globalProp as keyof Global.Global]
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

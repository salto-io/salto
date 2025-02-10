/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import NodeEnvironment from 'jest-environment-node'
import { Event } from 'jest-circus'
import humanizeDuration from 'humanize-duration'
import { logger, Logger } from '@salto-io/logging'
import IntervalScheduler from './interval_scheduler'
import { extractStatus } from './circus_events'

const STILL_RUNNING_WARN_INTERVAL = 1000 * 30

type CredsNodeEnvironmentOpts = {
  logBaseName: string
}

export type JestEnvironmentConstructorArgs = ConstructorParameters<typeof NodeEnvironment>

class SaltoE2EJestEnvironment extends NodeEnvironment {
  protected readonly log: Logger

  protected readonly runningTasksPrinter: IntervalScheduler

  constructor({ logBaseName }: CredsNodeEnvironmentOpts, ...args: JestEnvironmentConstructorArgs) {
    super(...args)
    this.log = logger([logBaseName, process.env.JEST_WORKER_ID].filter(x => x).join('/'))
    this.runningTasksPrinter = new IntervalScheduler((id, startTime) => {
      const duration = humanizeDuration(Date.now() - startTime.getTime(), { round: true })
      this.log.warn('Still running (%s): %s', duration, id)
    }, STILL_RUNNING_WARN_INTERVAL)
  }

  handleTestEvent(event: Event): void {
    if (event.name === 'teardown') {
      if (this.runningTasksPrinter.size() > 0) {
        this.log.warn(
          'Teardown event received, clearing running tasks. Had %d running tasks',
          this.runningTasksPrinter.size(),
        )
        this.runningTasksPrinter.clear()
      }
      return
    }
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

export default SaltoE2EJestEnvironment

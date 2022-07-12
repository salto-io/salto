/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'

const memoryUsageLogger = (): { log: () => void } => {
  let firstCall = true
  let mem = process.memoryUsage().heapUsed
  const logging = (): void => {
    const log = logger('memory')
    const currentMem = process.memoryUsage().heapUsed
    const e = new Error()
    const logLine = e.stack?.split('\n')[2].trim()
    if (firstCall) {
      log.info(`${logLine} starting memory test`)
      mem = currentMem
      firstCall = false
      return
    }
    const memChange = (currentMem - mem) / 1024 / 1024
    const totalMem = currentMem / 1024 / 1024
    if (Math.abs(memChange) > 10) {
      log.info(`${logLine} memory change: ${memChange.toFixed(3)}M (total: ${totalMem.toFixed(3)}M)`)
      mem = currentMem
    }
  }
  return { log: logging }
}

export const memoryUsage = memoryUsageLogger()

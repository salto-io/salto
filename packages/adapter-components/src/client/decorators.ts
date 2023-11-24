/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators } from '@salto-io/lowerdash'

const log = logger(module)

export const requiresLogin = (): decorators.InstanceMethodDecorator => (
  decorators.wrapMethodWith(
    async function withLogin(
      this: { ensureLoggedIn(): Promise<void> },
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return originalMethod.call()
    }
  )
)

export const logOperationDecorator = (
  { name, args }: decorators.OriginalCall,
  clientName: string,
  keys?: string[],
  additionalKeysFunc?: (args: unknown[]) => string,
): string => {
  const printableArgs = args
    .map(arg => {
      const keysValues = (keys ?? [])
        .map(key => _.get(arg, key))
        .filter(_.isString)
      return _.isEmpty(keysValues) ? arg : keysValues.join(', ')
    })
    .concat(additionalKeysFunc ? additionalKeysFunc(args) : [])
    .filter(_.isString)
    .join(', ')
  return `${clientName}:client.${name}(${printableArgs})`
}

export const logDecorator = (
  keys?: string[],
  additionalKeysFunc?: (args: unknown[]) => string,
): decorators.InstanceMethodDecorator => (
  decorators.wrapMethodWith(
    async function logFailure(
      this: { clientName: string },
      originalMethod: decorators.OriginalCall,
    ): Promise<unknown> {
      const desc = logOperationDecorator(originalMethod, this.clientName, keys, additionalKeysFunc)
      try {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await log.time(originalMethod.call, desc)
      } catch (e) {
        log.warn('failed to run %s client call %s: %s', this.clientName, desc, (e as Error).message)
        throw e
      }
    }
  )
)

/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators } from '@salto-io/lowerdash'

const log = logger(module)

export const requiresLogin = (): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async function withLogin(
    this: { ensureLoggedIn(): Promise<void> },
    originalMethod: decorators.OriginalCall,
  ): Promise<unknown> {
    await this.ensureLoggedIn()
    return originalMethod.call()
  })

export const logOperationDecorator = (
  { name, args }: decorators.OriginalCall,
  clientName: string,
  keys?: string[],
  additionalKeysFunc?: (args: unknown[]) => string,
): string => {
  const printableArgs = args
    .map(arg => {
      const keysValues = (keys ?? []).map(key => _.get(arg, key)).filter(_.isString)
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
): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async function logFailure(
    this: { clientName: string },
    originalMethod: decorators.OriginalCall,
  ): Promise<unknown> {
    const desc = logOperationDecorator(originalMethod, this.clientName, keys, additionalKeysFunc)
    try {
      return await log.timeDebug(originalMethod.call, desc)
    } catch (e) {
      log.warn('failed to run %s client call %s: %s', this.clientName, desc, e.message)
      throw e
    }
  })

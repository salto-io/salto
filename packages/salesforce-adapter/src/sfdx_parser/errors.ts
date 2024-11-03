/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { SfError } from './salesforce_imports'

const log = logger(module)

export const detailedMessageFromSfError = (error: unknown): string => {
  if (error instanceof SfError) {
    log.warn('Got an SfError: %s', inspectValue(error.toObject()))
    const actionsBullets = error.actions?.map(action => `* ${action}`).join('\n')
    const actionsBlock = actionsBullets ? `\nSuggested actions:\n${actionsBullets}` : ''
    return `${error.name}: ${error.message}${actionsBlock}`
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return `Internal error in Salesforce library: ${error}`
}

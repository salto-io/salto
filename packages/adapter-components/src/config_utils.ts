/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { logger } from '@salto-io/logging'

const log = logger(module)

/**
 * Filters a record to contain only the entries not explicitly disabled in the config.
 */
export const getEnabledEntries = <T>(
  possibleEntries: Record<string, T>,
  config: Record<string, boolean>,
): Record<string, T> => {
  const disabledEntriesNames = new Set<string>(
    Object.entries(config)
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name),
  )
  if (disabledEntriesNames.size > 0) {
    log.info(`The following entries are disabled: ${Array.from(disabledEntriesNames.keys()).join(', ')}`)
  }

  return _.pickBy(possibleEntries, (_entry, name) => !disabledEntriesNames.has(name))
}

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { toBasicInstance, InstanceCreationParams } from '../instance_elements'

/**
 * Generate an instance for a single entry returned for a given type.
 *
 * - Special case: If hasDynamicFields is specified, then the entry is
 *    nested under a 'value' field in order to allow the type to define
 *    this as a map type.
 */
export const toInstance = async (
  args: InstanceCreationParams & {
    hasDynamicFields?: boolean
  },
): Promise<InstanceElement | undefined> => {
  const inst = await toBasicInstance({
    ...args,
    entry: args.hasDynamicFields ? { value: args.entry } : args.entry,
  })
  if (_.isEmpty(inst.value)) {
    return undefined
  }
  return inst
}

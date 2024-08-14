/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

const log = logger(module)

export const createOptionsTypeGuard =
  <T>(optionsElemID: ElemID): ((instance: InstanceElement) => instance is InstanceElement & { value: T }) =>
  (instance): instance is InstanceElement & { value: T } => {
    if (instance.refType.elemID.isEqual(optionsElemID)) {
      return true
    }
    log.error(
      `Received an invalid instance for config options. Received instance with refType ElemId full name: ${instance.refType.elemID.getFullName()}`,
    )
    return false
  }

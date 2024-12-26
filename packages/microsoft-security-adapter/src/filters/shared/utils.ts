/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, InstanceElement, isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'

export const cloneInstanceChange = (change: Change<InstanceElement>): Change<InstanceElement> => {
  if (isAdditionChange(change)) {
    return {
      action: 'add',
      data: { after: change.data.after.clone() },
    }
  }

  if (isRemovalChange(change)) {
    return {
      action: 'remove',
      data: { before: change.data.before.clone() },
    }
  }

  return {
    action: 'modify',
    data: {
      before: change.data.before.clone(),
      after: change.data.after.clone(),
    },
  }
}

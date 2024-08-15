/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { validateValue } from './generic'

/**
 * Add space.key to a template request
 */
export const addSpaceKey: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndContext> = async ({
  value,
  context,
}) => ({
  value: {
    ...validateValue(value),
    space: {
      key: _.get(context.additionalContext, 'space_key'),
    },
  },
})

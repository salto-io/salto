/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

const convertSiteObjectToSiteId = (value: Record<string, unknown>): void => {
  value.site = _.get(value, 'site.id')
}

/*
 * Adjust function to convert site object to site id to make reference
 */

export const adjust: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  ;[convertSiteObjectToSiteId].forEach(func => func(value))
  return { value }
}

/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { validateValue } from './generic'

/**
 * AdjustFunction that increases version number on version object.
 */
export const increaseVersion: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndContext> = async args => {
  const value = validateValue(args.value)
  const version = _.get(value, 'version')
  if (!values.isPlainRecord(version) || !_.isNumber(version.number)) {
    return {
      value: {
        ...value,
        version: {
          // Fallback to version 2, in case of homepage addition for example
          // We don't have a version number yet but it is "1" in the service
          number: 2,
        },
      },
    }
  }
  return {
    value: {
      ...value,
      version: {
        ...version,
        number: version.number + 1,
      },
    },
  }
}

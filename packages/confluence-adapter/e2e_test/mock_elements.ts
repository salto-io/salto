/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'
import { e2eUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { DEFAULT_RESTRICTION } from '../src/definitions/utils'
import { SPACE_TYPE_NAME, PAGE_TYPE_NAME, TEMPLATE_TYPE_NAME } from '../src/constants'

export const uniqueFieldsPerType: Record<string, string[]> = {
  [SPACE_TYPE_NAME]: ['key', 'name'],
  [PAGE_TYPE_NAME]: ['title'],
  [TEMPLATE_TYPE_NAME]: ['name'],
}

const mockDefaultValues: Record<string, Values> = {
  [SPACE_TYPE_NAME]: {
    type: 'global',
    status: 'current',
    description: {
      plain: {
        value: 'some description',
        representation: 'plain',
      },
    },
  },
  [PAGE_TYPE_NAME]: {
    status: 'current',
    parentType: 'page',
    restriction: DEFAULT_RESTRICTION,
  },
  [TEMPLATE_TYPE_NAME]: {
    description: 'some description',
    templateType: 'page',
    editorVersion: 'v2',
    body: {
      storage: {
        value: '<p>some value</p>',
        representation: 'storage',
      },
    },
  },
}

export const getMockValues = (testSuffix: string): Record<string, Values> =>
  _.mapValues(mockDefaultValues, (values, typeName) => ({
    ...Object.fromEntries(
      uniqueFieldsPerType[typeName].map(field => [field, `${e2eUtils.TEST_PREFIX}${typeName}${testSuffix}`]),
    ),
    ...values,
  }))

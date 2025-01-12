/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getDeepInnerType, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { transformValues } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isDataObjectType } from '../types'

const { awu } = collections.asynciterable

const REDUNDANT_TYPES = ['NullField', 'CustomFieldList', 'CustomFieldRef']
const REDUNDANT_FIELDS = ['lastModifiedDate', 'dateCreated', 'createdDate', 'daysOverdue']

const filterCreator: LocalFilterCreator = () => ({
  name: 'redundantFields',
  onFetch: async elements => {
    await awu(elements)
      .filter(isObjectType)
      .forEach(async e => {
        e.fields = Object.fromEntries(
          await awu(Object.entries(e.fields))
            .filter(async ([name, field]) => {
              const fieldType = await getDeepInnerType(await field.getType())
              return !REDUNDANT_FIELDS.includes(name) && !REDUNDANT_TYPES.includes(fieldType.elemID.name)
            })
            .toArray(),
        )
      })

    await awu(elements)
      .filter(isInstanceElement)
      .filter(async e => isDataObjectType(await e.getType()))
      .forEach(async e => {
        e.value =
          (await transformValues({
            values: e.value,
            type: await e.getType(),
            transformFunc: ({ value, path }) =>
              path?.name === undefined || !REDUNDANT_FIELDS.includes(path.name) ? value : undefined,
            strict: false,
            pathID: e.elemID,
          })) ?? e.value
      })

    _.remove(elements, e => REDUNDANT_TYPES.includes(e.elemID.name))
  },
})

export default filterCreator

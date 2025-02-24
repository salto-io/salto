/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

type RecurseIntoFieldComponent = {
  recurseIntoFields: { fieldName: string }[]
}

const recurseIntoFieldMap: Record<string, RecurseIntoFieldComponent> = {
  business_hours_schedule: {
    recurseIntoFields: [
      {
        fieldName: 'holidays',
      },
    ],
  },
  routing_attribute: {
    recurseIntoFields: [
      {
        fieldName: 'values',
      },
    ],
  },
  custom_object: {
    recurseIntoFields: [
      {
        fieldName: 'custom_object_fields',
      },
    ],
  },
}

/*
 * As part of the migration to the new infra (SALTO-5761), there are some types for whom the
 * 'recurseInto' fields get omitted when no values are present (details: SALTO-5860).
 * While this is 'correct' behavior, it diverges from the behavior of the old infra, which means it creates a diff
 * while fetching for clients.  * We would like to not have diff, so in this filter we re-add the omitted fields.
 */
const filterCreator: FilterCreator = () => ({
  name: 'addRecurseIntoField',
  onFetch: async (elements: Element[]): Promise<void> => {
    elements.filter(isInstanceElement).forEach(element => {
      const fields = recurseIntoFieldMap[element.elemID.typeName]
      if (fields === undefined) {
        return
      }
      fields.recurseIntoFields.forEach(field => {
        if (element.value[field.fieldName] === undefined) {
          element.value[field.fieldName] = []
        }
      })
    })
  },
})

export default filterCreator

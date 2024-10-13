/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement, ModificationChange, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { LocalFilterOpts } from '../../src/filter'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import filterCreator from '../../src/filters/restore_deleted_list_items'
import { customlistType } from '../../src/autogen/types/standard_types/customlist'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('restore deleted list items with scriptid filter', () => {
  let fetchOpts: LocalFilterOpts
  let instance: InstanceElement
  const origInstance = new InstanceElement(
    'instance',
    customlistType().type,
    {
      customvalues: {
        customvalue: {
          val1: {
            scriptid: 'val_1',
            value: 'value1',
          },
          val2: {
            scriptid: 'val_2',
            value: 'value2',
          },
        },
      },
      otherField: {
        val1: {
          val1: {
            value: 'value1',
          },
          val2: {
            value: 'value2',
          },
        },
      },
    },
    undefined,
    {
      [CORE_ANNOTATIONS.CREATED_BY]: 'hello',
    },
  )
  beforeEach(async () => {
    instance = origInstance.clone()
    fetchOpts = {
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      ...getTypesToInternalId([]),
    }
  })

  it('should not add any fields if not deleted fields with scriptid', async () => {
    const after = instance.clone()
    delete after.value.otherField.val1
    const change = toChange({ before: instance, after }) as ModificationChange<InstanceElement>
    await filterCreator(fetchOpts).onDeploy?.([change], {
      appliedChanges: [],
      errors: [],
    })
    expect(change.data.after.value.otherField.val1).toBeUndefined()
  })
  it('should add the deleted field with scriptid', async () => {
    const after = instance.clone()
    delete after.value.customvalues.customvalue.val1
    const change = toChange({ before: instance, after }) as ModificationChange<InstanceElement>
    await filterCreator(fetchOpts).onDeploy?.([change], {
      appliedChanges: [],
      errors: [],
    })
    expect(change.data.after.value.customvalues.customvalue.val1).toEqual(
      change.data.before.value.customvalues.customvalue.val1,
    )
  })
})

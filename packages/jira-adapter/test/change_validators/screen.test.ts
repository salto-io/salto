/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { screenValidator } from '../../src/change_validators/screen'
import { JIRA } from '../../src/constants'

describe('screenValidator', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, 'Screen') })
    instance = new InstanceElement('instance', type)
  })
  it('should return an error if the same tab has the same field more then once', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: ['1', '2', '1', '2', '3'],
      },
    }

    expect(
      await screenValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t deploy screen which uses fields more than once',
        detailedMessage:
          'This screen uses the following fields more than once: 1, 2. Make sure each field is used only once, and try again. To learn more, go to https://help.salto.io/en/articles/9764037-error-when-deploying-a-screen-with-duplicate-fields',
      },
    ])
  })

  it('should return an error if the two tabs has the same field', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: ['1', '2'],
      },

      tab2: {
        name: 'tab2',
        fields: ['1', '3'],
      },
    }

    expect(
      await screenValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can’t deploy screen which uses fields more than once',
        detailedMessage:
          'This screen uses the following field more than once: 1. Make sure each field is used only once, and try again. To learn more, go to https://help.salto.io/en/articles/9764037-error-when-deploying-a-screen-with-duplicate-fields',
      },
    ])
  })

  it('should not return an error if there is no common field in the screen tabs', async () => {
    instance.value.tabs = {
      tab: {
        name: 'tab',
        fields: ['4', '2'],
      },

      tab2: {
        name: 'tab2',
        fields: ['1', '3'],
      },

      tab3: {
        name: 'tab3',
      },
    }

    expect(
      await screenValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })

  it('should not return an error if there are no tabs', async () => {
    expect(
      await screenValidator([
        toChange({
          after: instance,
        }),
      ]),
    ).toEqual([])
  })
})

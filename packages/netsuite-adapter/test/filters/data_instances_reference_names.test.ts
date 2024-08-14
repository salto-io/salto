/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_reference_names'
import { NETSUITE } from '../../src/constants'
import { RemoteFilterOpts } from '../../src/filter'

const runSuiteQLMock = jest.fn()

describe('data isntances reference names filter', () => {
  let accountInstance: InstanceElement

  const filterOpts = {
    client: {
      runSuiteQL: runSuiteQLMock,
    },
  } as unknown as RemoteFilterOpts

  beforeEach(() => {
    jest.clearAllMocks()
    accountInstance = new InstanceElement('account123', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }), {
      restrictToAccountingBookList: [
        {
          internalId: '1',
        },
      ],
    })
  })

  it('should set reference name', async () => {
    runSuiteQLMock.mockResolvedValue([
      { id: '1', name: 'accountingBook1' },
      // filtered corrupted result
      { id: '2' },
    ])
    await filterCreator(filterOpts).onFetch?.([accountInstance])
    expect(accountInstance.value.restrictToAccountingBookList).toEqual([
      {
        internalId: '1',
        name: 'accountingBook1',
      },
    ])
  })
  it('should not query if there are no missing reference names', async () => {
    accountInstance.value.restrictToAccountingBookList = [
      {
        internalId: '1',
        name: 'accountingBook1',
      },
    ]
    await filterCreator(filterOpts).onFetch?.([accountInstance])
    expect(runSuiteQLMock).not.toHaveBeenCalled()
  })
  it('should not set reference name if query result is undefined', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    await filterCreator(filterOpts).onFetch?.([accountInstance])
    expect(accountInstance.value.restrictToAccountingBookList).toEqual([
      {
        internalId: '1',
      },
    ])
  })
})

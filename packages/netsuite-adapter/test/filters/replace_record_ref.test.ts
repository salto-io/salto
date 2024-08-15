/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ContainerType, ElemID, ObjectType, TypeElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/replace_record_ref'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('replaceRecordRef', () => {
  let recordRefType: ObjectType
  let recordRefListType: ObjectType
  let typeWithRecordRef: ObjectType
  let elements: TypeElement[]
  const departmentType = new ObjectType({ elemID: new ElemID(NETSUITE, 'department') })
  const subsidiaryType = new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') })

  beforeEach(() => {
    recordRefType = new ObjectType({ elemID: new ElemID(NETSUITE, 'recordRef') })
    recordRefListType = new ObjectType({ elemID: new ElemID(NETSUITE, 'recordRefList') })
    typeWithRecordRef = new ObjectType({
      elemID: new ElemID(NETSUITE, 'typeWithRecordRef'),
      fields: {
        department: { refType: recordRefType },
        parent: { refType: recordRefType },
        subsidiaryList: { refType: recordRefListType },
        recordRef: { refType: recordRefType },
        recordRefList: { refType: recordRefListType },
      },
    })
    elements = [typeWithRecordRef, recordRefType, recordRefListType, departmentType, subsidiaryType]
  })

  it('should add field to record ref type', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.(elements)
    expect(((await typeWithRecordRef.fields.recordRef.getType()) as ObjectType).fields.id).toBeDefined()
  })

  it('should replace all record refs references', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.(elements)
    expect((await typeWithRecordRef.fields.department.getType()).elemID.name).toBe('department')
    expect(
      (await ((await typeWithRecordRef.fields.subsidiaryList.getType()) as ContainerType).getInnerType()).elemID.name,
    ).toBe('subsidiary')
    expect((await typeWithRecordRef.fields.parent.getType()).elemID.name).toBe('typeWithRecordRef')
    expect((await typeWithRecordRef.fields.recordRef.getType()).elemID.name).toBe('recordRef')
    expect((await typeWithRecordRef.fields.recordRefList.getType()).elemID.name).toBe('List<netsuite.recordRef>')
  })
})

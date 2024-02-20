/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ContainerType, ElemID, ObjectType, TypeElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/replace_record_ref'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('replaceRecordRef', () => {
  let recordRefType: ObjectType
  let typeWithRecordRef: ObjectType
  let elements: TypeElement[]
  const departmentType = new ObjectType({ elemID: new ElemID(NETSUITE, 'department') })
  const subsidiaryType = new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') })

  beforeEach(() => {
    recordRefType = new ObjectType({ elemID: new ElemID(NETSUITE, 'recordRef') })
    typeWithRecordRef = new ObjectType({
      elemID: new ElemID(NETSUITE, 'typeWithRecordRef'),
      fields: {
        department: { refType: recordRefType },
        parent: { refType: recordRefType },
        subsidiaryList: { refType: new ObjectType({ elemID: new ElemID(NETSUITE, 'recordRefList') }) },
        recordRef: { refType: recordRefType },
      },
    })
    elements = [typeWithRecordRef, recordRefType, departmentType, subsidiaryType]
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
  })
})

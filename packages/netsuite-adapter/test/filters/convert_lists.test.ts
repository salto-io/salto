/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { promises } from '@salto-io/lowerdash'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { datasetType } from '../../src/autogen/types/standard_types/dataset'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import filterCreator from '../../src/filters/convert_lists'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import { LocalFilterOpts } from '../../src/filter'

describe('convert_lists filter', () => {
  const instanceName = 'instanceName'
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(instanceName, datasetType().type, {
      name: instanceName,
      dependencies: {
        dependency: 'singleValue',
      },
    })
  })

  it('should not modify field with non ListType', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value.name).toEqual(instanceName)
  })

  it('should modify single value to a singleton in case of ListType', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value.dependencies.dependency).toEqual(['singleValue'])
  })

  it('should sort primitive list values if in unorderedListFields', async () => {
    instance.value.dependencies.dependency = ['b', 'a', 'c']
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value.dependencies.dependency).toEqual(['a', 'b', 'c'])
  })

  it('should not sort list if in unorderedListFields', async () => {
    const roleAccessesValue = [
      {
        accesslevel: '1',
        role: 'ADMINISTRATOR',
        searchlevel: '1',
      },
      {
        accesslevel: '2',
        role: 'BOOKKEEPER',
        searchlevel: '2',
      },
    ]

    instance = new InstanceElement(instanceName, entitycustomfieldType().type, {
      label: instanceName,
      roleaccesses: {
        roleaccess: roleAccessesValue,
      },
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value.roleaccesses.roleaccess).toEqual(roleAccessesValue)
  })

  describe('custom record type', () => {
    let customRecordType: ObjectType
    beforeEach(async () => {
      customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotationRefsOrTypes: await promises.object.mapValuesAsync(customrecordtypeType().type.fields, field =>
          field.getType(),
        ),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          instances: {
            instance: {
              [SCRIPT_ID]: 'customrecord1_record1',
            },
          },
        },
      })
    })
    it('should modify single value to a singleton in case of ListType', async () => {
      await filterCreator({} as LocalFilterOpts).onFetch?.([customRecordType])
      expect(customRecordType.annotations.instances.instance).toEqual([
        {
          [SCRIPT_ID]: 'customrecord1_record1',
        },
      ])
    })
  })
})

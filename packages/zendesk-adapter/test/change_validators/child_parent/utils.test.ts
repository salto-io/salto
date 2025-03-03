/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { ChildParentRelationship, getChildAndParentTypeNames } from '../../../src/change_validators/child_parent/utils'
import { Options } from '../../../src/definitions/types'

describe('getChildAndParentTypeNames', () => {
  let mockDefinitions: definitionsUtils.ApiDefinitions<Options>
  let result: ChildParentRelationship[]

  beforeEach(() => {
    mockDefinitions = {
      fetch: {
        instances: {
          default: {},
          customizations: {
            parent_type: {
              element: {
                fieldCustomizations: {
                  field1: {
                    standalone: {
                      typeName: 'custom_type_name',
                    },
                  },
                  field2: {
                    standalone: {},
                  },
                  field3: { fieldType: 'number', hide: true },
                },
              },
            },
            another_parent: {
              element: {
                fieldCustomizations: {
                  field4: { fieldType: 'number', hide: true },
                },
              },
            },
          },
        },
      },
    } as unknown as definitionsUtils.ApiDefinitions<Options>
    result = getChildAndParentTypeNames(mockDefinitions)
  })

  it('should return relationships for standalone fields with custom type names', () => {
    expect(result).toContainEqual({
      parent: 'parent_type',
      child: 'custom_type_name',
      fieldName: 'field1',
    })
  })

  it('should use nested type name when no custom type name is provided', () => {
    expect(result).toContainEqual({
      parent: 'parent_type',
      child: 'parent_type__field2',
      fieldName: 'field2',
    })
  })

  it('should not include non-standalone fields', () => {
    const field3Relationship = result.find(res => res.parent === 'parent_type' && res.fieldName === 'field3')
    expect(field3Relationship).toBeUndefined()
  })

  it('should include additional predefined relationships', () => {
    // Check predefined relationships
    expect(result).toContainEqual({
      parent: 'macro',
      child: 'macro_attachment',
      fieldName: 'attachments',
    })

    expect(result).toContainEqual({
      parent: 'brand',
      child: 'brand_logo',
      fieldName: 'logo',
    })

    expect(result).toContainEqual({
      parent: 'article',
      child: 'article_attachment',
      fieldName: 'attachments',
    })
  })

  it('should handle empty definitions', () => {
    const emptyDefinitions = {
      fetch: {
        instances: {
          default: {},
          customizations: {},
        },
      },
    } as unknown as definitionsUtils.ApiDefinitions<Options>

    result = getChildAndParentTypeNames(emptyDefinitions)

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      parent: 'macro',
      child: 'macro_attachment',
      fieldName: 'attachments',
    })
  })

  it('should handle undefined field customizations', () => {
    const defsWithoutCustomizations = {
      fetch: {
        instances: {
          default: {},
          customizations: {
            parent_type: {
              element: {},
            },
          },
        },
      },
    } as unknown as definitionsUtils.ApiDefinitions<Options>

    result = getChildAndParentTypeNames(defsWithoutCustomizations)

    expect(result).toHaveLength(3) // The predefined relationships
  })
})

/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { DirectoryStore, File } from '../../src/workspace/dir_store'

const workspaceFiles = {
  'file.nacl': `
type salesforce.lead {
  salesforce.text base_field {
    ${CORE_ANNOTATIONS.DEFAULT} = "asd"
  }
  "List<number>" list_field {
    ${CORE_ANNOTATIONS.DEFAULT} = [
      1,
      2,
      3,
      4,
      5
    ]
  }

  number not_a_list_yet_field {}
  salesforce.text empty {}
}

type salesforce.text is string {}

type salesforce.AccountIntelligenceSettings {
  boolean enableAccountLogos {
  }
  boolean enableAutomatedAccountFields {
  }
  boolean enableNewsStories {
  }
}

type salesforce.WithAnnotationsBlock {
  annotations {
    string firstAnnotation {
    }
    hidden_string internalId {
    }
  }
}

type salesforce.WithoutAnnotationsBlock {
}

salesforce.WithoutAnnotationsBlock instWithoutAnnotationsBlock {
}

type salesforce.WithoutAnnotationsBlockListNested {
  "List<salesforce.WithoutAnnotationsBlock>" noAnno {
  }
}

type salesforce.ObjWithHidden {
  annotations {
    hidden_string internalId {
    }
  }
  number visible {
  }
  string hide {
    ${CORE_ANNOTATIONS.HIDDEN} = true
  }
  string hide_val {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
  number other {
  }
}

type salesforce.VisibleObjWithHidden {
  annotations {
    hidden_string internalId {
    }
  }
  number visible {
  }
  string hide {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
}

salesforce.ObjWithHidden instWithHidden {
  visible = 142
  other = 1
}

type salesforce.ObjWithNestedHidden {
  salesforce.ObjWithHidden nested {
  }
  salesforce.VisibleObjWithHidden nested_visible {
  }
  number other {
  }
}

salesforce.ObjWithNestedHidden instWithNestedHidden {
  other = 1
  nested_visible = {
    visible = 111
  }
}

type salesforce.ObjWithComplexHidden {
  salesforce.ObjWithHidden nested {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
  number other {
  }
}

salesforce.ObjWithComplexHidden instWithComplexHidden {
  other = 1
}

type salesforce.ObjWithDoublyNestedHidden {
  salesforce.ObjWithNestedHidden doubleNest {
  }
  salesforce.ObjWithHidden singleNest {
  }
  number noNest {
  }
  salesforce.ObjWithNestedHidden doubleHiddenVal {
    ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  }
}

salesforce.ObjWithDoublyNestedHidden instWithDoublyNestedHidden {
  noNest = 44
  singleNest = {
    other = 2
    visible = 333
  }
  doubleNest = {
    nested = {
      other = -3
      visible = 0
    }
  }
}

type salesforce.HiddenVal {
  ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  string something {
  }
  number somethingElse {
  }
}

type salesforce.HiddenToVisibleVal {
  ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
  string something {
  }
  number somethingElse {
  }
}

type salesforce.HiddenToVisibleType is string {
  ${CORE_ANNOTATIONS.HIDDEN_VALUE} = true
}

type salesforce.VisibleToHiddenType is string {
}

type salesforce.NestedHiddenVal {
  annotations {
    salesforce.HiddenVal hidden_val_anno {
    }
    salesforce.HiddenToVisibleVal hidden_to_visible_anno {
    }
  }
  string visible_val {
  }
}

type multi.loc { a = 1 }
type one.liner { a = 1 }`,
  'subdir/file.nacl': `
type salesforce.lead {
  salesforce.text ext_field {
    ${CORE_ANNOTATIONS.DEFAULT} = "foo"
  }
}
type multi.loc { b = 1 }`,

  'error.nacl': '{{ invalid syntax }}',

  'reference_error.nacl': `
type some.type {
  string a {
  }
}

some.type instance {
  a = some.type.instance.notExists
}
`,

  'dup.nacl': `
type salesforce.lead {
  string base_field {}
}`,

  'will_be_empty.nacl': 'type nonempty { a = 2 }',
  'renamed_type.nacl': `type salesforce.RenamedType1 {
  }`,
  'fieldsWithHidden.nacl': `
  type salesforce.FieldTypeWithHidden {
    annotations {
      salesforce.HiddenVal hiddenValAnno {
      }
      string visible {

      }
    }
  }

  type salesforce.FieldTypeWithChangingHidden {
    annotations {
      hidden_string hiddenSwitchType {
      }
      string visibleSwitchType {
      }
      salesforce.VisibleToHiddenType visibleChangeType {
      }
      salesforce.HiddenToVisibleType hiddenChangeType {
      }
    }
  }

  type salesforce.ObjWithFieldTypeWithHidden {
    annotations {
      hidden_string hiddenSwitchType {
      }
      string visibleSwitchType {
      }
      salesforce.VisibleToHiddenType visibleChangeType {
      }
      salesforce.HiddenToVisibleType hiddenChangeType {
      }
      salesforce.VisibleToHiddenType visibleChangeAndSwitchType {
      }
    }
    visibleSwitchType = "asd"
    visibleChangeType = "asd"
    visibleChangeAndSwitchType = "asd"

    salesforce.FieldTypeWithHidden fieldWithHidden {
      visible = "YOU SEE ME"
    }
    salesforce.FieldTypeWithChangingHidden fieldWithChangingHidden {
      visibleSwitchType = "asd"
      visibleChangeType = "asd"
    }
  }
  `,
  'inconsistent_case.nacl': `
type salesforce.inconsistent_case {
}
`,
}

export const mockDirStore = <T extends Buffer | string>(
  exclude: string[] = ['error.nacl', 'dup.nacl', 'reference_error.nacl'],
  empty = false,
  files?: Record<string, T>,
): MockInterface<DirectoryStore<T>> => {
  const naclFiles: Map<string, File<T>> = empty
    ? new Map()
    : new Map(
        Object.entries(files ?? workspaceFiles).map(([filename, buffer]) => [
          filename,
          { filename, buffer, timestamp: Date.now() },
        ]),
      )
  return {
    list: mockFunction<DirectoryStore<T>['list']>().mockImplementation(async () =>
      Array.from(naclFiles.keys()).filter(name => !exclude.includes(name)),
    ),
    isEmpty: mockFunction<DirectoryStore<T>['isEmpty']>().mockResolvedValue(naclFiles.size === 0),
    get: mockFunction<DirectoryStore<T>['get']>().mockImplementation(async filename => naclFiles.get(filename)),
    set: mockFunction<DirectoryStore<T>['set']>().mockImplementation(async file => {
      file.timestamp = Date.now()
      naclFiles.set(file.filename, file)
    }),
    delete: mockFunction<DirectoryStore<T>['delete']>().mockImplementation(async fileName => {
      naclFiles.delete(fileName)
    }),
    clear: mockFunction<DirectoryStore<T>['clear']>().mockImplementation(async () => naclFiles.clear()),
    rename: mockFunction<DirectoryStore<T>['rename']>().mockImplementation(() => Promise.resolve()),
    renameFile: mockFunction<DirectoryStore<T>['renameFile']>().mockImplementation(async (filename, newName) => {
      const origFile = naclFiles.get(filename)
      if (origFile !== undefined) {
        naclFiles.set(newName, origFile)
        naclFiles.delete(filename)
      }
    }),
    flush: mockFunction<DirectoryStore<T>['flush']>().mockImplementation(() => Promise.resolve()),
    mtimestamp: mockFunction<DirectoryStore<T>['mtimestamp']>().mockImplementation(
      async fileName => naclFiles.get(fileName)?.timestamp,
    ),
    getFiles: mockFunction<DirectoryStore<T>['getFiles']>().mockImplementation(async filenames =>
      filenames.map(name => naclFiles.get(name)),
    ),
    getTotalSize: mockFunction<DirectoryStore<T>['getTotalSize']>().mockResolvedValue(0),
    clone: mockFunction<DirectoryStore<T>['clone']>().mockImplementation(() =>
      mockDirStore(
        exclude,
        empty,
        Object.fromEntries(Array.from(naclFiles.entries()).map(([name, file]) => [name, file.buffer])),
      ),
    ),
    getFullPath: mockFunction<DirectoryStore<T>['getFullPath']>().mockImplementation(filename => filename),
    isPathIncluded: mockFunction<DirectoryStore<T>['isPathIncluded']>().mockReturnValue(true),
    exists: mockFunction<DirectoryStore<T>['exists']>().mockImplementation(async filename => naclFiles.has(filename)),
  }
}

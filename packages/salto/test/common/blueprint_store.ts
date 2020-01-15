import { CORE_ANNOTATIONS } from 'adapter-api'
import _ from 'lodash'
import BlueprintsStore, { Blueprint } from '../../src/workspace/blueprints_store'

const workspaceFiles = {
  'file.bp': `
type salesforce_lead {
salesforce_text base_field {
  ${CORE_ANNOTATIONS.DEFAULT} = "asd"
}
list number list_field {
  ${CORE_ANNOTATIONS.DEFAULT} = [
    1,
    2,
    3,
    4,
    5
  ]
}
number not_a_list_yet_field {

}
}
type multi_loc { a = 1 }
type one_liner { a = 1 }`,
  'subdir/file.bp': `
type salesforce_lead {
salesforce_text ext_field {
  ${CORE_ANNOTATIONS.DEFAULT} = "foo"
}
}
type multi_loc { b = 1 }`,

  'error.bp': 'invalid syntax }}',

  'dup.bp': `
type salesforce_lead {
string base_field {}
}`,

  'willbempty.bp': 'type nonempty { a = 2 }',
}

const bps: Record<string, Blueprint> = _.mapValues(workspaceFiles,
  (buffer, filename) => ({ filename, buffer }))

export const mockBpsStore = (exclude: string[] = ['error.bp', 'dup.bp']): BlueprintsStore => (
  {
    list: jest.fn().mockResolvedValue(Object.keys(bps).filter(name => !exclude.includes(name))),
    get: jest.fn().mockImplementation((filename: string) => Promise.resolve(bps[filename])),
    set: jest.fn().mockImplementation(() => Promise.resolve()),
    delete: jest.fn().mockImplementation(() => Promise.resolve()),
  }
)

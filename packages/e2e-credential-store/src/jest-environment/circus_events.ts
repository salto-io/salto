import { Event } from 'jest-circus'

type TestBlock = {
  parent?: TestBlock
  name: string
}

const testBlockId = (b: TestBlock): string => (
  b.parent ? [testBlockId(b.parent), b.name].filter(x => x).join(' | ') : ''
)

export type EventStatus = 'start' | 'success' | 'failure'

export type TestStatusChangeEvent = {
  id: string
  type: 'test' | 'hook'
  status: EventStatus
}

export const extractStatus = (e: Event): TestStatusChangeEvent | undefined => {
  if (
    e.name === 'hook_start'
    || e.name === 'hook_success'
    || e.name === 'hook_failure'
  ) {
    return {
      id: testBlockId({ name: e.hook.type, parent: e.hook.parent }),
      type: 'hook',
      status: e.name.split('_')[1] as EventStatus,
    }
  }

  if (
    e.name === 'test_fn_start'
    || e.name === 'test_fn_success'
    || e.name === 'test_fn_failure'
  ) {
    return {
      id: testBlockId({ name: e.test.name, parent: e.test.parent }),
      type: 'test',
      status: e.name.split('_')[2] as EventStatus,
    }
  }

  return undefined
}

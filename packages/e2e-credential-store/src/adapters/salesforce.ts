// import { Credentials } from 'salesforce-adapter'
import { Adapter } from '../types'

type Credentials = {
  username: string
  password: string
  apiToken?: string
  isSandbox: boolean
}

type Args = {
  username: string
  password: string
  'api-token'?: string
  sandbox: boolean
}

const adapter = (): Adapter<Args, Credentials> => ({
  name: 'salesforce',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
    'api-token': {
      type: 'string',
      demand: false,
    },
    sandbox: {
      type: 'boolean',
      default: false,
    },
  },
  credentials: args => ({
    username: args.username,
    password: args.password,
    apiToken: args['api-token'],
    isSandbox: args.sandbox,
  }),
})

export default adapter

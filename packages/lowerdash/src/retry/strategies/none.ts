import { RetryStrategy } from '../strategy'

const none: () => RetryStrategy = () => () => 'no retry'

export default none

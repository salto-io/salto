const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(
    require('../../jest.base.config.js'),
    {
        name: 'hubspot-adapter',
        displayName: 'hubspot-adapter',
        rootDir: `${__dirname}`,
        collectCoverageFrom: [
            '!<rootDir>/dist/index.js',
        ],
        coverageThreshold: {
            global: {
                branches: 85,
                functions: 85,
                lines: 85,
                statements: 85,
            },
        },
    }
)

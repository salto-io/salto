#!/usr/bin/env node

const path = require('path')

const workspaces = require('./workspaces')(path.join(__dirname, '..'))

workspaces.ensureGitInfoInPackages()

workspaces.ensureVersionInPackages(process.argv[2])

# podverse-parser

A module used for handling RSS and other file type parsing operations.

## Dev Setup

### Environment Variables

The environment variables for this module must be set within the app that consumes this module (ex. `podverse-api` or `podverse-workers`). See `podverse-parser/config/index.ts` for a list of the env vars expected.

### Local Dev Workflow

Podverse uses many modules that are maintained in separate repos, and they need to be linked and running for a local dev workflow. Please read the `podverse-ops/dev/local-dev-setup.md` file to set up the required dependencies and module linking.

### Running Locally

Install the node_modules:

```
npm install
```

Then to build:

```
npm run build
```

Or if you want the app to auto-build on saved changes:

```
npm run build:watch
```

## Publishing

To publish your changes to npm, increment the version number is `package.json` then run `npm publish`.

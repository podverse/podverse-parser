const moduleAlias = require('module-alias');
const path = require('path');

moduleAlias.addAliases({
  '@parser': path.join(__dirname, '')
});

export {};

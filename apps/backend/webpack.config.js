const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');
const { version } = require('../../package.json');

module.exports = composePlugins(withNx(), (config) => {
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.DefinePlugin({
      __APP_VERSION__: JSON.stringify(version),
    })
  );
  return config;
});
